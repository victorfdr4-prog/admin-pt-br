#!/bin/bash
# Script para converter google.json em Base64 e copiar para clipboard
# Subapse Edge Functions - Auditoria Drive

echo ""
echo "============================================"
echo "Conversor Google Service Account para Base64"
echo "============================================"
echo ""

# Verificar se google.json existe
if [ ! -f "google.json" ]; then
    echo "ERRO: Arquivo google.json não encontrado!"
    echo "Por favor, coloque o arquivo google.json no mesmo diretório deste script."
    exit 1
fi

# Converter para Base64
echo "Lendo google.json e convertendo para Base64..."
echo ""

if command -v pbcopy &> /dev/null; then
    # macOS
    base64_content=$(cat google.json | base64)
    echo "$base64_content" | pbcopy
    echo "✅ Base64 copiado para o clipboard!"
elif command -v xclip &> /dev/null; then
    # Linux
    base64_content=$(cat google.json | base64 -w 0)
    echo -n "$base64_content" | xclip -selection clipboard
    echo "✅ Base64 copiado para o clipboard!"
elif command -v xsel &> /dev/null; then
    # Linux alternativo
    base64_content=$(cat google.json | base64 -w 0)
    echo -n "$base64_content" | xsel --clipboard --input
    echo "✅ Base64 copiado para o clipboard!"
else
    # Sem clipboard, apenas exibe
    echo "⚠️  Nenhum gerenciador de clipboard encontrado."
    echo "Base64 gerado:"
    echo ""
    cat google.json | base64 -w 0
    echo ""
fi

echo ""
echo "Próximos passos:"
echo "1. Acesse: https://app.supabase.com"
echo "2. Selecione seu projeto (CromiaOS)"
echo "3. Vá para: Project Settings → Secrets"
echo "4. Clique em: Add Secret"
echo "5. Nome: GOOGLE_SERVICE_ACCOUNT_BASE64"
echo "6. Valor: Cole o conteúdo (Ctrl+V ou Cmd+V)"
echo "7. Clique em: Save"
echo ""
echo "✅ A Edge Function já foi deployada automaticamente!"
echo ""
