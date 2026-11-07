-- Testes de segurança e lotação da Barraca, executados como visitante anónimo (role anon).
-- Corre com o MCP do Supabase (execute_sql). Cria uma festa de teste e apaga-a no fim.
-- Resultado: uma linha por caso, com "ok" true/false.
create or replace function pg_temp.testes_barraca()
returns table(caso text, ok boolean, detalhe text) language plpgsql as $$
declare
  r json; v_slug text; v_chave text; v_festa uuid; v_turno uuid; v_ins uuid; v_n int; v_msg text;
  amanha date := current_date + 1;
begin
  perform set_config('role', 'anon', true);

  -- 1. leitura pública funciona
  begin
    select count(*) into v_n from public.festas;
    caso := 'anon lê festas'; ok := true; detalhe := v_n || ' festas'; return next;
  exception when others then caso := 'anon lê festas'; ok := false; detalhe := sqlerrm; return next; end;

  -- 2. tabelas privadas inacessíveis
  begin
    perform 1 from privado.festas_chaves limit 1;
    caso := 'anon NÃO lê chaves'; ok := false; detalhe := 'conseguiu ler'; return next;
  exception when others then caso := 'anon NÃO lê chaves'; ok := true; detalhe := sqlerrm; return next; end;

  -- 3. escrita direta bloqueada
  begin
    insert into public.inscricoes (festa_id, turno_id, primeiro_nome)
    select festa_id, id, 'Intruso' from public.turnos limit 1;
    caso := 'anon NÃO insere direto'; ok := false; detalhe := 'inseriu'; return next;
  exception when others then caso := 'anon NÃO insere direto'; ok := true; detalhe := sqlerrm; return next; end;

  begin
    update public.turnos set vagas = 50;
    get diagnostics v_n = row_count;
    caso := 'anon NÃO altera vagas'; ok := (v_n = 0); detalhe := v_n || ' linhas alteradas'; return next;
  exception when others then caso := 'anon NÃO altera vagas'; ok := true; detalhe := sqlerrm; return next; end;

  -- 4. criar festa pela API
  r := public.criar_festa(json_build_object(
    'nome', 'Festa de Teste QA', 'localidade', 'Teste', 'slug_base', 'teste-qa',
    'data_inicio', amanha, 'data_fim', amanha,
    'postos', json_build_array(json_build_object('nome', 'Bar',
      'turnos', json_build_array(json_build_object('dia', amanha, 'inicio', '22:00', 'fim', '01:00', 'vagas', 2))))));
  v_slug := r ->> 'slug'; v_chave := r ->> 'chave';
  select f.id into v_festa from public.festas f where f.slug = v_slug;
  select t.id into v_turno from public.turnos t where t.festa_id = v_festa;
  caso := 'criar_festa devolve slug e chave'; ok := v_slug like 'teste-qa-%' and char_length(v_chave) >= 20; detalhe := v_slug; return next;

  select (extract(epoch from (t.fim - t.inicio)) / 3600)::int into v_n from public.turnos t where t.id = v_turno;
  caso := 'turno que passa a meia-noite tem 3 h'; ok := v_n = 3; detalhe := v_n || ' h'; return next;

  -- 5. validações da inscrição
  begin
    perform public.inscrever(v_turno, 'Ana', 'dispositivo-teste-0001', false);
    caso := 'exige maioridade'; ok := false; detalhe := 'aceitou'; return next;
  exception when others then caso := 'exige maioridade'; ok := sqlerrm = 'confirmar_maioridade'; detalhe := sqlerrm; return next; end;

  begin
    perform public.inscrever(v_turno, '<img src=x onerror=alert(1)>', 'dispositivo-teste-0001', true);
    caso := 'recusa nome com HTML'; ok := false; detalhe := 'aceitou'; return next;
  exception when others then caso := 'recusa nome com HTML'; ok := sqlerrm = 'nome_invalido'; detalhe := sqlerrm; return next; end;

  begin
    perform public.inscrever(v_turno, repeat('a', 31), 'dispositivo-teste-0001', true);
    caso := 'recusa nome gigante'; ok := false; detalhe := 'aceitou'; return next;
  exception when others then caso := 'recusa nome gigante'; ok := sqlerrm = 'nome_invalido'; detalhe := sqlerrm; return next; end;

  r := public.inscrever(v_turno, '  Maria   João ', 'dispositivo-teste-0001', true);
  v_ins := (r ->> 'id')::uuid;
  caso := 'inscreve e normaliza o nome'; ok := r ->> 'primeiro_nome' = 'Maria João'; detalhe := r ->> 'primeiro_nome'; return next;

  begin
    perform public.inscrever(v_turno, 'Maria', 'dispositivo-teste-0001', true);
    caso := 'mesmo dispositivo não repete'; ok := false; detalhe := 'aceitou'; return next;
  exception when others then caso := 'mesmo dispositivo não repete'; ok := sqlerrm = 'ja_inscrito'; detalhe := sqlerrm; return next; end;

  -- 6. lotação: 2 vagas, a 3.ª falha
  perform public.inscrever(v_turno, 'Rui', 'dispositivo-teste-0002', true);
  begin
    perform public.inscrever(v_turno, 'Zé', 'dispositivo-teste-0003', true);
    caso := 'turno cheio recusa'; ok := false; detalhe := 'aceitou'; return next;
  exception when others then caso := 'turno cheio recusa'; ok := sqlerrm = 'turno_cheio'; detalhe := sqlerrm; return next; end;

  -- 7. gestão por chave
  begin
    perform public.remover_inscricao(v_slug, 'chave-errada-123456789', v_ins);
    caso := 'chave errada não remove'; ok := false; detalhe := 'removeu'; return next;
  exception when others then caso := 'chave errada não remove'; ok := sqlerrm = 'chave_invalida'; detalhe := sqlerrm; return next; end;

  caso := 'cancelar com outro dispositivo falha'; ok := not public.cancelar_inscricao(v_ins, 'dispositivo-teste-9999'); detalhe := ''; return next;
  caso := 'verificar_chave certa'; ok := public.verificar_chave(v_slug, v_chave); detalhe := ''; return next;
  caso := 'remover com chave certa'; ok := public.remover_inscricao(v_slug, v_chave, v_ins); detalhe := ''; return next;

  select t.ocupadas, (select count(*) from public.inscricoes i where i.turno_id = t.id)::int
    into v_n, v_msg from public.turnos t where t.id = v_turno;
  caso := 'contador de vagas bate certo'; ok := v_n::text = v_msg; detalhe := 'ocupadas=' || v_n || ' inscrições=' || v_msg; return next;

  -- limpeza (como dono)
  perform set_config('role', 'postgres', true);
  delete from public.festas where id = v_festa;
  delete from privado.limites
   where chave like '%:' || privado.ip_hash()
      or chave in (select 'ins-disp:' || privado.hash('disp:' || d)
                     from unnest(array['dispositivo-teste-0001', 'dispositivo-teste-0002', 'dispositivo-teste-0003']) d);
end $$;

select * from pg_temp.testes_barraca();
