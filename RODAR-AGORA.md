# 🚀 CROMIA Admin - Como Rodar 100% Funcional

## ✅ Build está pronto em `admin/dist`

---

## 🎯 Para rodar COMPLETO (Frontend + Backend + Supabase):

### Opção 1: **Desenvolvimento Local**
```bash
cd admin
npm install
npm start
```
- Frontend: http://localhost:3000/admin/
- Backend API: http://localhost:3000/api/
- Tudo funciona local!

### Opção 2: **Produção em Servidor**

#### 📋 Pré-requisitos:
- Node.js 18+ instalado
- Credenciais Supabase configuradas (já estão em `.env.production`)

#### 🚀 Passos:

1. **Copie a pasta `admin` completa para seu servidor**

2. **No servidor, configure o ambiente:**
   ```bash
   cd admin
   # Rename .env.production to .env:
   cp .env.production .env
   ```

3. **Instale as dependências:**
   ```bash
   npm install --production
   ```

4. **Inicie o servidor:**
   ```bash
   npm start
   ```
   Ou com PM2 para produção:
   ```bash
   npm install -g pm2
   pm2 start npm --name "cromia-admin" -- start
   pm2 save
   ```

5. **Acesse:**
   - `http://seu-servidor:3000/admin/`
   - Ou configure proxy reverso (nginx/Apache) para usar domínio próprio

---

## 🔐 Credenciais de Teste

**Usuário:** victorteles
**Senha:** Nathalia10203040##

---

## 🛠️ Troubleshooting

### ❌ "Cannot read properties of undefined (reading 'access_token')"
**Solução:** Backend não está rodando. Execute `npm start` no terminal.

### ❌ "SUPABASE_ANON_KEY não configurada"
**Solução:** Verifique se `.env.production` foi renomeado para `.env`

### ❌ Porta 3000 já em uso
**Solução:** Mude a porta:
```bash
PORT=8080 npm start
```

### ❌ "Cannot find module"
**Solução:** Execute `npm install` novamente

---

## 📁 Estrutura

```
admin/
├── dist/              ✓ Frontend React (já buildado)
├── backend/           ✓ Rotas Express (login, clientes, etc)
├── src/               ✓ Código fonte React
├── package.json       ✓ Dependências
├── server.ts          ✓ Servidor Node.js
├── .env.production    ✓ Variáveis configuradas
└── README.md          ← Você está aqui
```

---

## ✨ O que funciona quando rodar:

✅ Login (com Supabase)
✅ Dashboard completo
✅ Gerenciamento de clientes
✅ Financeiro
✅ Drive (Google)
✅ Kanban
✅ Relatórios
✅ Perfil/Configurações

---

## 🎬 Quick Start (3 comandos):

```bash
cd admin
npm install
npm start
```

Pronto! Acesse http://localhost:3000/admin/ 🎉

---

**Qualquer erro, me avise!** 💬
