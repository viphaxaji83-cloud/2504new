(() => {
  const esc = MGTU_escape;
  let users = [], renderVersion = 0;
  const fields = (user = {}) => `<div class="settings-grid"><label>Имя<input name="name" value="${esc(user.name || '')}" required maxlength="100" autocomplete="off"></label><label>Логин<input name="login" value="${esc(user.login || '')}" required minlength="3" maxlength="80" pattern="[a-zA-Z0-9][a-zA-Z0-9_.@-]{2,79}" autocomplete="off"><small>Латинские буквы, цифры, _, -, . или @.</small></label><label>Роль<select name="role"><option value="editor" ${user.role !== 'admin' ? 'selected' : ''}>Редактор — только текст</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор — полный доступ</option></select></label><label>${user.id ? 'Новый пароль' : 'Пароль'}<input name="password" type="password" minlength="12" maxlength="256" autocomplete="new-password" ${user.id ? '' : 'required'}><small>${user.id ? 'Оставьте пустым, чтобы сохранить пароль.' : 'Не менее 12 символов.'}</small></label></div><label class="toggle-field">Доступ разрешён<input type="checkbox" name="active" ${user.active !== false ? 'checked' : ''}></label>`;
  function userRow(user) {
    return `<details class="user-row"><summary><span>${esc(user.name)}<small>${esc(user.login)}${user.id === MGTU_currentUser.id ? ' · это вы' : ''}${!user.active ? ' · заблокирован' : ''}</small></span><span class="role-badge ${user.role}">${user.role === 'admin' ? 'Администратор' : 'Редактор'}</span></summary><form class="user-form" data-user-form="${user.id}">${fields(user)}<p class="form-message" role="alert"></p><div class="user-actions"><button class="button dark-button" type="submit">Сохранить пользователя</button>${user.id !== MGTU_currentUser.id ? `<button class="button outline danger" type="button" data-delete-user="${user.id}">Удалить пользователя</button>` : ''}</div></form></details>`;
  }
  window.MGTU_users = {
    async render() {
      const version = ++renderVersion, panel = document.querySelector('#editorPanel');
      panel.innerHTML = '<div class="editor-card"><p>Загружаем пользователей…</p></div>';
      try {
        const response = await MGTU_api('/api/users');
        if (version !== renderVersion || !document.querySelector('[data-view="users"].active')) return;
        users = response.users;
        panel.innerHTML = `<div class="users-toolbar"><p>Администратор управляет сайтом и доступом.<br>Редактор изменяет только текст.</p><button type="button" class="button dark-button" id="showNewUser">Добавить пользователя</button></div><form id="newUserForm" class="user-form" data-user-form="new" hidden><h2>Новый пользователь</h2>${fields()}<p class="form-message" role="alert"></p><button class="button dark-button" type="submit">Создать пользователя</button></form><div id="userList">${users.map(userRow).join('')}</div>`;
      } catch (error) {if (version === renderVersion) panel.innerHTML = '<div class="editor-card"><p>' + esc(error.message) + '</p></div>';}
    },
    account() {
      renderVersion++;
      return `<form id="passwordForm" class="user-form account-card"><h2>Пароль для входа</h2><p>${esc(MGTU_currentUser.name)} · ${esc(MGTU_currentUser.login)}<br>После смены пароля потребуется войти снова на всех устройствах.</p><label>Текущий пароль<input type="password" name="currentPassword" autocomplete="current-password" required maxlength="256"></label><label>Новый пароль<input type="password" name="password" autocomplete="new-password" required minlength="12" maxlength="256"><small>Не менее 12 символов.</small></label><label>Повторите новый пароль<input type="password" name="confirmation" autocomplete="new-password" required minlength="12" maxlength="256"></label><p class="form-message" role="alert"></p><button class="button dark-button" type="submit">Изменить пароль</button></form>${MGTU_currentUser.role === 'admin' && MGTU_read('mgtu-content',null) ? '<div class="user-form account-card"><h2>Прежние правки в браузере</h2><p>Можно открыть сохранённый ранее локальный макет как черновик. Проверьте его в предпросмотре, затем нажмите «Сохранить на сайте».</p><button class="button outline" id="importLocalDraft" type="button">Открыть локальный черновик</button></div>' : ''}`;
    }
  };
  document.querySelector('#editorPanel').addEventListener('click', async event => {
    if (event.target.closest('#showNewUser')) {const form = document.querySelector('#newUserForm'); form.hidden = !form.hidden; if (!form.hidden) form.querySelector('input').focus();}
    const remove = event.target.closest('[data-delete-user]');
    if (!remove) return;
    const user = users.find(item => item.id === remove.dataset.deleteUser);
    if (!user || !confirm(`Удалить пользователя «${user.name}» (${user.login})? Его доступ будет прекращён.`)) return;
    remove.disabled = true;
    try {await MGTU_api('/api/users/' + user.id, {method:'DELETE'}); await MGTU_users.render(); MGTU_notify('Пользователь удалён.');}
    catch (error) {remove.closest('form').querySelector('.form-message').textContent = error.message; remove.disabled = false;}
  });
  document.querySelector('#editorPanel').addEventListener('submit', async event => {
    const form = event.target;
    if (!form.matches('[data-user-form],#passwordForm')) return;
    event.preventDefault(); const message = form.querySelector('.form-message'), button = form.querySelector('[type=submit]'); message.textContent = '';
    const values = Object.fromEntries(new FormData(form));
    if (form.id === 'passwordForm' && values.password !== values.confirmation) {message.textContent = 'Пароли не совпадают.'; return;}
    button.disabled = true;
    try {
      if (form.id === 'passwordForm') {await MGTU_api('/api/password', {method:'PUT',body:JSON.stringify(values)}); form.reset(); location.replace('login.html?password=changed'); return;}
      values.active = form.elements.active.checked;
      const id = form.dataset.userForm;
      const result = await MGTU_api('/api/users' + (id === 'new' ? '' : '/' + id), {method:id === 'new' ? 'POST' : 'PUT',body:JSON.stringify(values)});
      if (result.loginRequired) {location.replace('login.html'); return;}
      if (result.user.id === MGTU_currentUser.id) {Object.assign(MGTU_currentUser,result.user); document.querySelector('#adminIdentity').textContent=result.user.name+' · Администратор';}
      await MGTU_users.render(); MGTU_notify(id === 'new' ? 'Пользователь создан.' : 'Пользователь обновлён.');
    } catch (error) {message.textContent = error.message;}
    finally {button.disabled = false;}
  });
})();
