import {readFile, writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {parseEnv} from 'node:util';

const dockerFile = new URL('../.env.postgresql', import.meta.url);
const appFile = new URL('../.env', import.meta.url);
let docker;
try { docker = parseEnv(await readFile(dockerFile, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  docker = {POSTGRES_PASSWORD: randomBytes(32).toString('base64url'), POSTGRES_PORT: '5433'};
  await writeFile(dockerFile, `POSTGRES_PASSWORD=${docker.POSTGRES_PASSWORD}\nPOSTGRES_PORT=${docker.POSTGRES_PORT}\n`, {flag: 'wx', mode: 0o600});
}
if (!docker.POSTGRES_PASSWORD || !/^\d+$/.test(docker.POSTGRES_PORT || '5433')) throw new Error('Cấu hình .env.postgresql không hợp lệ.');
let app = '';
try { app = await readFile(appFile, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!parseEnv(app).DATABASE_URL) {
  const uri = `postgresql://net_museum:${encodeURIComponent(docker.POSTGRES_PASSWORD)}@127.0.0.1:${docker.POSTGRES_PORT || '5433'}/net_museum`;
  await writeFile(appFile, app.trimEnd() + `\n\n# PostgreSQL Docker for local development\nDATABASE_URL=${uri}\nPG_SCHEMA=net_museum\n`, {mode: 0o600});
  console.log('Đã thêm DATABASE_URL vào .env; giữ nguyên cấu hình Cloudinary. Không in mật khẩu.');
} else console.log('DATABASE_URL đã có; giữ nguyên cấu hình hiện tại.');
console.log('Cấu hình Docker: .env.postgresql (không đưa lên Git).');
