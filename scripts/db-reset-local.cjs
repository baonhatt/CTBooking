// Empties the LOCAL D1 database used by `wrangler dev --local` (worker/.wrangler/state/v3/d1).
// The old local files are first copied to worker/.wrangler/state-backup-<time>/ (that folder is git-ignored).
// It never touches the remote (production or preview) database.
const fs = require('fs');
const path = require('path');

const d1Folder = path.join('worker', '.wrangler', 'state', 'v3', 'd1');
if (!fs.existsSync(d1Folder)) {
  console.log('No local D1 database yet, nothing to reset.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFolder = path.join('worker', '.wrangler', 'state-backup-' + stamp);
fs.cpSync(d1Folder, backupFolder, { recursive: true });
fs.rmSync(d1Folder, { recursive: true, force: true });
console.log('Old local D1 copied to ' + backupFolder + ' and cleared.');
