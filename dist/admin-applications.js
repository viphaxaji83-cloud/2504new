(() => {
 const esc=MGTU_escape;
 const statuses={new:'Новая',contacted:'Связались',done:'Обработана'};
 const mailStatuses={sent:'Отправлено',pending:'В очереди',failed:'Ошибка доставки'};
 let search='',status='',offset=0,version=0;
 const active=()=>!!document.querySelector('[data-view="applications"].active');
 const date=value=>new Date(value).toLocaleString('ru-RU');
 async function badge(){
  if(MGTU_currentUser?.role!=='admin')return;
  try {const result=await MGTU_api('/api/applications');document.querySelector('#applicationCount').textContent=result.newCount;}catch{}
 }
 window.MGTU_applications={async render(){
  const current=++version,panel=document.querySelector('#editorPanel');
  panel.innerHTML='<div class="editor-card"><p>Загружаем заявки…</p></div>';
  try {
   const result=await MGTU_api('/api/applications?'+new URLSearchParams({search,status,offset}));
   if(current!==version||!active())return;
   document.querySelector('#applicationCount').textContent=result.newCount;
   panel.innerHTML=`<div class="editor-card application-tools"><form id="applicationFilters"><label>Поиск по заявкам<input name="search" value="${esc(search)}" placeholder="Имя, телефон, почта или организация" maxlength="150"></label><label>Статус<select name="status"><option value="">Все статусы</option>${Object.entries(statuses).map(([key,label])=>`<option value="${key}" ${status===key?'selected':''}>${label}</option>`).join('')}</select></label><button class="button dark-button" type="submit">Найти</button><button class="button outline" type="button" data-app-refresh>Обновить</button></form><p>Найдено: ${result.total} · Новых: ${result.newCount}</p>${!result.mailConfigured?'<p class="mail-notice">Почта пока не подключена. Заявки сохраняются здесь, копии ожидают настройки SMTP на сервере.</p>':''}</div><div class="applications-list">${result.applications.length?result.applications.map(row=>`<details class="application-row"><summary><span>${esc(row.name)}<small>${esc(date(row.createdAt))} · ${row.mode==='group'?'Группа · '+row.count+' участников':'Личное участие'}</small></span><span class="role-badge">${statuses[row.status]}</span></summary><div class="application-body"><dl><dt>Телефон</dt><dd><a href="tel:${esc(row.phone.replace(/[^+\d]/g,''))}">${esc(row.phone)}</a></dd><dt>Почта</dt><dd><a href="mailto:${esc(row.email)}">${esc(row.email)}</a></dd><dt>Роль</dt><dd>${esc(row.role)}</dd>${row.mode==='group'?`<dt>Организация</dt><dd>${esc(row.school)}</dd><dt>Участников</dt><dd>${row.count}</dd>`:`<dt>Направление</dt><dd>${esc(row.interest)}</dd>`}<dt>Письмо</dt><dd>${mailStatuses[row.mailStatus]}${row.mailSentAt?' · '+esc(date(row.mailSentAt)):''}${row.mailError?' · '+esc(row.mailError):''}${!result.mailConfigured&&row.mailStatus!=='sent'?' · SMTP не настроен':''}</dd><dt>Согласие</dt><dd>Получено при отправке заявки</dd><dt>Номер заявки</dt><dd>${esc(row.id)}</dd></dl><div class="application-actions"><label>Статус заявки<select data-app-status="${row.id}">${Object.entries(statuses).map(([key,label])=>`<option value="${key}" ${row.status===key?'selected':''}>${label}</option>`).join('')}</select></label>${row.mailStatus==='failed'&&result.mailConfigured?`<button type="button" class="button outline" data-app-retry="${row.id}">Повторить отправку письма</button>`:''}</div><p class="form-message" role="alert"></p></div></details>`).join(''):'<div class="editor-card"><h2>Заявок пока нет</h2><p>После отправки формы на сайте регистрация появится здесь. Если использован фильтр — попробуйте изменить условия поиска.</p></div>'}</div><div class="application-pagination"><button class="button outline" data-app-page="${Math.max(0,offset-50)}" ${offset===0?'disabled':''}>Назад</button><span>${result.total?offset+1:0}–${Math.min(offset+50,result.total)} из ${result.total}</span><button class="button outline" data-app-page="${offset+50}" ${offset+50>=result.total?'disabled':''}>Далее</button></div>`;
  }catch(error){if(current===version&&active())panel.innerHTML='<div class="editor-card"><p role="alert">'+esc(error.message)+'</p><button class="button outline" data-app-refresh>Попробовать снова</button></div>';}
 }};
 document.querySelector('#editorPanel').addEventListener('submit',event=>{
  if(event.target.id!=='applicationFilters')return;
  event.preventDefault();const values=new FormData(event.target);search=values.get('search').trim();status=values.get('status');offset=0;MGTU_applications.render();
 });
 document.querySelector('#editorPanel').addEventListener('click',async event=>{
  if(event.target.closest('[data-app-refresh]')){MGTU_applications.render();return;}
  const page=event.target.closest('[data-app-page]');if(page){offset=Number(page.dataset.appPage);MGTU_applications.render();return;}
  const retry=event.target.closest('[data-app-retry]');if(!retry)return;
  retry.disabled=true;
  try{await MGTU_api('/api/applications/'+retry.dataset.appRetry,{method:'PUT',body:JSON.stringify({retryMail:true})});await MGTU_applications.render();MGTU_notify('Письмо добавлено в очередь.');}
  catch(error){retry.closest('.application-body').querySelector('.form-message').textContent=error.message;retry.disabled=false;}
 });
 document.querySelector('#editorPanel').addEventListener('change',async event=>{
  const select=event.target.closest('[data-app-status]');if(!select)return;
  select.disabled=true;
  try{await MGTU_api('/api/applications/'+select.dataset.appStatus,{method:'PUT',body:JSON.stringify({status:select.value})});select.closest('details').querySelector('.role-badge').textContent=statuses[select.value];await badge();MGTU_notify('Статус сохранён.');}
  catch(error){select.closest('.application-body').querySelector('.form-message').textContent=error.message;}
  finally{select.disabled=false;}
 });
 MGTU_adminReady.then(user=>{if(user?.role==='admin'){badge();setInterval(badge,30000);}});
})();
