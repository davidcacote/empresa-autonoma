-- Barraca — MVP (ciclo 0)
-- Decisões: ADR-001 (lotação garantida na BD), ADR-002 (gestão por link secreto), ADR-003 (inscrição por RPC com limites)
-- Regras: RLS em todas as tabelas; escrita só através de funções security definer com search_path vazio.

create extension if not exists pgcrypto with schema extensions;

-- ── Configuração privada (sal para hashes) ───────────────────────────────────
create table public.config_privada (
  chave text primary key,
  valor text not null
);
alter table public.config_privada enable row level security;
insert into public.config_privada (chave, valor)
values ('sal_hash', encode(extensions.gen_random_bytes(32), 'hex'));

-- ── Tabelas públicas ─────────────────────────────────────────────────────────
create table public.festas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 6 and 90),
  nome text not null check (char_length(btrim(nome)) between 3 and 80),
  localidade text not null check (char_length(btrim(localidade)) between 2 and 80),
  data_inicio date not null,
  data_fim date not null,
  descricao text check (descricao is null or char_length(descricao) <= 500),
  demo boolean not null default false,
  criado_em timestamptz not null default now(),
  check (data_fim >= data_inicio and data_fim - data_inicio <= 14)
);

create table public.postos (
  id uuid primary key default gen_random_uuid(),
  festa_id uuid not null references public.festas(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 40),
  ordem int not null default 0
);
create index postos_festa_idx on public.postos(festa_id);

create table public.turnos (
  id uuid primary key default gen_random_uuid(),
  festa_id uuid not null references public.festas(id) on delete cascade,
  posto_id uuid not null references public.postos(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  vagas int not null check (vagas between 1 and 50),
  ocupadas int not null default 0 check (ocupadas >= 0),
  check (fim > inicio and fim - inicio <= interval '12 hours'),
  check (ocupadas <= vagas)
);
create index turnos_festa_idx on public.turnos(festa_id);
create index turnos_posto_idx on public.turnos(posto_id);

create table public.inscricoes (
  id uuid primary key default gen_random_uuid(),
  festa_id uuid not null references public.festas(id) on delete cascade,
  turno_id uuid not null references public.turnos(id) on delete cascade,
  primeiro_nome text not null check (char_length(primeiro_nome) between 1 and 30),
  criado_em timestamptz not null default now()
);
create index inscricoes_turno_idx on public.inscricoes(turno_id);
create index inscricoes_festa_idx on public.inscricoes(festa_id);

-- ── Tabelas privadas (sem políticas = inacessíveis pela API) ─────────────────
create table public.festas_chaves (
  festa_id uuid primary key references public.festas(id) on delete cascade,
  chave_hash text not null
);

create table public.inscricoes_privado (
  inscricao_id uuid primary key references public.inscricoes(id) on delete cascade,
  turno_id uuid not null references public.turnos(id) on delete cascade,
  dispositivo_hash text not null,
  unique (turno_id, dispositivo_hash)
);

create table public.limites (
  chave text not null,
  janela timestamptz not null,
  contagem int not null default 0,
  primary key (chave, janela)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.festas enable row level security;
alter table public.postos enable row level security;
alter table public.turnos enable row level security;
alter table public.inscricoes enable row level security;
alter table public.festas_chaves enable row level security;
alter table public.inscricoes_privado enable row level security;
alter table public.limites enable row level security;

create policy "festas: leitura pública" on public.festas for select to anon, authenticated using (true);
create policy "postos: leitura pública" on public.postos for select to anon, authenticated using (true);
create policy "turnos: leitura pública" on public.turnos for select to anon, authenticated using (true);
create policy "inscricoes: leitura pública" on public.inscricoes for select to anon, authenticated using (true);

-- Defesa em profundidade: a API nunca escreve diretamente nas tabelas
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke select on public.festas_chaves, public.inscricoes_privado, public.limites, public.config_privada from anon, authenticated;

-- ── Lotação garantida na BD (ADR-001) ────────────────────────────────────────
create or replace function public.tg_inscricao_ocupar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_festa uuid;
begin
  update public.turnos
     set ocupadas = ocupadas + 1
   where id = new.turno_id and ocupadas < vagas
  returning festa_id into v_festa;
  if v_festa is null then
    raise exception 'turno_cheio' using errcode = 'P0001';
  end if;
  new.festa_id := v_festa;
  return new;
end $$;

create or replace function public.tg_inscricao_libertar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.turnos set ocupadas = greatest(ocupadas - 1, 0) where id = old.turno_id;
  return old;
end $$;

create trigger inscricao_ocupar before insert on public.inscricoes
  for each row execute function public.tg_inscricao_ocupar();
create trigger inscricao_libertar after delete on public.inscricoes
  for each row execute function public.tg_inscricao_libertar();

-- ── Utilitários internos ─────────────────────────────────────────────────────
create or replace function public._hash(p text)
returns text language sql stable security definer set search_path = '' as $$
  select encode(extensions.digest(
    p || (select valor from public.config_privada where chave = 'sal_hash'), 'sha256'), 'hex');
$$;

create or replace function public._ip_hash()
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_ip text;
begin
  v_ip := split_part(coalesce(
    (current_setting('request.headers', true)::json ->> 'x-forwarded-for'),
    (current_setting('request.headers', true)::json ->> 'cf-connecting-ip'),
    'desconhecido'), ',', 1);
  return public._hash('ip:' || btrim(v_ip));
end $$;

-- Conta um pedido na janela da hora atual; falha se passar do máximo
create or replace function public._limitar(p_chave text, p_max int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_contagem int;
begin
  insert into public.limites as l (chave, janela, contagem)
  values (p_chave, date_trunc('hour', now()), 1)
  on conflict (chave, janela) do update set contagem = l.contagem + 1
  returning contagem into v_contagem;
  if v_contagem > p_max then
    raise exception 'demasiados_pedidos' using errcode = 'P0001';
  end if;
end $$;

create or replace function public._nome_valido(p text)
returns text language plpgsql immutable set search_path = '' as $$
declare v text;
begin
  v := btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'));
  if char_length(v) < 1 or char_length(v) > 30 then
    raise exception 'nome_invalido' using errcode = 'P0001';
  end if;
  if v !~ '^[[:alpha:]][[:alpha:] .''-]*$' then
    raise exception 'nome_invalido' using errcode = 'P0001';
  end if;
  return v;
end $$;

-- ── API pública: inscrever (ADR-003) ─────────────────────────────────────────
create or replace function public.inscrever(
  p_turno uuid, p_nome text, p_dispositivo text, p_maior_idade boolean
) returns json language plpgsql security definer set search_path = '' as $$
declare
  v_nome text;
  v_disp text;
  v_turno public.turnos%rowtype;
  v_id uuid;
begin
  if p_maior_idade is not true then
    raise exception 'confirmar_maioridade' using errcode = 'P0001';
  end if;
  if p_dispositivo is null or char_length(p_dispositivo) not between 16 and 100 then
    raise exception 'dispositivo_invalido' using errcode = 'P0001';
  end if;
  v_nome := public._nome_valido(p_nome);
  v_disp := public._hash('disp:' || p_dispositivo);

  perform public._limitar('ins-ip:' || public._ip_hash(), 30);
  perform public._limitar('ins-disp:' || v_disp, 12);

  select * into v_turno from public.turnos where id = p_turno;
  if not found then
    raise exception 'turno_inexistente' using errcode = 'P0001';
  end if;
  if v_turno.fim < now() then
    raise exception 'turno_terminado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.inscricoes_privado where turno_id = p_turno and dispositivo_hash = v_disp) then
    raise exception 'ja_inscrito' using errcode = 'P0001';
  end if;

  insert into public.inscricoes (festa_id, turno_id, primeiro_nome)
  values (v_turno.festa_id, p_turno, v_nome)
  returning id into v_id;

  begin
    insert into public.inscricoes_privado (inscricao_id, turno_id, dispositivo_hash)
    values (v_id, p_turno, v_disp);
  exception when unique_violation then
    raise exception 'ja_inscrito' using errcode = 'P0001';
  end;

  return json_build_object('id', v_id, 'turno_id', p_turno, 'primeiro_nome', v_nome);
end $$;

-- O próprio voluntário cancela a partir do mesmo dispositivo
create or replace function public.cancelar_inscricao(p_inscricao uuid, p_dispositivo text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_apagadas int;
begin
  delete from public.inscricoes i
   using public.inscricoes_privado p
   where i.id = p_inscricao and p.inscricao_id = i.id
     and p.dispositivo_hash = public._hash('disp:' || coalesce(p_dispositivo, ''));
  get diagnostics v_apagadas = row_count;
  return v_apagadas > 0;
end $$;

-- ── API pública: criar festa (ADR-002) ───────────────────────────────────────
-- p_festa: {nome, localidade, data_inicio, data_fim, descricao?, slug_base,
--           postos: [{nome, turnos: [{dia:'AAAA-MM-DD', inicio:'HH:MM', fim:'HH:MM', vagas}]}]}
create or replace function public.criar_festa(p_festa json)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_festa_id uuid;
  v_slug text;
  v_chave text;
  v_base text;
  v_posto json;
  v_turno json;
  v_posto_id uuid;
  v_ordem int := 0;
  v_total_turnos int := 0;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_dia date;
  v_inicio_f date := (p_festa ->> 'data_inicio')::date;
  v_fim_f date := (p_festa ->> 'data_fim')::date;
begin
  perform public._limitar('festa-ip:' || public._ip_hash(), 6);

  if json_array_length(coalesce(p_festa -> 'postos', '[]'::json)) not between 1 and 12 then
    raise exception 'postos_invalidos' using errcode = 'P0001';
  end if;
  if v_fim_f < current_date then
    raise exception 'festa_no_passado' using errcode = 'P0001';
  end if;

  v_base := lower(regexp_replace(coalesce(p_festa ->> 'slug_base', 'festa'), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := btrim(left(v_base, 60), '-');
  if char_length(v_base) < 3 then v_base := 'festa'; end if;
  v_slug := v_base || '-' || encode(extensions.gen_random_bytes(3), 'hex');
  v_chave := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_');

  insert into public.festas (slug, nome, localidade, data_inicio, data_fim, descricao)
  values (v_slug, btrim(p_festa ->> 'nome'), btrim(p_festa ->> 'localidade'),
          v_inicio_f, v_fim_f, nullif(btrim(coalesce(p_festa ->> 'descricao', '')), ''))
  returning id into v_festa_id;

  insert into public.festas_chaves (festa_id, chave_hash) values (v_festa_id, public._hash('chave:' || v_chave));

  for v_posto in select * from json_array_elements(p_festa -> 'postos') loop
    insert into public.postos (festa_id, nome, ordem)
    values (v_festa_id, btrim(v_posto ->> 'nome'), v_ordem)
    returning id into v_posto_id;
    v_ordem := v_ordem + 1;

    for v_turno in select * from json_array_elements(coalesce(v_posto -> 'turnos', '[]'::json)) loop
      v_total_turnos := v_total_turnos + 1;
      if v_total_turnos > 80 then
        raise exception 'turnos_a_mais' using errcode = 'P0001';
      end if;
      v_dia := (v_turno ->> 'dia')::date;
      if v_dia < v_inicio_f or v_dia > v_fim_f then
        raise exception 'turno_fora_das_datas' using errcode = 'P0001';
      end if;
      -- Horas locais de Portugal continental, convertidas com as regras de mudança de hora
      v_inicio := ((v_dia::text || ' ' || (v_turno ->> 'inicio'))::timestamp) at time zone 'Europe/Lisbon';
      v_fim := ((v_dia::text || ' ' || (v_turno ->> 'fim'))::timestamp) at time zone 'Europe/Lisbon';
      if v_fim <= v_inicio then
        v_fim := (((v_dia + 1)::text || ' ' || (v_turno ->> 'fim'))::timestamp) at time zone 'Europe/Lisbon';
      end if;
      insert into public.turnos (festa_id, posto_id, inicio, fim, vagas)
      values (v_festa_id, v_posto_id, v_inicio, v_fim, (v_turno ->> 'vagas')::int);
    end loop;
  end loop;

  if v_total_turnos = 0 then
    raise exception 'sem_turnos' using errcode = 'P0001';
  end if;

  return json_build_object('slug', v_slug, 'chave', v_chave);
end $$;

-- ── API do organizador (link secreto) ────────────────────────────────────────
create or replace function public._festa_por_chave(p_slug text, p_chave text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  select f.id into v_id
    from public.festas f join public.festas_chaves c on c.festa_id = f.id
   where f.slug = p_slug and c.chave_hash = public._hash('chave:' || coalesce(p_chave, ''));
  return v_id;
end $$;

create or replace function public.verificar_chave(p_slug text, p_chave text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform public._limitar('chave-ip:' || public._ip_hash(), 30);
  return public._festa_por_chave(p_slug, p_chave) is not null;
end $$;

create or replace function public.remover_inscricao(p_slug text, p_chave text, p_inscricao uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_festa uuid; v_apagadas int;
begin
  perform public._limitar('chave-ip:' || public._ip_hash(), 30);
  v_festa := public._festa_por_chave(p_slug, p_chave);
  if v_festa is null then
    raise exception 'chave_invalida' using errcode = 'P0001';
  end if;
  delete from public.inscricoes where id = p_inscricao and festa_id = v_festa;
  get diagnostics v_apagadas = row_count;
  return v_apagadas > 0;
end $$;

-- ── Permissões das funções ───────────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.inscrever(uuid, text, text, boolean) to anon, authenticated;
grant execute on function public.cancelar_inscricao(uuid, text) to anon, authenticated;
grant execute on function public.criar_festa(json) to anon, authenticated;
grant execute on function public.verificar_chave(text, text) to anon, authenticated;
grant execute on function public.remover_inscricao(text, text, uuid) to anon, authenticated;

-- ── Tempo real ───────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.turnos, public.inscricoes;
