# 🛡️ AUDITORIA DRIVE - INSTRUÇÕES DE DEPLOYMENT

## ✅ STATUS: PRONTO PARA DEPLOY

Todos os arquivos foram criados e o componente foi integrado automaticamente em `DrivePage.tsx`.

---

## 📋 PASSO 1: Adicionar Secret no Supabase Dashboard

### Vá para:
**https://app.supabase.com** → Seu Projeto → **Project Settings** → **Secrets**

### Clique em "Add Secret"

**Nome**: `GOOGLE_SERVICE_ACCOUNT_BASE64`

**Valor** (copie exatamente):
```
eyJ3ZWIiOnsiY2xpZW50X2lkIjoiMjA2OTYwODc4MjA2LTQyczUxNnQxMGUxZjV2OGpzcTA2ZmdmYmVyMDJzbHVoLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwicHJvamVjdF9pZCI6Imdlbi1sYW5nLWNsaWVudC0wMzk5OTIzNTYyIiwiYXV0aF91cmkiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsInRva2VuX3VyaSI6Imh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwiYXV0aF9wcm92aWRlcl94NTA5X2NlcnRfdXJsIjoiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vb2F1dGgyL3YxL2NlcnRzIiwiY2xpZW50X3NlY3JldCI6IkdPQ1NQWC11eTRWeHI4TWVEaHp1dGx0UjFpVC1Oc0FrT0FNIiwicmVkaXJlY3RfdXJpcyI6WyJodHRwczovL2JyY3JodG51YnN2cWltZHRjY3loLnN1cGFiYXNlLmNvL2F1dGgvdjEvY2FsbGJhY2siXSwiamF2YXNjcmlwdF9vcmlnaW5zIjpbImh0dHBzOi8vY3JvbWlhY29tdW5pY2FjYW8uY29tIl19fQ==
```

**Clique em "Save"** ✅

---

## 🚀 PASSO 2: Deploy via Supabase CLI (Automático)

Execute este comando:
```bash
supabase functions deploy auditoria-drive
```

Ou se não tem a CLI:
```bash
npm install -g supabase
supabase login
supabase functions deploy auditoria-drive
```

---

## 📍 PASSO 3: Verificar Integração

O componente **já está integrado** em `src/pages/DrivePage.tsx`:
- ✅ Importação adicionada: `import BotaoAuditoriaDrive from '@/components/BotaoAuditoriaDrive'`
- ✅ Método de callback: `handleAuditoriaCompleta()`
- ✅ Botão aparece no topo da página quando um cliente é selecionado

---

## 🧪 TESTE RÁPIDO

1. Abra a página de Drive
2. Selecione um cliente
3. Clique no botão amarelo 🛡️ **Reorganizar & Validar Padrão**
4. Confirme na caixa de diálogo
5. Aguarde a auditoria completar
6. Página recarrega automaticamente com os arquivos organizados

---

## 📁 ARQUIVOS MODIFICADOS/CRIADOS

```
✅ NOVO: supabase/functions/auditoria-drive/index.ts
✅ NOVO: src/components/BotaoAuditoriaDrive.tsx
✅ MODIFICADO: src/pages/DrivePage.tsx
✅ MODIFICADO: AUDITORIA-DRIVE-SETUP.md (documentação completa)
```

---

## ⚙️ Próximos Passos

1. **Copie o Base64** acima
2. **Adicione no Supabase**: Project Settings → Secrets → Add Secret
3. **Execute deploy**: `supabase functions deploy auditoria-drive`
4. **Teste no navegador**: Abra a página Drive e teste o botão

---

## 💡 O QUE O BOTÃO FA

✅ **Renomeia pastas** para CAIXA ALTA (Logo → 01_LOGO)
✅ **Cria pastas oficiais** faltantes 
✅ **Organiza arquivos** na pasta correta baseado na extensão
✅ **Relatório detalhado** com estatísticas
✅ **Recarrega página** automaticamente após sucesso

---

**Criado**: 8 de Abril de 2026
**Status**: 🟢 PRONTO PARA PRODUÇÃO
