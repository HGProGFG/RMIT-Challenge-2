import { spawn } from 'node:child_process';
console.log('LOCAL SIMULATION — synthetic identities, local AES-GCM keys and simulated approvals. No Tide network required.');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3000'], {
  stdio: 'inherit', env: { ...process.env, TIDE_SIMULATION: 'true', APP_ORIGIN: 'http://localhost:3000', NEXT_BUILD_DIR: '.next-simulation' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 1; });
