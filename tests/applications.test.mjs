import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.mjs';
import {hashPassword} from '../server/security.mjs';

test('applications persist, enforce permissions and deliver queued mail with retries',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'mgtu-applications-test-'));
 const sent=[];let failMail=false;
 const mailOptions={env:{MAIL_FROM:'sender@example.test',MAIL_TO:'team@example.test'},transport:{async sendMail(message){if(failMail)throw Object.assign(Error('private server detail'),{code:'ECONNECTION'});sent.push(message);return {accepted:['team@example.test'],rejected:[]};}}};
 let app=await createApp({dataDir:directory,mailOptions}),base;
 const start=async()=>{app.server.listen(0,'127.0.0.1');await once(app.server,'listening');base=`http://127.0.0.1:${app.server.address().port}`;};
 const stop=async()=>{await app.applications.stop();const closed=once(app.server,'close');app.server.close();app.server.closeAllConnections();await closed;await new Promise(resolve=>setImmediate(resolve));};
 t.after(async()=>{if(app.server.listening)await stop();assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(directory).startsWith('mgtu-applications-test-'));await rm(directory,{recursive:true,force:true});});
 for(const role of ['admin','editor'])app.db.prepare('INSERT INTO users(id,login,name,role,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),role,role,role,await hashPassword('Test-password-123!'),Date.now(),Date.now());
 await start();
 const request=async(url,{method='GET',data,auth,origin=base}={})=>{
  const r=await fetch(base+url,{method,headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.csrf}:{})},body:data?JSON.stringify(data):undefined});
  return {status:r.status,data:await r.json(),headers:r.headers};
 };
 const login=async name=>{const r=await request('/api/login',{method:'POST',data:{login:name,password:'Test-password-123!'}});return {...r.data,cookie:r.headers.get('set-cookie').split(';')[0]};};
 const admin=await login('admin'),editor=await login('editor');
 const entry=()=>({requestId:randomUUID(),mode:'individual',name:'Тестовый участник',role:'Абитуриент · 11 класс',phone:'+7 (900) 123-45-67',email:'guest@example.test',interest:'',consent:true});
 let id,submission=entry();
 await t.test('valid submission is saved, mailed once and safely retried by client',async()=>{
  const r=await request('/api/applications',{method:'POST',data:submission});assert.equal(r.status,201);id=r.data.id;
  await app.applications.flush();assert.equal(sent.length,1);assert.match(sent[0].text,/Тестовый участник/);assert.equal(sent[0].to,'team@example.test');assert.equal(sent[0].replyTo,'guest@example.test');
  assert.equal((await request('/api/applications',{method:'POST',data:submission})).data.id,id);await app.applications.flush();assert.equal(sent.length,1);
  assert.equal((await request('/api/applications',{method:'POST',data:{...submission,name:'Другое имя'}})).status,409);
 });
 await t.test('anonymous and editor cannot read or process participant contacts',async()=>{
  assert.equal((await request('/api/applications')).status,401);
  assert.equal((await request('/api/applications',{auth:editor})).status,403);
  assert.equal((await request('/api/applications/'+id,{method:'PUT',auth:editor,data:{status:'done'}})).status,403);
  assert.equal((await request('/api/applications/'+id,{method:'PUT',auth:admin,data:{status:'contacted'}})).status,200);
  const r=await request('/api/applications?status=contacted&search=guest',{auth:admin});assert.equal(r.data.total,1);assert.equal(r.data.applications[0].mailStatus,'sent');assert.equal(r.data.newCount,0);
 });
 await t.test('invalid fields, absent consent and cross-site posts are rejected',async()=>{
  for(const patch of [{consent:false},{phone:'123'},{email:'a\r\nb@example.test'},{mode:'bad'},{role:'admin'},{interest:'unknown'},{mode:'group',role:'Учитель / классный руководитель',school:'Школа',count:501}])assert.equal((await request('/api/applications',{method:'POST',data:{...entry(),...patch}})).status,400);
  assert.equal((await request('/api/applications',{method:'POST',origin:'https://evil.test',data:entry()})).status,403);
 });
 await t.test('mail outage never loses group registrations; retry succeeds',async()=>{
  failMail=true;const r=await request('/api/applications',{method:'POST',data:{...entry(),mode:'group',role:'Представитель школы',school:'Тестовая школа',count:25}});assert.equal(r.status,201);
  await app.applications.flush();let row=app.db.prepare('SELECT * FROM applications WHERE id=?').get(r.data.id);assert.equal(row.mail_status,'pending');assert.equal(row.mail_attempts,1);assert.equal(row.mail_error,'ECONNECTION');
  assert.equal(JSON.parse(row.payload).count,25);
  for(let i=0;i<4;i++){app.db.prepare('UPDATE applications SET mail_next_at=0 WHERE id=?').run(row.id);await app.applications.flush();}
  row=app.db.prepare('SELECT * FROM applications WHERE id=?').get(row.id);assert.equal(row.mail_status,'failed');
  failMail=false;assert.equal((await request('/api/applications/'+row.id,{method:'PUT',auth:admin,data:{retryMail:true}})).status,200);await app.applications.flush();
  assert.equal(app.db.prepare('SELECT mail_status FROM applications WHERE id=?').get(row.id).mail_status,'sent');
  assert.match(sent.at(-1).text,/Участников: 25/);
 });
 await t.test('rate limits and server restart preserve applications and pending copies',async()=>{
  for(let i=0;i<3;i++)assert.equal((await request('/api/applications',{method:'POST',data:entry()})).status,201);
  assert.equal((await request('/api/applications',{method:'POST',data:entry()})).status,429);
  await stop();app=await createApp({dataDir:directory,mailOptions:{env:{}}});await start();
  assert.equal(app.applications.list().total,5);assert.equal(app.applications.list().mailConfigured,false);
  const pending=entry();app.db.prepare("DELETE FROM login_limits WHERE key LIKE 'application:%'").run();
  assert.equal((await request('/api/applications',{method:'POST',data:pending})).status,201);await app.applications.flush();
  assert.equal(app.applications.list().total,6);assert.equal(app.applications.list().applications.filter(r=>r.mailStatus==='pending').length,1);
 });
});
