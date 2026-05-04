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


> ⚠️ **Importante:** `node scripts/import_spreadsheets_to_supabase.mjs` **não é SQL**. Esse comando deve ser executado no **terminal** (VS Code, PowerShell, bash), e **não** no SQL Editor do Supabase.

Exemplo (na pasta do projeto):

**Linux/macOS (ou ambiente remoto/container):**

```bash
cd /workspace/PRJ_ROSSI_SUPERMERCADOS
node scripts/import_spreadsheets_to_supabase.mjs
```

**Windows (Prompt de Comando/PowerShell):**

```bat
cd C:\caminho\para\PRJ_ROSSI_SUPERMERCADOS
node scripts\import_spreadsheets_to_supabase.mjs
```

> Se aparecer "O sistema não pode encontrar o caminho especificado", o `cd` está apontando para uma pasta que não existe na sua máquina. Use o caminho real local do projeto (ex.: `C:\Users\SeuUsuario\Documents\PRJ_ROSSI_SUPERMERCADOS`).




### Se a pasta do projeto não existir no seu Windows

Se ao entrar em `C:\Users\SeuUsuario\Documents` a pasta `PRJ_ROSSI_SUPERMERCADOS` não aparecer, você precisa primeiro **baixar/clonar** o repositório para sua máquina.

Exemplo com Git:

```bat
cd C:\Users\SeuUsuario\Documents
git clone <URL_DO_REPOSITORIO> PRJ_ROSSI_SUPERMERCADOS
cd PRJ_ROSSI_SUPERMERCADOS
node scripts\import_spreadsheets_to_supabase.mjs
```

Alternativa sem Git:
1. Baixe o `.zip` do projeto.
2. Extraia para `C:\Users\SeuUsuario\Documents\PRJ_ROSSI_SUPERMERCADOS`.
3. Abra um terminal nessa pasta e rode o comando `node`.


## 4) Inteligência de dados

A view `v_project_health` consolida indicadores:
- pendências abertas
- riscos abertos
- maior exposição de risco
- gaps abertos


## 5) Checklist do que precisa para conectar (o que pode estar faltando)

Para conseguir **conectar e testar de ponta a ponta**, confirme estes itens:

1. **URL do projeto Supabase**
   - `NEXT_PUBLIC_SUPABASE_URL`
2. **Chave publishable (client-side)**
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. **Chave secret/service role (server-side/importação)**
   - `SUPABASE_SECRET_KEY`
4. **Schema criado no banco**
   - Migration `supabase/migrations/20260502_000001_initial_schema.sql` executada no SQL Editor
5. **(Opcional, mas necessário para carga automática) URLs CSV das planilhas**
   - `SHEET_URL_PENDENCIAS`
   - `SHEET_URL_RISCOS`
   - `SHEET_URL_GAPS`
   - `SHEET_URL_ATIVIDADES`
   - `SHEET_URL_GERAL`

> Observação: sem as `SHEET_URL_*`, a conexão com o Supabase funciona, mas a carga automática ficará parcial/sem dados.

## 6) Teste rápido de conexão via API REST

Com variáveis carregadas no terminal, rode:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/projects?select=id,code,name&limit=1" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY"
```

Se retornar JSON (mesmo `[]`), a conexão/autenticação está OK.
