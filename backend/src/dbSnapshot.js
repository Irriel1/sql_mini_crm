const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME } = require('./config');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function createSnapshot() {
  const snapshotDir = path.join(__dirname, '..', 'db', 'snapshots');
  fs.mkdirSync(snapshotDir, { recursive: true });

  const filePath = path.join(snapshotDir, `${DB_NAME}-${timestamp()}.sql`);

  // Snapshot je prvni krok pred destruktivnim `db:reset`.
  // MYSQL_PWD pouzivame proto, aby heslo nebylo zbytecne videt primo v argumentech prikazu.
  const result = spawnSync(
    'mysqldump',
    [
      '--skip-lock-tables',
      '--skip-add-locks',
      '--no-tablespaces',
      '--set-gtid-purged=OFF',
      '--routines',
      '--triggers',
      '-h',
      DB_HOST,
      '-P',
      String(DB_PORT),
      '-u',
      DB_USER,
      DB_NAME,
    ],
    {
      env: { ...process.env, MYSQL_PWD: DB_PASS },
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024,
    }
  );

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error('mysqldump failed');
  }

  fs.writeFileSync(filePath, result.stdout, 'utf8');
  console.log(`DB snapshot created: ${filePath}`);
}

try {
  createSnapshot();
} catch (err) {
  console.error('DB snapshot failed:', err.message);
  process.exitCode = 1;
}
