(() => {
  let csrf = '';
  window.MGTU_api = async (url, options = {}) => {
    const response = await fetch(url, {credentials:'same-origin',cache:'no-store',...options,headers:{...(options.body ? {'Content-Type':'application/json'} : {}),...(csrf ? {'X-CSRF-Token':csrf} : {}),...options.headers}});
    const result = await response.json().catch(() => ({error:'Сервер недоступен. Проверьте подключение.'}));
    if (!response.ok) {
      const error = new Error(result.error || 'Не удалось выполнить действие.'); error.status = response.status;
      if (response.status === 401 && !options.noRedirect) location.replace('login.html?expired=1');
      throw error;
    }
    return result;
  };
  window.MGTU_canEditPath = path => {
    if (window.MGTU_currentUser?.role === 'admin') return true;
    return /^(title|description|date|place|phone|email)$/.test(path) || /^texts\.[a-zA-Z]+$/.test(path) || /^blocks\.[a-z0-9_-]+\.elements\.[a-z0-9_-]+\.(text|alt|placeholder)$/.test(path) || /^programs\.[a-z0-9_-]+\.(name|faculty|admission\.(code|year|profile|status|ege|spo|entrance|duration|notes|headers\.\d+|rows\.\d+\.\d+))$/.test(path);
  };
  window.MGTU_adminReady = (async () => {
    try {
      await MGTU_ready;
      if (window.MGTU_loadError) throw Error('Сервер контента недоступен.');
      const result = await MGTU_api('/api/session', {noRedirect:true});
      csrf = result.csrf; window.MGTU_currentUser = result.user;
      document.documentElement.dataset.adminRole = result.user.role;
      document.querySelectorAll('[data-admin-only]').forEach(node => node.hidden = result.user.role !== 'admin');
      document.querySelector('#adminIdentity').textContent = result.user.name + ' · ' + (result.user.role === 'admin' ? 'Администратор' : 'Редактор текста');
      document.querySelector('#logoutButton').addEventListener('click', async () => {
        try {await MGTU_api('/api/logout', {method:'POST'}); location.replace('login.html');}
        catch (error) {window.MGTU_notify?.(error.message);}
      });
      document.body.classList.add('authenticated');
      return result.user;
    } catch (error) {location.replace(error.status === 401 ? 'login.html' : 'login.html?unavailable=1'); return null;}
  })();
})();
