# Banco de dados - Rossi Supermercados (Supabase)

## 1) Variáveis de ambiente

Use um `.env.local` **sem versionar segredo**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xkhgjfjipkhrbkjltcgp.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...publishable...
SUPABASE_SECRET_KEY=...secret...
PROJECT_CODE=ROSSI-PMO
PROJECT_NAME=Rossi Supermercados
SHEET_URL_PENDENCIAS=
SHEET_URL_RISCOS=
SHEET_URL_GAPS=
SHEET_URL_ATIVIDADES=
SHEET_URL_GERAL=
```

## 2) Criar estrutura

No SQL Editor do Supabase, rode o arquivo:

- `supabase/migrations/20260502_000001_initial_schema.sql`

## 3) Carga inicial das planilhas

```bash
node scripts/import_spreadsheets_to_supabase.mjs
```

## 4) Inteligência de dados

A view `v_project_health` consolida indicadores:
- pendências abertas
- riscos abertos
- maior exposição de risco
- gaps abertos
