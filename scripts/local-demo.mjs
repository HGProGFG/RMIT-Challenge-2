import { spawn } from 'node:child_process';
console.log('PLAN C — demo accounts, local AES-GCM and simulated approvals. No Tide login or activation.');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3000'], {
  stdio: 'inherit', env: { ...process.env, APP_ORIGIN: 'http://localhost:3000', NEXT_BUILD_DIR: '.next-simulation' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 1; });
