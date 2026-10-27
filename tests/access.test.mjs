import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.mjs';
import {hashPassword} from '../server/security.mjs';

test('server enforces roles, content publication and account administration', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mgtu-auth-test-'));
  let app = await createApp({dataDir:directory});
  let base;
  const start = async () => {app.server.listen(0,'127.0.0.1'); await once(app.server,'listening'); base = `http://127.0.0.1:${app.server.address().port}`;};
  const stop = async () => {const done = once(app.server,'close'); app.server.close(); app.server.closeAllConnections(); await done;};
  t.after(async () => {if(app.server.listening)await stop(); const resolved=path.resolve(directory); assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep) && path.basename(resolved).startsWith('mgtu-auth-test-')); await rm(resolved,{recursive:true,force:true});});
  const adminId = randomUUID(), adminPassword = 'Administrator-test-47!';
  app.db.prepare("INSERT INTO users(id,login,name,role,password_hash,created_at,updated_at) VALUES(?,?,?,'admin',?,?,?)").run(adminId,'admin','Администратор',await hashPassword(adminPassword),Date.now(),Date.now());
  await start();
  async function request(url, {session, method='GET', data, origin=base, csrf=session?.csrf}={}) {
    const response = await fetch(base+url, {method,redirect:'manual',headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session.cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},body:data?JSON.stringify(data):undefined});
    return {status:response.status,headers:response.headers,data:response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text()};
  }
  async function login(login,password) {const result=await request('/api/login',{method:'POST',data:{login,password}});assert.equal(result.status,200,JSON.stringify(result.data));return {...result.data,cookie:result.headers.get('set-cookie').split(';')[0],cookieHeader:result.headers.get('set-cookie')};}
  let admin, editor, editorId;
  await t.test('anonymous access is blocked; session cookie and CSRF are enforced',async()=>{
    assert.equal((await request('/admin.html')).status,302);
    assert.equal((await request('/api/users')).status,401);
    assert.equal((await request('/api/content',{method:'PUT',data:{}})).status,401);
    assert.equal((await request('/api/login',{method:'POST',origin:'http://evil.example',data:{login:'admin',password:adminPassword}})).status,403);
    admin=await login('admin',adminPassword);
    assert.match(admin.cookieHeader,/HttpOnly/);assert.match(admin.cookieHeader,/SameSite=Strict/);assert.ok(!('password_hash' in admin.user));
    assert.equal((await request('/api/logout',{method:'POST',session:admin,csrf:'wrong'})).status,403);
    assert.equal((await request('/admin.html',{session:admin})).status,200);
  });
  await t.test('administrator creates editor; editor cannot list or administer users',async()=>{
    const result=await request('/api/users',{method:'POST',session:admin,data:{login:'editor',name:'Редактор',role:'editor',password:'Editor-password-47!',active:true}});
    assert.equal(result.status,201,JSON.stringify(result.data));editorId=result.data.user.id;
    assert.equal((await request('/api/users',{method:'POST',session:admin,data:{login:'EDITOR',name:'Дубликат',role:'editor',password:'Editor-password-47!',active:true}})).status,409);
    assert.equal((await request('/api/users',{method:'POST',session:admin,data:{login:'weak',name:'Слабый пароль',role:'admin',password:'123',active:true}})).status,400);
    editor=await login('editor','Editor-password-47!');
    assert.equal((await request('/api/users',{session:editor})).status,403);
    assert.equal((await request('/api/users',{method:'POST',session:editor,data:{login:'hacker',role:'admin'}})).status,403);
    assert.equal((await request('/api/users/'+editorId,{method:'PUT',session:editor,data:{role:'admin'}})).status,403);
    assert.equal((await request('/api/users/'+adminId,{method:'DELETE',session:editor})).status,403);
    const hash=app.db.prepare('SELECT password_hash FROM users WHERE id=?').get(editorId).password_hash;
    assert.match(hash,/^scrypt:/);assert.ok(!hash.includes('Editor-password'));
  });
  await t.test('editor saves only text; visitors see saved content; stale revisions are rejected',async()=>{
    const current=(await request('/api/content')).data;
    const content=structuredClone(current.content);content.title='Текст для всех посетителей';
    content.blocks.hero={elements:{register:{text:'Новый текст кнопки'}}};
    content.blocks['program-eco_tovaroved']={elements:{hint:{text:'Подробнее о направлении'}}};
    const id=Object.keys(content.programs).find(id=>content.programs[id].admission.rows.length);
    content.programs[id].name='Новое название';content.programs[id].admission.rows[0][0]='Очная форма';
    const saved=await request('/api/content',{method:'PUT',session:editor,data:{revision:current.revision,content}});
    assert.equal(saved.status,200,JSON.stringify(saved.data));
    assert.equal((await request('/api/content')).data.content.title,content.title);
    assert.equal((await request('/api/content',{method:'PUT',session:admin,data:current})).status,409);
  });
  await t.test('forged requests cannot change styles, URLs, photos, visibility, rows or metadata',async()=>{
    const current=(await request('/api/content')).data;
    const attempts=[c=>c.accent='#ffffff',c=>c.font='Arial',c=>c.sections.faq=false,c=>c.blocks.hero.style={padding:'80'},c=>c.blocks.hero.style={},c=>c.blocks.hero.elements.register.style={color:'#ffffff'},c=>c.blocks.hero.elements.register.href='https://example.com',c=>c.blocks.hero.elements.photo={src:'https://example.com/photo.jpg'},c=>Object.values(c.programs)[0].admission.rows.push(['new']),c=>Object.values(c.programs)[0].level='Магистратура',c=>Object.values(c.programs)[0].visible=false,c=>c.facts=['подмена структуры']];
    for(const mutate of attempts){const content=structuredClone(current.content);mutate(content);const response=await request('/api/content',{method:'PUT',session:editor,data:{revision:current.revision,content,role:'admin'}});assert.equal(response.status,403,JSON.stringify(response.data));}
    assert.equal((await request('/api/content')).data.revision,current.revision);
    const allowed=structuredClone(current.content);allowed.accent='#ffffff';allowed.blocks.hero.style={padding:'25'};
    assert.equal((await request('/api/content',{method:'PUT',session:admin,data:{revision:current.revision,content:allowed}})).status,200);
  });
  await t.test('invalid content, prototype keys and cross-site writes are rejected',async()=>{
    const current=(await request('/api/content')).data;
    const content=structuredClone(current.content);content.blocks.hero.elements.register.href='javascript:alert(1)';
    assert.equal((await request('/api/content',{method:'PUT',session:admin,data:{revision:current.revision,content}})).status,400);
    assert.equal((await request('/api/content',{method:'PUT',session:admin,origin:'http://evil.example',data:current})).status,403);
    assert.equal((await request('/api/content',{method:'PUT',session:admin,data:JSON.parse('{"__proto__":{"admin":true}}')})).status,400);
    assert.equal({}.admin,undefined);
  });
  await t.test('blocking, role changes and password resets revoke existing sessions',async()=>{
    const update=async fields=>request('/api/users/'+editorId,{method:'PUT',session:admin,data:{login:'editor',name:'Редактор',role:'editor',active:true,...fields}});
    assert.equal((await update({active:false})).status,200);
    assert.equal((await request('/api/session',{session:editor})).status,401);
    assert.equal((await request('/api/login',{method:'POST',data:{login:'editor',password:'Editor-password-47!'}})).status,401);
    assert.equal((await update({active:true})).status,200);
    assert.equal((await request('/api/session',{session:editor})).status,401);
    editor=await login('editor','Editor-password-47!');
    assert.equal((await update({role:'admin'})).status,200);assert.equal((await request('/api/session',{session:editor})).status,401);
    editor=await login('editor','Editor-password-47!');assert.equal(editor.user.role,'admin');
    assert.equal((await update({role:'editor',password:'Replacement-password-47!'})).status,200);
    assert.equal((await request('/api/session',{session:editor})).status,401);
    assert.equal((await request('/api/login',{method:'POST',data:{login:'editor',password:'Editor-password-47!'}})).status,401);
    editor=await login('editor','Replacement-password-47!');
    assert.equal(editor.user.role,'editor');
    app.db.prepare('UPDATE sessions SET expires_at=? WHERE user_id=?').run(Date.now()-1,editorId);
    assert.equal((await request('/api/session',{session:editor})).status,401);
    editor=await login('editor','Replacement-password-47!');
  });
  await t.test('administrator cannot remove own access; account password change and logout invalidate sessions',async()=>{
    assert.equal((await request('/api/users/'+adminId,{method:'DELETE',session:admin})).status,400);
    assert.equal((await request('/api/users/'+adminId,{method:'PUT',session:admin,data:{login:'admin',name:'Администратор',role:'editor',active:true}})).status,400);
    assert.equal((await request('/api/password',{method:'PUT',session:editor,data:{currentPassword:'wrong',password:'Another-password-47!'}})).status,400);
    assert.equal((await request('/api/password',{method:'PUT',session:editor,data:{currentPassword:'Replacement-password-47!',password:'Another-password-47!'}})).status,200);
    assert.equal((await request('/api/session',{session:editor})).status,401);
    editor=await login('editor','Another-password-47!');
    assert.equal((await request('/api/logout',{method:'POST',session:editor})).status,200);
    assert.equal((await request('/api/session',{session:editor})).status,401);
  });
  await t.test('login throttling is enforced; users and published content survive restart',async()=>{
    for(let i=0;i<8;i++)assert.equal((await request('/api/login',{method:'POST',data:{login:'missing',password:'incorrect'}})).status,401);
    assert.equal((await request('/api/login',{method:'POST',data:{login:'missing',password:'incorrect'}})).status,429);
    await stop();app=await createApp({dataDir:directory});await start();
    assert.equal((await request('/api/content')).data.content.title,'Текст для всех посетителей');
    admin=await login('admin',adminPassword);assert.equal((await request('/api/users',{session:admin})).data.users.length,2);
    assert.equal((await request('/api/login',{method:'POST',data:{login:'missing',password:'incorrect'}})).status,429);
    assert.equal((await request('/api/users/'+editorId,{method:'DELETE',session:admin})).status,200);
    assert.equal((await request('/api/login',{method:'POST',data:{login:'editor',password:'Another-password-47!'}})).status,401);
  });
});
