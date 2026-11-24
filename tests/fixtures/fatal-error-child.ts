import { writeSync } from 'node:fs';
import { createFatalErrorHandler } from '../../src/main/fatalError';

const scenario = process.argv[2];
process.on(
  'uncaughtException',
  createFatalErrorHandler({
    log: () => {
      writeSync(1, 'logged\n');
      if (scenario === 'log-fails') throw new Error('logging failed');
    },
    closeDatabase: () => {
      writeSync(1, 'closed\n');
      if (scenario === 'close-fails') throw new Error('close failed');
      if (scenario === 'reentrant') process.emit('uncaughtException', new Error('again'));
    },
    exit: (code) => {
      writeSync(1, `exit ${code}\n`);
      if (scenario === 'exit-fails') throw new Error('exit failed');
    },
    forceExit: (code) => process.exit(code),
  })
);
setImmediate(() => {
  throw new Error('fatal');
});
setTimeout(() => process.exit(0), 1000);
