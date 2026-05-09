# TAP - Guia de funcionalidades e implantação em outro projeto

> **Objetivo deste arquivo:** servir como instrução copiável para levar a funcionalidade de **TAP - Termo de Abertura do Projeto** deste projeto para outra **MAIN/projeto**.
> Copie este Markdown para a pasta de documentos da TAP no projeto de destino e use o bloco **"Prompt pronto para colar no Codex"** para orientar a implementação.

---

## 1. O que a TAP deve entregar

A tela de TAP deve funcionar como um módulo de cadastro, consulta e manutenção dos Termos de Abertura de Projeto, com persistência no Supabase e vínculo ao projeto ativo da MAIN/Cockpit.

### Funcionalidades obrigatórias

1. **Dashboard de TAPs cadastradas**
   - Exibir cards de TAPs em grade responsiva.
   - Mostrar contador de TAPs filtradas.
   - Abrir o formulário de edição ao clicar em um card.
   - Exibir estado vazio quando não houver TAP cadastrada.

2. **Cadastro de nova TAP**
   - Botão **Nova TAP** abre modal de formulário.
   - Formulário deve salvar a TAP no Supabase.
   - Após salvar, recarregar a lista e fechar o modal.

3. **Edição de TAP existente**
   - Clique no card carrega todos os dados no formulário.
   - Botão de salvar deve mudar para **Atualizar TAP**.
   - Atualização deve usar `PATCH` no registro do Supabase.

4. **Exclusão de TAP**
   - Na edição, exibir botão **Excluir**.
   - Exclusão deve usar `DELETE` no registro do Supabase.
   - Após excluir, recarregar a lista e fechar o modal.

5. **Filtros laterais**
   - Filtros por:
     - Cliente
     - GPP
     - Criticidade do cliente
     - Projeto em perda
   - Exibir badges de filtros ativos.
   - Permitir remover filtro individualmente.
   - Permitir limpar todos os filtros.

6. **Multi-seleção de clientes**
   - Campo **Cód. Cliente** deve aceitar múltiplos clientes por checkbox.
   - Deve permitir adicionar novo código de cliente dinamicamente.
   - O campo deve alimentar um array `codCliente` no payload.

7. **Selects dinâmicos**
   - Campos como projeto, GPP, coordenador, ESN e arquiteto devem ter lista pré-carregada.
   - Deve existir opção para cadastrar novo item diretamente no formulário.
   - Novo item deve entrar na lista e ficar selecionado.

8. **Produtos do escopo**
   - Lista de produtos disponíveis com busca.
   - Área de produtos selecionados.
   - Permitir adicionar produto customizado.
   - Cada produto selecionado deve aceitar detalhes como módulos, licença, serviços e observações.

9. **Campos financeiros e cronograma**
   - Capturar valores comerciais, margens, MRR, PSA, investimentos, datas e observações.
   - Manter todos os dados no `payload` JSON da TAP para facilitar evolução do formulário sem migration a cada novo campo.

10. **Integração Supabase**
    - Ler configuração da MAIN/Cockpit via `localStorage.totvs_cockpit_config` ou `window.parent.config`.
    - Resolver URL Supabase mesmo quando usuário informar dashboard `app.supabase.com` ou `projectRef`.
    - Tentar credenciais na ordem: `service_role`, `publishableKey`, `anonKey`.
    - Usar tabela `projects` para resolver/criar o projeto ativo.
    - Usar tabela `tap_entries` para persistir as TAPs.
    - Mostrar erro amigável e botão para detalhes técnicos quando houver falha.

---

## 2. Arquitetura recomendada

A implementação pode ser feita em página única HTML/JS, ou adaptada para React/Vue/Next. Independentemente da tecnologia, mantenha estes blocos lógicos:

```text
TAP Page
├─ Header do módulo
├─ Dashboard / cards
├─ Sidebar de filtros
├─ Modal de formulário
├─ Toast de feedback
├─ Modal de log técnico de erro
└─ Camada JS/serviço Supabase
   ├─ leitura de configuração da MAIN
   ├─ resolução do projeto ativo
   ├─ GET lista de TAPs
   ├─ POST nova TAP
   ├─ PATCH edição de TAP
   └─ DELETE exclusão de TAP
```

### Separação mínima sugerida em projetos maiores

```text
src/
├─ pages ou app/
│  └─ tap
├─ components/
│  ├─ TapCards
│  ├─ TapFilters
│  ├─ TapFormModal
│  └─ TapProductTransfer
├─ services/
│  └─ tapSupabaseService
└─ types/
   └─ tap
```

---

## 3. Estrutura de banco obrigatória

A TAP depende de duas entidades principais:

1. `projects`
   Guarda o projeto da MAIN/Cockpit.

2. `tap_entries`
   Guarda cada TAP vinculada ao projeto.

### SQL mínimo para a TAP

> Execute no SQL Editor do Supabase do projeto de destino. Se o outro projeto já tiver `projects`, ajuste apenas o necessário.

```sql
create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tap_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  identificacao text,
  data_referencia text,
  nome_projeto text,
  coordenador_projeto text,
  esn text,
  criticidade_cliente text,
  drive text,
  cod_cliente text,
  gpp text,
  produto text,
  arquiteto text,
  criticidade_totvs text,
  valor_projeto text,
  margem_venda_percentual text,
  margem_venda_valor text,
  mrr_recorrente_mensal text,
  mrr_total_contratados text,
  psa_planejado text,
  diferenca_psa_projeto text,
  receita_atual text,
  margem_atual_percentual text,
  margem_atual_valor text,
  investimento_perdas text,
  investimento_comercial text,
  investimento_erro_produto text,
  projeto_em_perda text,
  data_inicio text,
  go_live_previsao text,
  duracao text,
  pos_producao_meses text,
  encerramento text,
  descricao_escopo text,
  observacoes text,
  payload jsonb,
  created_at timestamptz not null default now()
);
```

### Por que manter `payload jsonb`

O formulário da TAP tem campos dinâmicos, arrays e objetos aninhados, por exemplo:

- `codCliente: string[]`
- `produtos: string[]`
- `detalhesProdutos: Record<string, object>`

Por isso, o front deve salvar o objeto completo no campo `payload`. As colunas textuais podem existir para relatórios futuros, mas o fluxo principal deve considerar `payload` como fonte de verdade.

---

## 4. Configuração esperada da MAIN/Cockpit

A tela deve buscar configuração primeiro no `localStorage` e, se estiver em iframe, no `window.parent.config`.

### Chave local

```js
localStorage.setItem('totvs_cockpit_config', JSON.stringify({
  activeProjectId: 'ROSSI-PMO',
  projects: [
    { id: 'ROSSI-PMO', name: 'Rossi Supermercados' }
  ],
  supabase: {
    url: 'https://SEU-PROJECT-REF.supabase.co',
    projectRef: 'SEU-PROJECT-REF',
    schema: 'public',
    projectsTable: 'projects',
    tapTable: 'tap_entries',
    secret: 'SUA_SERVICE_ROLE_KEY',
    publishableKey: 'SUA_PUBLISHABLE_KEY',
    anonKey: 'SUA_ANON_KEY'
  }
}));
```

### Campos mínimos para funcionar

```text
supabase.url ou supabase.projectRef
supabase.secret ou supabase.publishableKey ou supabase.anonKey
activeProjectId
projects[].id
projects[].name
```

> Para escrita direta via REST sem autenticação de usuário, use preferencialmente `service_role` em ambiente controlado. Em produção pública, implemente autenticação e políticas RLS adequadas.

---

## 5. Modelo de payload da TAP

Use este objeto como contrato mínimo entre formulário e banco:

```js
const tapData = {
  id: currentEditId || Date.now().toString(),
  dataTap: '',
  codCliente: [],
  nomeProjeto: '',
  gpp: '',
  coordenador: '',
  esn: '',
  arquiteto: '',
  criticidadeCliente: 'MÉDIA',
  criticidadeTotvs: 'MÉDIA',
  drive: '',
  produtos: [],
  detalhesProdutos: {},
  valorProjeto: '',
  receitaAtual: '',
  margemVenda: '',
  margemAtual: '',
  margemVendaValor: '',
  margemAtualValor: '',
  mrrMensal: '',
  investimentoPerdas: '',
  mrrTotal: '',
  investimentoComercial: '',
  psaPlanejado: '',
  investimentoErro: '',
  diferencaPsa: '',
  projetoEmPerda: 'Não',
  dataInicio: '',
  goLive: '',
  duracao: '',
  posProducao: '',
  encerramento: '',
  observacao: ''
};
```

---

## 6. Fluxos técnicos obrigatórios

### 6.1 Carregar TAPs

1. Descobrir `projectCode` pela query string `primaryProject` ou pelo `activeProjectId`.
2. Consultar `projects?code=eq.<projectCode>&select=id,code&limit=1`.
3. Se não existir e for apenas carregamento, retornar lista vazia.
4. Consultar `tap_entries?project_id=eq.<projectId>&select=id,payload,created_at&order=created_at.desc.nullslast`.
5. Transformar cada linha em `{ ...payload, id: row.id, _dbId: row.id }`.
6. Renderizar os cards.

### 6.2 Criar TAP

1. Validar campos obrigatórios.
2. Montar `tapData`.
3. Resolver/criar projeto em `projects`.
4. Enviar:

```http
POST /rest/v1/tap_entries
Prefer: return=representation,resolution=merge-duplicates
Content-Type: application/json
```

```json
[
  {
    "project_id": "UUID_DO_PROJETO",
    "payload": { "nomeProjeto": "..." }
  }
]
```

### 6.3 Editar TAP

```http
PATCH /rest/v1/tap_entries?id=eq.UUID_DA_TAP
```

```json
{
  "project_id": "UUID_DO_PROJETO",
  "payload": { "nomeProjeto": "..." }
}
```

### 6.4 Excluir TAP

```http
DELETE /rest/v1/tap_entries?id=eq.UUID_DA_TAP
```

---

## 7. Regras de UI e experiência

- Usar feedback visual para salvar, atualizar, excluir e erro.
- Em erro, mostrar mensagem curta no toast e permitir abrir log técnico.
- O card deve destacar criticidade:
  - `ALTA`: vermelho
  - `MÉDIA`: teal/azul-verde
  - `BAIXA`: verde
- Se `projetoEmPerda === 'Sim'`, exibir badge de perda no card.
- Datas devem ser exibidas no padrão `dd/mm/yyyy`.
- Modal deve bloquear scroll do body enquanto estiver aberto.
- Filtros devem recalcular o contador de cards.

---

## 8. Checklist de implantação no projeto de destino

- [ ] Criar ou copiar a página `tap.html` ou componente equivalente.
- [ ] Adicionar entrada no menu da MAIN/Cockpit apontando para a TAP.
- [ ] Executar SQL da tabela `tap_entries` e garantir tabela `projects`.
- [ ] Configurar Supabase no `localStorage.totvs_cockpit_config` ou no objeto global da MAIN.
- [ ] Garantir que `activeProjectId` do Cockpit existe em `projects` ou pode ser criado automaticamente.
- [ ] Testar SELECT em `projects`.
- [ ] Testar SELECT em `tap_entries`.
- [ ] Criar uma TAP.
- [ ] Editar a TAP criada.
- [ ] Excluir a TAP criada.
- [ ] Testar filtros por cliente, GPP, criticidade e perda.

---

## 9. Prompt pronto para colar no Codex do outro projeto

Copie o bloco abaixo e cole no Codex do projeto de destino.

```text
Preciso implementar o módulo TAP - Termo de Abertura do Projeto neste projeto, seguindo estas regras:

1. Criar uma página ou componente de TAP com:
   - Dashboard de cards de TAPs cadastradas.
   - Botão Nova TAP.
   - Modal de cadastro/edição.
   - Botão excluir apenas em modo edição.
   - Sidebar de filtros por cliente, GPP, criticidade do cliente e projeto em perda.
   - Badges de filtros ativos e opção de limpar filtros.
   - Toast de sucesso/erro e modal de log técnico.

2. Formulário da TAP deve conter no mínimo:
   - Cód. Cliente com multi-seleção e opção de adicionar novo código.
   - Data da TAP.
   - Nome do Projeto.
   - GPP.
   - Coordenador.
   - ESN.
   - Arquiteto.
   - Criticidade Cliente: ALTA, MÉDIA, BAIXA.
   - Criticidade TOTVS: ALTA, MÉDIA, BAIXA.
   - Drive.
   - Produtos do escopo com lista disponível, busca, seleção e produto customizado.
   - Detalhes por produto: módulos, licença, serviços, observações.
   - Valor Projeto.
   - Receita Atual.
   - Margem Venda %.
   - Margem Atual %.
   - Margem Venda Valor.
   - Margem Atual Valor.
   - MRR Mensal.
   - MRR Total.
   - PSA Planejado.
   - Diferença PSA x Projeto.
   - Investimento Perdas.
   - Investimento Comercial.
   - Investimento Erro Produto.
   - Projeto em Perda: Sim/Não.
   - Data Início.
   - Go-live previsto.
   - Duração.
   - Pós-produção meses.
   - Encerramento.
   - Observação.

3. Persistência Supabase:
   - Usar REST API do Supabase.
   - Ler config de `localStorage.totvs_cockpit_config` e, se existir, de `window.parent.config`.
   - Resolver base URL por `supabase.url`, `supabase.apiUrl` ou `supabase.projectRef`.
   - Aceitar correção de URL do dashboard `app.supabase.com/project/<ref>` para `https://<ref>.supabase.co`.
   - Usar credenciais na ordem: `supabase.secret` ou `supabase.serviceRole`, depois `supabase.publishableKey`, depois `supabase.anonKey`.
   - Usar schema `supabase.schema || 'public'`.
   - Usar tabela de projetos `supabase.projectsTable || 'projects'`.
   - Usar tabela de TAP `supabase.tapTable || 'tap_entries'`.

4. Banco de dados:
   - Garantir tabela `projects` com `id uuid`, `code text unique`, `name text`, `created_at`.
   - Garantir tabela `tap_entries` com `id uuid`, `project_id uuid references projects(id) on delete cascade`, `payload jsonb`, `created_at` e colunas textuais opcionais para relatório.
   - O front deve salvar a TAP completa no campo `payload`.

5. Fluxos:
   - Ao abrir a tela, resolver projeto ativo por query string `primaryProject` ou `activeProjectId`.
   - Carregar TAPs por `project_id`.
   - Nova TAP: `POST tap_entries` com `{ project_id, payload }`.
   - Editar TAP: `PATCH tap_entries?id=eq.<id>` com `{ project_id, payload }`.
   - Excluir TAP: `DELETE tap_entries?id=eq.<id>`.
   - Após qualquer escrita, recarregar lista.

6. UX:
   - Cards com cor por criticidade: ALTA vermelho, MÉDIA teal, BAIXA verde.
   - Badge "PERDA" quando `projetoEmPerda` for "Sim".
   - Datas em `dd/mm/yyyy`.
   - Estado vazio quando não houver TAP.
   - Contador de TAPs filtradas.

Antes de alterar arquivos, inspecione a estrutura do projeto, descubra onde ficam páginas, componentes, rotas e configuração global. Depois implemente a TAP de forma compatível com o padrão do projeto atual. Ao final, liste os arquivos alterados e os testes executados.
```

---

## 10. Testes manuais recomendados

### Teste 1 - Configuração ausente

1. Limpe `localStorage.totvs_cockpit_config`.
2. Abra a TAP.
3. A tela deve exibir erro amigável de Supabase não configurado ao tentar carregar/salvar.

### Teste 2 - Criação

1. Configure Supabase corretamente.
2. Clique **Nova TAP**.
3. Preencha campos obrigatórios.
4. Salve.
5. Card deve aparecer no dashboard.
6. Registro deve existir em `tap_entries` com `payload` preenchido.

### Teste 3 - Edição

1. Clique no card criado.
2. Altere criticidade, produto ou valor.
3. Salve.
4. Card deve refletir alteração.
5. `payload` no Supabase deve ser atualizado.

### Teste 4 - Exclusão

1. Abra uma TAP existente.
2. Clique **Excluir**.
3. Card deve sumir.
4. Registro deve ser removido de `tap_entries`.

### Teste 5 - Filtros

1. Crie TAPs com clientes e GPPs diferentes.
2. Filtre por cliente.
3. Filtre por GPP.
4. Filtre por criticidade.
5. Filtre por projeto em perda.
6. Valide contador e badges ativos.

---

## 11. Observações importantes

- Se o projeto de destino for público, não exponha `service_role` no navegador. Use autenticação, RLS e/ou backend intermediário.
- Se a MAIN já tiver padrão visual próprio, reaproveite os componentes do projeto e mantenha apenas os fluxos funcionais da TAP.
- Se o projeto já tiver tabela de projetos com outro nome, configure `supabase.projectsTable`.
- Se quiser trocar o nome da tabela TAP, configure `supabase.tapTable`.
- O campo `payload` deve ser preservado para evitar quebra quando novos campos forem adicionados no futuro.
