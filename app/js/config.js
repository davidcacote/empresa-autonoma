// Configuração pública do Supabase. A chave anon é pública por desenho:
// a segurança está nas políticas RLS e nas funções da base de dados (ver ADR-001 a ADR-004).
// Usa-se a chave anon (JWT) e não a publishable para garantir compatibilidade com o Realtime do supabase-js 2.45.
export const SUPABASE_URL = 'https://dlnqbgsrwuscppnjkogy.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsbnFiZ3Nyd3VzY3Bwbmprb2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNDIzNzQsImV4cCI6MjEwOTYxODM3NH0.BCqBQAobHRBaXj2BHTtqAueV2U62x5QGdnPoWp-2HsY';
export const SUPABASE_JS_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
export const SONDAGEM_MS = 15000;
