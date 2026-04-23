d// validateSystem.js

import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import dotenv from 'dotenv'

dotenv.config()

console.log('🚀 INICIANDO VALIDAÇÃO COMPLETA...\n')

// ==========================
// 🔐 ENV CHECK
// ==========================
function checkEnv() {
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_SERVICE_ACCOUNT',
    'GOOGLE_DRIVE_ROOT_FOLDER_ID'
  ]

  console.log('🔍 Verificando ENV...')

  required.forEach(key => {
    if (!process.env[key]) {
      console.error(`❌ FALTA: ${key}`)
    } else {
      console.log(`✅ OK: ${key}`)
    }
  })
}

// ==========================
// 🧠 SUPABASE TEST
// ==========================
async function testSupabase() {
  console.log('\n🧠 Testando Supabase...')

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .limit(1)

    if (error) throw error

    console.log('✅ Supabase conectado')
  } catch (err) {
    console.error('❌ Erro Supabase:', err.message)
  }
}

// ==========================
// 🔐 AUTH TEST
// ==========================
async function testAuth() {
  console.log('\n🔐 Testando Auth...')

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )

    const { data, error } = await supabase.auth.getSession()

    if (error) throw error

    console.log('✅ Auth funcionando')
  } catch (err) {
    console.error('❌ Erro Auth:', err.message)
  }
}

// ==========================
// ☁️ GOOGLE DRIVE TEST
// ==========================
async function testDrive() {
  console.log('\n☁️ Testando Google Drive...')

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT)

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    })

    const drive = google.drive({ version: 'v3', auth })

    const res = await drive.files.get({
      fileId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
      fields: 'id, name'
    })

    console.log(`✅ Drive OK: ${res.data.name}`)
  } catch (err) {
    console.error('❌ Erro Drive:', err.message)
  }
}

// ==========================
// 📁 TESTE CRIAÇÃO DE PASTA
// ==========================
async function testCreateFolder() {
  console.log('\n📁 Testando criação de pasta...')

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT)

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    })

    const drive = google.drive({ version: 'v3', auth })

    const folder = await drive.files.create({
      requestBody: {
        name: '[TESTE]_CROMIA',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID]
      }
    })

    console.log('✅ Pasta criada:', folder.data.id)
  } catch (err) {
    console.error('❌ Erro criação pasta:', err.message)
  }
}

// ==========================
// 📦 TESTE UPLOAD
// ==========================
async function testUpload() {
  console.log('\n📦 Testando upload...')

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT)

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    })

    const drive = google.drive({ version: 'v3', auth })

    const fileMetadata = {
      name: 'teste.txt',
      parents: [process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID]
    }

    const media = {
      mimeType: 'text/plain',
      body: 'Teste Cromia'
    }

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media
    })

    console.log('✅ Upload OK:', file.data.id)
  } catch (err) {
    console.error('❌ Erro upload:', err.message)
  }
}

// ==========================
// 🧠 EXECUÇÃO TOTAL
// ==========================
async function runValidation() {
  checkEnv()
  await testSupabase()
  await testAuth()
  await testDrive()
  await testCreateFolder()
  await testUpload()

  console.log('\n🔥 VALIDAÇÃO FINALIZADA')
}

runValidation()