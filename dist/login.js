(() => {
  const form = document.querySelector('#loginForm'), error = document.querySelector('#loginError');
  if (new URLSearchParams(location.search).has('expired')) error.textContent = 'Сессия завершена. Войдите снова.';
  if (new URLSearchParams(location.search).get('password') === 'changed') error.textContent = 'Пароль изменён. Войдите с новым паролем.';
  if (new URLSearchParams(location.search).has('unavailable')) error.textContent = 'Сервер недоступен. Проверьте, что запущена новая версия Docker.';
  fetch('/api/session', {cache:'no-store'}).then(async response => {
    const data = await response.json();
    if (response.ok && !new URLSearchParams(location.search).has('unavailable')) location.replace('admin.html');
    else document.querySelector('#setupHint').hidden = !data.needsSetup;
  }).catch(() => {error.textContent = 'Сервер авторизации недоступен. Проверьте запуск приложения.';});
  form.addEventListener('submit', async event => {
    event.preventDefault(); error.textContent = ''; const button = form.querySelector('button'); button.disabled = true;
    try {
      const fields = new FormData(form);
      const response = await fetch('/api/login', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:fields.get('login').trim(),password:fields.get('password')})});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Не удалось войти.');
      form.reset(); location.replace('admin.html');
    } catch (failure) {error.textContent = failure.message || 'Не удалось подключиться к серверу.';}
    finally {button.disabled = false;}
  });
})();
