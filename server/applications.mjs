import nodemailer from 'nodemailer';
import {randomUUID} from 'node:crypto';
import {fail} from './policy.mjs';
import {digest} from './security.mjs';

const roles = {
  individual: ['Абитуриент · 11 класс','Абитуриент · 9 класс','Выпускник СПО','Поступающий в магистратуру','Родитель','Другой гость'],
  group: ['Учитель / классный руководитель','Представитель школы']
};
export function applicationService(db, {transport, env = process.env} = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    mail_status TEXT NOT NULL DEFAULT 'pending', mail_attempts INTEGER NOT NULL DEFAULT 0,
    mail_next_at INTEGER NOT NULL DEFAULT 0, mail_sent_at INTEGER, mail_error TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS applications_created ON applications(created_at DESC);
  CREATE INDEX IF NOT EXISTS applications_mail ON applications(mail_status,mail_next_at);`);
  const configured = !!(env.SMTP_HOST && env.MAIL_FROM && env.MAIL_TO);
  const port = Number(env.SMTP_PORT || 587), secure = env.SMTP_SECURE === 'true' || port === 465;
  const sender = transport || (configured ? nodemailer.createTransport({
    host:env.SMTP_HOST, port, secure, requireTLS:!secure,
    ...(env.SMTP_USER ? {auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD}} : {}),
    connectionTimeout:10000, greetingTimeout:10000, socketTimeout:20000,
    disableFileAccess:true, disableUrlAccess:true
  }) : null);
  let busy = false, stopping = false, active = Promise.resolve();
  const publicRow = row => ({id:row.id,...JSON.parse(row.payload),status:row.status,createdAt:row.created_at,
    mailStatus:row.mail_status,mailAttempts:row.mail_attempts,mailSentAt:row.mail_sent_at,mailError:row.mail_error});
  function submit(input, ip) {
    const text = (key,min,max) => {
      const value = typeof input[key] === 'string' ? input[key].trim() : '';
      if (value.length < min || value.length > max || /[\x00-\x1f\x7f]/.test(value)) fail(400,'Проверьте поле «' + key + '».');
      return value;
    };
    const requestId = text('requestId',36,36);
    if (!/^[a-f0-9-]{36}$/i.test(requestId) || typeof input.mode !== 'string' || !Object.hasOwn(roles,input.mode) || !roles[input.mode].includes(input.role)) fail(400,'Проверьте тип участия и роль.');
    if (input.consent !== true) fail(400,'Подтвердите согласие на обработку данных заявки.');
    const payload = {mode:input.mode,name:text('name',2,100),role:input.role,phone:text('phone',10,22),email:text('email',3,150),consent:true,consentVersion:'registration-2026-11'};
    if (!/^[+\d()\s-]+$/.test(payload.phone) || !/^\d{10,15}$/.test(payload.phone.replace(/\D/g,''))) fail(400,'Введите телефон: от 10 до 15 цифр.');
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(payload.email)) fail(400,'Проверьте электронную почту.');
    if (input.mode === 'group') {
      payload.school = text('school',2,200); payload.count = Number(input.count);
      if (!Number.isInteger(payload.count) || payload.count < 2 || payload.count > 500) fail(400,'Количество участников: от 2 до 500.');
    } else {
      const id = text('interest',0,100);
      const programs = JSON.parse(db.prepare('SELECT json FROM content WHERE id=1').get().json).programs;
      if (id && !programs[id]) fail(400,'Выберите направление из списка.');
      payload.interest = id ? programs[id].name : 'Пока выбираю';
    }
    const existing = db.prepare('SELECT id,payload FROM applications WHERE request_id=?').get(requestId);
    if (existing) {
      if (existing.payload !== JSON.stringify(payload)) fail(409,'Эта форма уже отправлена. Откройте новую форму для другой заявки.');
      return {id:existing.id};
    }
    const key = 'application:' + digest(ip), now=Date.now();
    const rate=db.prepare('SELECT * FROM login_limits WHERE key=?').get(key);
    if (rate && rate.reset_at > now && rate.attempts >= 5) fail(429,'Слишком много заявок. Повторите через 15 минут.');
    db.prepare('INSERT INTO login_limits(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END').run(key,now+900000,now,now);
    const id=randomUUID();
    db.prepare('INSERT INTO applications(id,request_id,payload,created_at,updated_at) VALUES(?,?,?,?,?)').run(id,requestId,JSON.stringify(payload),now,now);
    return {id};
  }
  function list({search='',status='',offset=0} = {}) {
    offset=Math.max(0,Math.min(1000000,Number(offset)||0));
    const filter = ['new','contacted','done'].includes(status) ? status : '';
    const query = String(search).slice(0,150);
    const where = "WHERE (?='' OR status=?) AND (?='' OR instr(lower(payload),lower(?))>0)";
    const args=[filter,filter,query,query];
    return {applications:db.prepare(`SELECT * FROM applications ${where} ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET ?`).all(...args,offset).map(publicRow),
      total:db.prepare(`SELECT count(*) AS n FROM applications ${where}`).get(...args).n,
      newCount:db.prepare("SELECT count(*) AS n FROM applications WHERE status='new'").get().n,
      mailConfigured:!!sender,offset};
  }
  function update(id,input) {
    if (!db.prepare('SELECT id FROM applications WHERE id=?').get(id)) fail(404,'Заявка не найдена.');
    if (input.retryMail === true) {
      const row=db.prepare('SELECT mail_status FROM applications WHERE id=?').get(id);
      if (row.mail_status === 'sent') fail(409,'Копия этой заявки уже отправлена.');
      db.prepare("UPDATE applications SET mail_status='pending',mail_attempts=0,mail_next_at=0,mail_error='',updated_at=? WHERE id=?").run(Date.now(),id);
    } else {
      if (!['new','contacted','done'].includes(input.status)) fail(400,'Неизвестный статус заявки.');
      db.prepare('UPDATE applications SET status=?,updated_at=? WHERE id=?').run(input.status,Date.now(),id);
    }
  }
  async function deliver() {
    if (!sender || busy || stopping) return;
    busy=true;
    try {
      const rows=db.prepare("SELECT * FROM applications WHERE mail_status='pending' AND mail_next_at<=? ORDER BY created_at LIMIT 5").all(Date.now());
      for (const row of rows) {
        const p=JSON.parse(row.payload);
        const text=[`Заявка № ${row.id}`,`Дата: ${new Date(row.created_at).toISOString()}`,`Участие: ${p.mode==='group'?'Групповое':'Личное'}`,`Имя: ${p.name}`,`Роль: ${p.role}`,`Телефон: ${p.phone}`,`Почта: ${p.email}`,
          ...(p.mode==='group'?[`Организация: ${p.school}`,`Участников: ${p.count}`]:[`Интерес: ${p.interest}`]),'Согласие на обработку данных заявки получено.',env.APP_ORIGIN ? `Админка: ${env.APP_ORIGIN}/admin.html` : ''].join('\n');
        try {
          const result=await sender.sendMail({from:env.MAIL_FROM,to:env.MAIL_TO,replyTo:p.email,subject:`МГТУ: новая заявка — ${p.mode==='group'?'группа':'личное участие'}`,text,messageId:`<application-${row.id}@mgtu.local>`});
          if (result.rejected?.length || !result.accepted?.length) throw Error('SMTP_REJECTED');
          db.prepare("UPDATE applications SET mail_status='sent',mail_attempts=mail_attempts+1,mail_sent_at=?,mail_error='' WHERE id=?").run(Date.now(),row.id);
        } catch (error) {
          const attempts=row.mail_attempts+1;
          const code=String(error.code || 'SMTP_ERROR').replace(/[^A-Z0-9_]/g,'').slice(0,40) || 'SMTP_ERROR';
          db.prepare('UPDATE applications SET mail_status=?,mail_attempts=?,mail_next_at=?,mail_error=? WHERE id=?').run(attempts>=5?'failed':'pending',attempts,Date.now()+Math.min(3600000,60000*2**(attempts-1)),code,row.id);
        }
      }
    } finally {busy=false;}
  }
  const flush = () => active = active.then(deliver);
  const timer=setInterval(()=>void flush(),10000); timer.unref();
  return {submit,list,update,flush,async stop(){stopping=true;clearInterval(timer);await active;sender?.close?.();}};
}
