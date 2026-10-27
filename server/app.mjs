import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {openStore, projectRoot, transaction, publicUser, audit} from './store.mjs';
import {token, digest, validLogin, validPassword, hashPassword, verifyPassword, safeEqual} from './security.mjs';
import {HttpError, fail, validateJson, validateContent, changedFields, canEditText} from './policy.mjs';

const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ttf':'font/ttf','.ico':'image/x-icon'};
const SESSION_MS = 8 * 60 * 60 * 1000;
function json(res, status, data, headers = {}) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
  res.end(JSON.stringify(data));
}
async function body(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) fail(415, 'Ожидается JSON.');
  const max = 2 * 1024 * 1024;
  if (Number(req.headers['content-length']) > max) {req.resume(); fail(413, 'Слишком большой запрос.');}
  const text = await new Promise((resolve, reject) => {
    const chunks = []; let size = 0, exceeded = false;
    req.on('data', chunk => {size += chunk.length; if (size > max) {exceeded = true; chunks.length = 0; reject(new HttpError(413, 'Слишком большой запрос.'));} else if (!exceeded) chunks.push(chunk);});
    req.on('end', () => {if (!exceeded) resolve(Buffer.concat(chunks).toString('utf8'));});
    req.on('error', reject);
  });
  let value; try {value = JSON.parse(text);} catch {fail(400, 'Некорректный JSON.');}
  validateJson(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Ожидается объект.');
  return value;
}

export async function createApp({dataDir, origin = process.env.APP_ORIGIN || '', secureCookies = process.env.COOKIE_SECURE === 'true' || origin.startsWith('https://'), sessionMs = SESSION_MS} = {}) {
  if (origin && new URL(origin).origin !== origin) throw Error('APP_ORIGIN должен содержать только протокол, хост и порт, без завершающего слеша.');
  if (process.env.NODE_ENV === 'production' && !origin) throw Error('Укажите APP_ORIGIN, например http://172.17.254.145:6065');
  const db = openStore(dataDir), root = path.join(projectRoot, 'dist');
  const dummyHash = await hashPassword(token());
  let loginJobs = 0;
  const cookie = (value, maxAge = sessionMs / 1000) => `mgtu_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAge)}${secureCookies ? '; Secure' : ''}`;
  function session(req) {
    const value = /(?:^|;\s*)mgtu_session=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (!value) return null;
    return db.prepare('SELECT u.*,s.csrf,s.token_hash,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').get(digest(value), Date.now()) || null;
  }
  function sameOrigin(req) {
    const expected = origin || `http://${req.headers.host}`;
    if (req.headers.origin !== expected || req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'Запрос с другого сайта отклонён.');
  }
  const requireAdmin = user => {if (user.role !== 'admin') fail(403, 'Это действие доступно только администратору.');};
  const adminCount = () => db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin' AND active=1").get().count;
  function limit(key, maximum) {
    const current = db.prepare('SELECT * FROM login_limits WHERE key=?').get(key);
    if (current && current.reset_at > Date.now() && current.attempts >= maximum) fail(429, 'Слишком много попыток входа. Повторите через 15 минут.');
  }
  function failedLogin(keys) {
    const now = Date.now();
    db.prepare('DELETE FROM login_limits WHERE reset_at<?').run(now);
    for (const key of keys) db.prepare('INSERT INTO login_limits(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').run(key, now + 15 * 60 * 1000);
  }
  function userFields(input) {
    if (!validLogin(input.login) || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100 || !['admin','editor'].includes(input.role) || typeof input.active !== 'boolean') fail(400, 'Проверьте логин, имя, роль и состояние пользователя.');
    return {login: input.login.toLowerCase(), name: input.name.trim(), role: input.role, active: Number(input.active)};
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
    try {
      const url = new URL(req.url, 'http://local'), pathname = decodeURIComponent(url.pathname), method = req.method;
      if (pathname === '/healthz' && ['GET','HEAD'].includes(method)) {res.writeHead(200, {'Content-Type':'text/plain','Cache-Control':'no-store'}); return res.end('ok\n');}
      if (pathname === '/api/content' && method === 'GET') {
        const row = db.prepare('SELECT * FROM content WHERE id=1').get();
        return json(res, 200, {content: JSON.parse(row.json), revision: row.revision});
      }
      if (pathname === '/api/session' && method === 'GET') {
        const user = session(req);
        if (!user) return json(res, 401, {error: 'Войдите в редактор.', needsSetup: db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0});
        return json(res, 200, {user: publicUser(user), csrf: user.csrf});
      }
      if (pathname === '/api/login' && method === 'POST') {
        sameOrigin(req);
        const input = await body(req);
        const login = typeof input.login === 'string' ? input.login.trim().toLowerCase() : '';
        const ipKey = 'ip:' + digest(req.socket.remoteAddress || 'unknown'), loginKey = 'login:' + digest(login);
        limit(ipKey, 60); limit(loginKey, 8);
        if (loginJobs >= 4) fail(429, 'Сервер занят. Повторите вход через несколько секунд.');
        loginJobs++;
        let user, verified;
        try {user = db.prepare('SELECT * FROM users WHERE login=? COLLATE NOCASE').get(login); verified = await verifyPassword(input.password, user?.password_hash || dummyHash);} finally {loginJobs--;}
        // Re-read after hashing: an administrator may have blocked or reset this account meanwhile.
        const current = user && db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
        if (!verified || !current?.active || current.password_hash !== user.password_hash) {failedLogin([ipKey, loginKey]); fail(401, 'Неверный логин или пароль.');}
        const value = token(), csrf = token();
        transaction(db, () => {
          const previous = session(req); if (previous) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(previous.token_hash);
          db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
          db.prepare('INSERT INTO sessions(token_hash,user_id,csrf,expires_at,created_at) VALUES(?,?,?,?,?)').run(digest(value), current.id, csrf, Date.now() + sessionMs, Date.now());
          db.prepare('DELETE FROM login_limits WHERE key=?').run(loginKey);
          audit(db, current.id, 'login');
        });
        return json(res, 200, {user: publicUser(current), csrf}, {'Set-Cookie': cookie(value)});
      }
      if (pathname.startsWith('/api/')) {
        const user = session(req);
        if (!user) fail(401, 'Сессия завершена. Войдите снова.');
        if (!['GET','HEAD'].includes(method)) {sameOrigin(req); if (!safeEqual(req.headers['x-csrf-token'], user.csrf)) fail(403, 'Обновите страницу и повторите действие.');}
        if (pathname === '/api/logout' && method === 'POST') {
          db.prepare('DELETE FROM sessions WHERE token_hash=?').run(user.token_hash);
          return json(res, 200, {ok: true}, {'Set-Cookie': cookie('', 0)});
        }
        if (pathname === '/api/password' && method === 'PUT') {
          const input = await body(req);
          if (!validPassword(input.password)) fail(400, 'Пароль должен содержать не менее 12 символов и не более 256 байт.');
          if (!await verifyPassword(input.currentPassword, user.password_hash)) fail(400, 'Текущий пароль указан неверно.');
          const hashed = await hashPassword(input.password);
          transaction(db, () => {if (!session(req)) fail(401, 'Войдите снова.'); db.prepare('UPDATE users SET password_hash=?,updated_at=? WHERE id=?').run(hashed, Date.now(), user.id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id); audit(db, user.id, 'password-change');});
          return json(res, 200, {ok:true, loginRequired:true}, {'Set-Cookie': cookie('', 0)});
        }
        if (pathname === '/api/content' && method === 'PUT') {
          const input = await body(req);
          validateContent(input.content);
          transaction(db, () => {
            const actor = session(req); if (!actor) fail(401, 'Сессия завершена. Войдите снова.');
            const row = db.prepare('SELECT * FROM content WHERE id=1').get();
            if (!Number.isSafeInteger(input.revision) || input.revision !== row.revision) fail(409, 'Другой пользователь уже обновил сайт. Скопируйте свои правки и перезагрузите страницу.');
            const changes = changedFields(JSON.parse(row.json), input.content);
            if (actor.role !== 'admin' && changes.some(change => !canEditText(change))) fail(403, 'Редактор может изменять только текст. Оформление, ссылки, фотографии и структура доступны администратору.');
            db.prepare('UPDATE content SET json=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=1').run(JSON.stringify(input.content), Date.now(), user.id);
            audit(db, user.id, 'content-save');
          });
          const saved = db.prepare('SELECT json,revision FROM content WHERE id=1').get();
          return json(res, 200, {content: JSON.parse(saved.json), revision:saved.revision});
        }
        if (pathname === '/api/users' || pathname.startsWith('/api/users/')) {
          requireAdmin(user);
          if (pathname === '/api/users' && method === 'GET') return json(res, 200, {users:db.prepare('SELECT * FROM users ORDER BY created_at,login').all().map(publicUser)});
          if (pathname === '/api/users' && method === 'POST') {
            const input = await body(req), fields = userFields({...input, active: input.active ?? true});
            if (!validPassword(input.password)) fail(400, 'Пароль должен содержать не менее 12 символов и не более 256 байт.');
            const hashed = await hashPassword(input.password), id = randomUUID(), now = Date.now();
            transaction(db, () => {
              const actor = session(req); if (!actor || actor.role !== 'admin') fail(403, 'Недостаточно прав. Войдите снова.');
              if (db.prepare('SELECT id FROM users WHERE login=? COLLATE NOCASE').get(fields.login)) fail(409, 'Этот логин уже занят.');
              db.prepare('INSERT INTO users(id,login,name,role,password_hash,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(id, fields.login, fields.name, fields.role, hashed, fields.active, now, now);
              audit(db, user.id, 'user-create', id);
            });
            return json(res, 201, {user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id))});
          }
          const id = pathname.slice('/api/users/'.length);
          if (!/^[a-f0-9-]{36}$/.test(id)) fail(404, 'Пользователь не найден.');
          const target = db.prepare('SELECT * FROM users WHERE id=?').get(id);
          if (!target) fail(404, 'Пользователь не найден.');
          if (method === 'PUT') {
            const input = await body(req), fields = userFields(input);
            if (input.password && !validPassword(input.password)) fail(400, 'Пароль должен содержать не менее 12 символов и не более 256 байт.');
            const hashed = input.password ? await hashPassword(input.password) : null;
            transaction(db, () => {
              const actor = session(req); if (!actor || actor.role !== 'admin') fail(403, 'Недостаточно прав. Войдите снова.');
              const latest = db.prepare('SELECT * FROM users WHERE id=?').get(id); if (!latest) fail(404, 'Пользователь не найден.');
              if (id === user.id && (!fields.active || fields.role !== 'admin')) fail(400, 'Нельзя заблокировать себя или снять с себя роль администратора.');
              if (latest.role === 'admin' && latest.active && (!fields.active || fields.role !== 'admin') && adminCount() <= 1) fail(400, 'Должен остаться хотя бы один действующий администратор.');
              if (db.prepare('SELECT id FROM users WHERE login=? COLLATE NOCASE AND id<>?').get(fields.login, id)) fail(409, 'Этот логин уже занят.');
              db.prepare('UPDATE users SET login=?,name=?,role=?,active=?,password_hash=?,updated_at=? WHERE id=?').run(fields.login, fields.name, fields.role, fields.active, hashed || latest.password_hash, Date.now(), id);
              if (hashed || latest.role !== fields.role || latest.active !== fields.active || latest.login !== fields.login) db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
              audit(db, user.id, 'user-update', id);
            });
            return json(res, 200, {user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)), loginRequired:id === user.id && !!hashed});
          }
          if (method === 'DELETE') {
            transaction(db, () => {
              if (id === user.id) fail(400, 'Нельзя удалить собственную учётную запись.');
              if (target.role === 'admin' && target.active && adminCount() <= 1) fail(400, 'Нельзя удалить последнего администратора.');
              db.prepare('DELETE FROM users WHERE id=?').run(id); audit(db, user.id, 'user-delete', id);
            });
            return json(res, 200, {ok:true});
          }
        }
        fail(404, 'Действие не найдено.');
      }
      if (!['GET','HEAD'].includes(method)) fail(405, 'Метод не поддерживается.');
      if (['/admin','/admin/','/admin.html'].includes(pathname) && !session(req)) {res.writeHead(302, {Location:'/login.html','Cache-Control':'no-store'}); return res.end();}
      const relative = ['/admin','/admin/'].includes(pathname) ? '/admin.html' : pathname.endsWith('/') ? pathname + 'index.html' : pathname;
      const filename = path.resolve(root, '.' + relative);
      if (!filename.startsWith(root + path.sep) || relative.split('/').some(part => part.startsWith('.'))) fail(404, 'Файл не найден.');
      let file; try {file = await fs.readFile(filename);} catch {fail(404, 'Файл не найден.');}
      res.writeHead(200, {'Content-Type':mime[path.extname(filename)] || 'application/octet-stream','Cache-Control':'no-store'});
      res.end(method === 'HEAD' ? undefined : file);
    } catch (error) {
      if (!(error instanceof HttpError)) console.error('Request failed:', error.code || error.name);
      if (!res.headersSent) json(res, error instanceof HttpError ? error.status : 500, {error:error instanceof HttpError ? error.message : 'Не удалось выполнить действие. Повторите позже.'});
      else res.end();
    }
  });
  server.headersTimeout = 15000; server.requestTimeout = 30000;
  server.on('close', () => db.close());
  return {server, db};
}
