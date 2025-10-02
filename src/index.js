const { spawn } = require('node:child_process');
const path = require('node:path');

const WORKER_PATH = path.join(__dirname, 'worker.js');
const RESTART_CODE = 5;

let childProcess = null;

function startWorker() {
  childProcess = spawn(process.execPath, [WORKER_PATH], {
    stdio: 'inherit',
  });

  childProcess.on('exit', (code, signal) => {
    childProcess = null;

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    if (code === RESTART_CODE) {
      console.log('[Launcher] Restart requested. Spawning a new worker...');
      startWorker();
      return;
    }

    if (code === 0) {
      console.log('[Launcher] Worker stopped gracefully.');
      process.exit(0);
      return;
    }

    console.error(`[Launcher] Worker exited with code ${code}.`);
    process.exit(code ?? 1);
  });
}

function handleShutdown() {
  if (childProcess) {
    childProcess.kill('SIGINT');
  }
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

startWorker();
