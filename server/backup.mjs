import {chmodSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {openStore} from './store.mjs';
const filename = path.join(os.tmpdir(), `mgtu-backup-${Date.now()}.sqlite`);
const db = openStore();
try {db.prepare('VACUUM INTO ?').run(filename); chmodSync(filename,0o600); console.log(filename);} finally {db.close();}
