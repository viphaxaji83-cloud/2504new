import {createInterface} from 'node:readline/promises';
import {emitKeypressEvents} from 'node:readline';
import {randomUUID} from 'node:crypto';
import {openStore, transaction, audit} from './store.mjs';
import {validLogin, validPassword, hashPassword} from './security.mjs';

function password(prompt) {
  if (!process.stdin.isTTY) throw Error('Запустите команду в интерактивном терминале.');
  return new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write(prompt); emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
    const finish = () => {process.stdin.off('keypress', onKey); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n');};
    function onKey(text, key = {}) {
      if (key.ctrl && key.name === 'c') {finish(); reject(Error('Отменено.'));}
      else if (key.name === 'return') {finish(); resolve(value);}
      else if (key.name === 'backspace') value = value.slice(0, -1);
      else if (text && !key.ctrl && !key.meta && !text.includes('\x1b')) value += text;
    }
    process.stdin.on('keypress', onKey);
  });
}
let db;
try {
  let login = process.argv[2];
  if (!login) {const rl = createInterface({input:process.stdin, output:process.stdout}); login = await rl.question('Логин администратора: '); rl.close();}
  if (!validLogin(login)) throw Error('Логин: 3–80 символов, латинские буквы, цифры, _, -, . или @.');
  const first = await password('Пароль (не менее 12 символов, ввод скрыт): ');
  if (!validPassword(first)) throw Error('Пароль должен содержать не менее 12 символов и не более 256 байт.');
  if (first !== await password('Повторите пароль: ')) throw Error('Пароли не совпадают.');
  const hashed = await hashPassword(first); db = openStore();
  transaction(db, () => {
    const existing = db.prepare('SELECT * FROM users WHERE login=? COLLATE NOCASE').get(login);
    const now = Date.now();
    if (existing) {db.prepare("UPDATE users SET password_hash=?,role='admin',active=1,updated_at=? WHERE id=?").run(hashed, now, existing.id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id); audit(db, existing.id, 'admin-recovery', existing.id);}
    else {const id = randomUUID(); db.prepare("INSERT INTO users(id,login,name,role,password_hash,created_at,updated_at) VALUES(?,?,?,'admin',?,?,?)").run(id, login.toLowerCase(), login, hashed, now, now); audit(db, id, 'admin-bootstrap', id);}
  });
  console.log('Администратор готов. Войдите на /admin.html с указанным логином и паролем.');
} catch (error) {console.error(error.message); process.exitCode = 1;} finally {db?.close();}
