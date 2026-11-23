export async function startSession({ request, openStore, notify }) {
  const auth = document.querySelector('#shop-auth');
  const dashboard = document.querySelector('#dashboard');
  const form = document.querySelector('#shop-auth-form');
  const waiting = document.querySelector('#auth-waiting');
  const errorBox = document.querySelector('#auth-error');
  const controls = [...auth.querySelectorAll('[data-auth-mode]')];
  const password = form.elements.password;
  const submit = document.querySelector('#auth-submit');
  const hint = document.querySelector('#auth-password-hint');
  const logout = document.querySelector('#logout');
  const embedded = window.top !== window;
  const openTab = document.querySelector('#auth-open-tab');
  if (embedded) {
    openTab.href = location.href;
    openTab.hidden = false;
  }
  let mode = 'login';

  function showError(message = '') {
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  function changeMode(next) {
    mode = next;
    const registering = mode === 'register';
    for (const control of controls) control.setAttribute('aria-pressed', String(control.dataset.authMode === mode));
    submit.textContent = registering ? 'Cadastrar' : 'Entrar';
    password.autocomplete = registering ? 'new-password' : 'current-password';
    password.minLength = registering ? 10 : 1;
    hint.hidden = !registering;
    password.value = '';
    showError();
  }

  function enter(name, focus = false) {
    form.reset();
    auth.hidden = true;
    dashboard.hidden = false;
    document.querySelector('#account-name').textContent = name;
    openStore(name);
    if (focus) document.querySelector('#main').focus({ preventScroll: true });
  }

  const access = (payload) => request('/api/acesso', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });

  for (const control of controls) control.addEventListener('click', () => {
    if (mode === control.dataset.authMode) return;
    changeMode(control.dataset.authMode);
    form.elements.name.focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    showError();
    submit.disabled = true;
    for (const control of controls) control.disabled = true;
    try {
      const { name } = await access({ action: mode, name: form.elements.name.value, password: password.value });
      if (embedded && (await request('/api/acesso')).name !== name) {
        throw Error('Abra a loja em uma nova aba para entrar.');
      }
      enter(name, true);
    } catch (error) {
      showError(error.message);
    } finally {
      submit.disabled = false;
      for (const control of controls) control.disabled = false;
    }
  });

  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try {
      await access({ action: 'logout' });
      location.reload();
    } catch (error) {
      notify(error.message);
      logout.disabled = false;
    }
  });

  try {
    const { name } = await request('/api/acesso');
    if (name) { enter(name); return; }
  } catch (error) {
    showError(error.message);
  }
  waiting.hidden = true;
  form.hidden = false;
  controls[0].parentElement.hidden = false;
}
