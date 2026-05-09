# Banco de dados - Rossi Supermercados (Supabase)

## 1) Variáveis de ambiente

Use um `.env.local` **sem versionar segredo**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...publishable...
SUPABASE_SECRET_KEY=...secret / service_role...
PROJECT_CODE=ROSSI-PMO
PROJECT_NAME=Rossi Supermercados
SHEET_URL_PENDENCIAS=
SHEET_URL_RISCOS=
SHEET_URL_GAPS=
SHEET_URL_ATIVIDADES=
SHEET_URL_GERAL=
```

---

## 2) SQL completo (todas as tabelas + ajustes)

No SQL Editor do Supabase, rode **nesta ordem**:

1. `supabase/migrations/20260502_000001_initial_schema.sql`
2. `supabase/migrations/20260504_000002_project_sync_and_tap.sql`
3. `supabase/migrations/20260505_000003_api_access_and_rpc.sql`

> Esses 3 arquivos criam **todas** as tabelas do projeto:
> `projects`, `spreadsheet_sources`, `issues`, `risks`, `gaps`, `activities`, `import_jobs`, `source_rows`, `tap_entries`.

---

## 3) Carga inicial das planilhas

```bash
node scripts/import_spreadsheets_to_supabase.mjs
```

> ⚠️ `node scripts/import_spreadsheets_to_supabase.mjs` **não é SQL**. Rode no terminal, não no SQL Editor.

---

## 4) Teste rápido de conexão com o banco

### 4.1 Teste de autenticação REST

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/projects?select=id,code,name&limit=1" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY"
```

Se retornar JSON (`[]` ou lista), conexão/autenticação estão OK.

### 4.2 Teste de tabela de sincronização

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/source_rows?select=id&limit=1" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY"
```

Se esse teste falhar, geralmente faltou executar a migration `20260504_000002_project_sync_and_tap.sql`.

---

## 5) Erros comuns que quebram a integração

1. URL errada (`app.supabase.com` em vez de `https://<project-ref>.supabase.co`)
2. Uso de chave publishable no lugar da secret/service role para escrita
3. Migration parcial (apenas uma parte das tabelas criada)
4. Falta de políticas/RLS para cenários com `authenticated`/`anon`

---

## 6) Checklist final (antes de testar no front)

- [ ] As 3 migrations foram executadas em ordem
- [ ] `NEXT_PUBLIC_SUPABASE_URL` aponta para `*.supabase.co`
- [ ] `SUPABASE_SECRET_KEY` está correta
- [ ] Endpoint `/rest/v1/projects` responde
- [ ] Endpoint `/rest/v1/source_rows` responde
- [ ] Script de importação rodou sem erro

---

## 7) Implantar esta estrutura Supabase em outra Main/projeto

Para replicar a conexão completa em outro projeto, use o implantador versionado neste repositório:

```bash
node scripts/install_supabase_stack.mjs /caminho/do/outro-projeto --patch-index --force
```

O script copia automaticamente:

- `supabase/migrations/*.sql`
- `scripts/import_spreadsheets_to_supabase.mjs`
- `.env.supabase.example`
- `supabase/setup/supabase-runtime.js`
- `supabase/setup/supabase-configurador.html`
- `docs/implantacao_supabase.md`

Use `--patch-index` quando o outro projeto tiver `index.html` e você quiser que o script tente adicionar o item **Supabase** no menu de configurações. Se o layout for diferente, copie manualmente o conteúdo de `supabase/setup/supabase-configurador.html` para a tela **Configurações** do projeto de destino.

Depois da cópia, entre no projeto de destino e siga o `docs/implantacao_supabase.md` criado pelo script.

## 8) Texto pronto para colar no Codex de outro projeto

Se você não quiser usar o instalador Node e preferir copiar um texto diretamente para o Codex do outro projeto, use o arquivo:

```text
docs/codex_supabase_implantacao_instrucoes.txt
```

Ele contém os comandos completos para criar `supabase/migrations`, `scripts/import_spreadsheets_to_supabase.mjs`, `.env.supabase.example`, `docs/implantacao_supabase.md` e orientar a inclusão dos campos Supabase no menu **Configurações**.
