// Configuración de build/serve sin dependencias ni edición de archivos TypeScript.
import { spawnSync } from 'node:child_process';
const comando = process.argv[2] || 'build';
const url = process.env.NG_APP_API_URL || 'http://localhost:8080';
try {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
} catch {
  console.error('NG_APP_API_URL debe ser una URL http(s) absoluta, sin credenciales, query ni fragmento.');
  process.exit(1);
}
const resultado = spawnSync(process.execPath, [
  'node_modules/@angular/cli/bin/ng.js', comando,
  `--define=NG_APP_API_URL=${JSON.stringify(url.replace(/\/+$/, ''))}`,
  ...process.argv.slice(3)
], { stdio: 'inherit', shell: false });
if (resultado.error) console.error(resultado.error.message);
process.exit(resultado.status ?? 1);
