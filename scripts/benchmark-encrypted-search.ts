import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { DatabaseService } from '../src/main/database';
import { AesGcmNoteCipher, generateDataEncryptionKey } from '../src/main/crypto';

const db = new DatabaseService(':memory:');
try {
  for (let i = 0; i < 500; i++) {
    db.createNote({
      title: `Note ${i}`,
      content_plain: `${'hello '.repeat(120)} needle ${i}`,
      content_html: '<p>body</p>',
      is_open: 0,
    });
  }
  db.enableEncryption(new AesGcmNoteCipher(generateDataEncryptionKey()), 'wrapped');
  for (let run = 0; run < 7; run++) {
    const start = performance.now();
    for (let query = 0; query < 10; query++) {
      assert.equal(db.getNotePreviews({ search: 'needle', offset: 450, limit: 50 }).length, 50);
    }
    process.stdout.write(`${(performance.now() - start) / 10}\n`);
  }
} finally {
  db.close();
}
