# 🛡️ Setup - Auditoria Automática do Google Drive

## Arquivos Criados

### 1. Edge Function (Backend - Deno)
**Localização**: `supabase/functions/auditoria-drive/index.ts`

Funcionalidades:
- ✅ Renomeia pastas para CAIXA ALTA
- ✅ Cria pastas oficiais faltantes (01_LOGO, 02_FOTOS, etc.)
- ✅ Move arquivos soltos para pastas corretas baseado na extensão
- ✅ Suporte completo a CORS

Pastas Criadas:
- `01_LOGO` (extensões: ai, eps, svg, cdr)
- `02_FOTOS` (extensões: jpg, jpeg, png, webp)
- `03_EDITAVEIS` (extensões: psd, fig)
- `04_CONTRATOS` (extensões: pdf, doc, docx)
- `05_ANUNCIOS` (extensões: mp4, mov)
- `06_AUDIO` (extensões: mp3)
- `06_OUTROS` (arquivos não mapeados)

### 2. Componente React (Frontend)
**Localização**: `src/components/BotaoAuditoriaDrive.tsx`

Props:
```tsx
interface BotaoAuditoriaDriveProps {
  folderIdDoCliente: string;           // ID da pasta no Google Drive
  onAuditoriaCompleta?: () => void;    // Callback para refresh (opcional)
}
```

## 🔐 Step 1: Configurar Secrets no Supabase

### Converter google.json para Base64

**Windows (PowerShell)**:
```powershell
$json = Get-Content "google.json" -Raw
$base64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
Write-Output $base64 | clip
```

**Mac/Linux (Terminal)**:
```bash
cat google.json | base64 | pbcopy
# ou
base64 -i google.json -o - | xclip -selection clipboard
```

### Adicionar à Supabase

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para **Project Settings** → **Secrets**
4. Clique em **Add Secret**
5. Nome: `GOOGLE_SERVICE_ACCOUNT_BASE64`
6. Valor: Cole o Base64 gerado acima
7. Clique em **Save**

## 🚀 Step 2: Deploy da Edge Function

### Opção 1: CLI do Supabase (Recomendado)

```bash
# Install CLI if needed
npm install -g supabase

# Login
supabase login

# Deploy
supabase functions deploy auditoria-drive
```

### Opção 2: Dashboard Supabase

1. Vá para **Edge Functions** no dashboard
2. Clique em **Create Function**
3. Nome: `auditoria-drive`
4. Copie o código de `supabase/functions/auditoria-drive/index.ts`
5. Configure os Secrets (veja Step 1)
6. Deploy será automático

## 💻 Step 3: Usar o Componente no Frontend

### Exemplo de Uso em DrivePage.tsx

```tsx
import BotaoAuditoriaDrive from '@/components/BotaoAuditoriaDrive';

export default function DrivePage() {
  const [clienteFolderId, setClienteFolderId] = useState('');
  const [files, setFiles] = useState([]);

  const recarregarArquivos = async () => {
    // Sua lógica para recarregar a lista de arquivos
    const novosDados = await fetchFiles(clienteFolderId);
    setFiles(novosDados);
  };

  return (
    <div className="space-y-4">
      {/* Seu componente de visualização de arquivos */}
      <div>
        {/* Arquivos aqui */}
      </div>

      {/* Botão Auditoria */}
      <div className="flex gap-2">
        <BotaoAuditoriaDrive 
          folderIdDoCliente={clienteFolderId}
          onAuditoriaCompleta={recarregarArquivos}
        />
      </div>
    </div>
  );
}
```

## 📊 Fluxo de Execução

```
Cliente clica no botão
         ↓
Confirmação via alert
         ↓
Frontend chama supabase.functions.invoke('auditoria-drive')
         ↓
Edge Function recebe clienteFolderId
         ↓
Decodifica GOOGLE_SERVICE_ACCOUNT_BASE64
         ↓
Autentica com Google Drive API
         ↓
PASSO 1: Renomeia pastas para CAIXA ALTA
PASSO 2: Cria pastas oficiais faltantes
PASSO 3: Move arquivos soltos para pastas corretas
         ↓
Retorna relatório com estatísticas
         ↓
Frontend exibe sucesso/erro
         ↓
Callback executa refresh (se fornecido)
```

## ✅ Checklist de Implementação

- [ ] Converter `google.json` para Base64
- [ ] Adicionar secret `GOOGLE_SERVICE_ACCOUNT_BASE64` no Supabase
- [ ] Deploy da Edge Function via CLI ou Dashboard
- [ ] Importar `BotaoAuditoriaDrive` no componente desejado
- [ ] Fornecer props `folderIdDoCliente` e callback `onAuditoriaCompleta`
- [ ] Testar a auditoria em ambiente de desenvolvimento

## 🐛 Troubleshooting

### Erro: "Credenciais do Google não configuradas nas Secrets"
- Verifique se o secret `GOOGLE_SERVICE_ACCOUNT_BASE64` foi criado
- Confirme que o valor foi salvo corretamente (sem quebras de linha)
- Redeploy a Edge Function após adicionar o secret

### Erro: "CORS policy: No 'Access-Control-Allow-Origin' header"
- Verifique se a função tem `verify_jwt: true` (padrão)
- Os headers CORS já estão configurados no código

### Erro: "Google Drive API not enabled"
- Acesse [Google Cloud Console](https://console.cloud.google.com)
- Confirme que a API do Drive está ativada para o projeto

## 📝 Notas Adicionais

- A Edge Function usa Deno (runtime padrão do Supabase)
- Todas as operações são feitas com a conta de serviço do Google
- Os usuários precisam ter acesso à pasta no Google Drive
- A auditoria é idempotente (seguro executar múltiplas vezes)

---

**Criado em**: 8 de Abril de 2026
**Documentação**: [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
