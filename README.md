# 👑 CROMiaOS 1.0
> **Enterprise Marketing Ecosystem** | SaaS operacional para gestão avançada de agências.

O **CROMiaOS** é um ecossistema robusto projetado para centralizar a operação, o financeiro e a comunicação de agências de marketing de alto nível, integrando fluxos de trabalho inteligentes e inteligência artificial.

---

## 🛠️ Stack Tecnológica

* **Frontend:** React + Vite (Foco em performance e UX)
* **Backend:** Node.js + Express (TypeScript)
* **Banco de Dados:** Supabase (PostgreSQL)
* **Autenticação:** Supabase Auth
* **Storage:** Google Drive API (Integração direta para ativos de clientes)
* **Inteligência Artificial:** OpenAI + `pgvector` (RAG - Retrieval-Augmented Generation)

---

## 📋 Pré-requisitos

Antes de iniciar o setup, garante que tens:
- **Node.js** v20 ou superior
- **Instância no Supabase** ativa
- **Google Cloud Project** com a *Google Drive API* habilitada
- **API Key da OpenAI**

---

## ⚙️ Configuração do Ambiente

1.  **Instalação de Dependências:**
    ```bash
    npm install
    ```

2.  **Variáveis de Ambiente:**
    Copia o ficheiro de exemplo e preenche as tuas credenciais:
    ```bash
    cp .env.example .env
    ```

### 📂 Integração com Google Drive (OAuth2)
Para utilizar contas pessoais (sem Workspace), segue o fluxo de `refresh_token`:

1.  No **Google Cloud Console**, cria um *OAuth Client ID* (Web Application).
2.  Acede ao [Google OAuth Playground](https://developers.google.com/oauthplayground/).
3.  Nas definições (ícone engrenagem), marca **"Use your own OAuth credentials"** e insere o teu `client_id` e `client_secret`.
4.  Seleciona o scope `https://www.googleapis.com/auth/drive`.
5.  Autoriza, faz o "Exchange authorization code for tokens" e copia o **`refresh_token`** para o teu `.env`.

---

## 🗄️ Estrutura de Dados

1.  **Schema:** Executa o script `supabase_schema.sql` no SQL Editor do teu projeto Supabase.
2.  **Permissões:** Após criar o teu utilizador no Auth, define a role administrativa:
    ```sql
    UPDATE profiles SET role = 'admin' WHERE email = 'teu-email@exemplo.com';
    ```

---

## 🚀 Execução

### Ambiente de Desenvolvimento
```bash
<<<<<<< Updated upstream
npm run dev
=======
npm run dev
>>>>>>> Stashed changes
