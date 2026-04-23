# CROMiaOS

SaaS operacional para agência de marketing com:
- Frontend: React + Vite
- Backend: Express (TypeScript)
- Banco/Auth: Supabase
- Arquivos: Google Drive API (OAuth pessoal ou Service Account)
- IA: OpenAI + pgvector (Supabase)

## 1. Pré-requisitos
- Node.js 20+
- Projeto Supabase ativo
- Google Drive API habilitada no Google Cloud
- Chave da OpenAI

## 2. Ambiente
1. Copie `.env.example` para `.env`
2. Preencha todas as variáveis

### Google Drive com conta pessoal (sem Workspace)
Use OAuth2 no backend:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`
- `GOOGLE_OAUTH_ACCESS_TOKEN` (opcional, fallback temporário)
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`

Fluxo para gerar `refresh_token`:
1. No Google Cloud Console, crie credencial OAuth Client.
2. Em OAuth Playground, abra o ícone de configuração e marque `Use your own OAuth credentials`.
3. Informe seu `client_id` e `client_secret`.
4. Selecione o escopo `https://www.googleapis.com/auth/drive`.
5. Autorize e troque o código por tokens.
6. Copie o `refresh_token` para o `.env`.

## 3. Banco de dados
No SQL Editor do Supabase:
1. Execute `supabase_schema.sql`
2. Crie um usuário admin no Auth
3. Ajuste a role desse usuário em `profiles.role = 'admin'`

## 4. Rodar local
```bash
npm install
npm run dev
```

Servidor: `http://localhost:3000`  
Healthcheck: `http://localhost:3000/health`

## 5. Build produção
```bash
npm run build
npm run start
```

## 6. Endpoints principais
- `/api/auth`
- `/api/clientes`
- `/api/kanban`
- `/api/tasks`
- `/api/financeiro`
- `/api/dashboard`
- `/api/files`
- `/api/portal`
- `/api/admin`
- `/api/ai`
