import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

function run(cmd, args, options = {}) {
  const safeArgs = [...args];
  const passwordIndex = safeArgs.findIndex((arg) => arg === '--password' || arg === '-p');
  if (passwordIndex >= 0 && safeArgs[passwordIndex + 1]) {
    safeArgs[passwordIndex + 1] = '***';
  }
  const printable = [cmd, ...safeArgs].join(' ');
  console.log(`\n> ${printable}`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Falha ao executar: ${printable}`);
  }
}

function parseProjectRef(url) {
  try {
    const host = new URL(url).hostname;
    return host.split('.')[0] || '';
  } catch {
    return '';
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const projectRef = process.env.SUPABASE_PROJECT_REF || parseProjectRef(supabaseUrl);
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';
const dbPassword = process.env.SUPABASE_DB_PASSWORD || '';
const isDryRun = process.argv.includes('--dry-run');

if (!projectRef) {
  throw new Error(
    'Projeto não identificado. Defina SUPABASE_PROJECT_REF ou SUPABASE_URL no ambiente.'
  );
}
if (!accessToken) {
  throw new Error(
    'SUPABASE_ACCESS_TOKEN ausente. Gere em Supabase Dashboard > Account > Access Tokens.'
  );
}
if (!dbPassword) {
  throw new Error(
    'SUPABASE_DB_PASSWORD ausente. Use a senha do banco (Database password), não a service role key.'
  );
}

const env = { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken };

if (!existsSync('supabase/config.toml')) {
  run('npx', ['supabase', 'init', '--yes'], { env });
}

run('npx', ['supabase', 'link', '--project-ref', projectRef, '--password', dbPassword], { env });

const pushArgs = ['supabase', 'db', 'push', '--linked', '--include-all', '--password', dbPassword];
if (isDryRun) pushArgs.push('--dry-run');

run('npx', pushArgs, { env });

console.log('\nMigrações aplicadas com sucesso.');
