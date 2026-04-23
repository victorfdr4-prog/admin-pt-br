@echo off
REM Script para converter google.json em Base64 e copiar para a área de transferência
REM Desenvolvido para Supabase Edge Functions

setlocal enabledelayedexpansion

echo.
echo ============================================
echo Conversor Google Service Account para Base64
echo ============================================
echo.

REM Verificar se google.json existe
if not exist "google.json" (
    echo ERRO: Arquivo google.json nao encontrado!
    echo Por favor, coloque o arquivo google.json no mesmo diretorio deste script.
    pause
    exit /b 1
)

REM Converter para Base64 usando PowerShell
echo Lendo google.json e convertendo para Base64...
echo.

powershell -Command "^
    try { ^
        $json = Get-Content 'google.json' -Raw; ^
        $base64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json)); ^
        Write-Output $base64 | clip; ^
        Write-Host '✅ Base64 copiado para a area de transferencia!' -ForegroundColor Green; ^
        Write-Host '' ; ^
        Write-Host 'Proximos passos:' -ForegroundColor Yellow; ^
        Write-Host '1. Acesse: https://app.supabase.com' ; ^
        Write-Host '2. Selecione seu projeto (CromiaOS)' ; ^
        Write-Host '3. Vá para: Project Settings → Secrets' ; ^
        Write-Host '4. Clique em: Add Secret' ; ^
        Write-Host '5. Nome: GOOGLE_SERVICE_ACCOUNT_BASE64' ; ^
        Write-Host '6. Valor: Cole o conteudo do clipboard (Ctrl+V)' ; ^
        Write-Host '7. Clique em: Save' ; ^
        Write-Host '' ; ^
        Write-Host 'A Edge Function ja foi deployada automaticamente!' -ForegroundColor Green; ^
    } catch { ^
        Write-Host 'ERRO ao converter arquivo!' -ForegroundColor Red; ^
        Write-Host $_.Exception.Message; ^
    } ^
"

echo.
pause
