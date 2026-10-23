// Configura el envío push en el proyecto Supabase VINCULADO (supabase link):
//   1. Genera un secreto aleatorio para que la base llame a send-push.
//   2. Lo guarda como secreto de la función (PUSH_DISPATCH_SECRET).
//   3. Guarda en Vault push_dispatch_secret y push_dispatch_url (los lee 0023_push_dispatch).
// El secreto no se imprime ni se escribe en el repo. Volver a correrlo lo rota.
// Hay que correrlo de nuevo después de cada `supabase db reset` (Vault se borra).
//
// Uso (desde la raíz del repo):  node supabase/scripts/configure-push.mjs
// Las claves VAPID se configuran aparte una sola vez (ver supabase/README.md).

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const supabase = process.platform === 'win32' ? 'supabase.cmd' : 'supabase';
const ref = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error('No hay un proyecto vinculado (supabase link).');

const secret = randomBytes(32).toString('base64url');
const url = `https://${ref}.supabase.co/functions/v1/send-push`;
const dir = mkdtempSync(join(tmpdir(), 'rokbox-push-'));

try {
  const envFile = join(dir, 'push.env');
  writeFileSync(envFile, `PUSH_DISPATCH_SECRET=${secret}\n`, { mode: 0o600 });
  execFileSync(supabase, ['secrets', 'set', '--env-file', envFile, '--project-ref', ref], {
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: process.platform === 'win32',
  });

  const sqlFile = join(dir, 'vault.sql');
  writeFileSync(sqlFile, `
do $$
declare v uuid;
begin
  select id into v from vault.secrets where name = 'push_dispatch_secret';
  if v is null then perform vault.create_secret('${secret}', 'push_dispatch_secret');
  else perform vault.update_secret(v, '${secret}'); end if;

  select id into v from vault.secrets where name = 'push_dispatch_url';
  if v is null then perform vault.create_secret('${url}', 'push_dispatch_url');
  else perform vault.update_secret(v, '${url}'); end if;
end $$;
`, { mode: 0o600 });
  execFileSync(supabase, ['db', 'query', '--linked', '-f', sqlFile], {
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: process.platform === 'win32',
  });

  console.log(`Push configurado en ${ref}: secreto rotado y URL ${url}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
