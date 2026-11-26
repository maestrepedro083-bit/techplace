import { whatsappConnection } from '/techplace-whatsapp.js';

const response = await fetch('/techplace-whatsapp.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'availability' }),
  cache: 'no-store',
  credentials: 'same-origin',
  signal: AbortSignal.timeout(3000),
}).then(res => res.ok ? res.json() : null).catch(() => null);

if (response?.ready === true) {
  await import('/app-whatsapp.js?v=1');
} else {
  await import('/app.js?v=tp45-busca-fornecedor');
  const panel = document.getElementById('chat-panel');
  const launcher = document.getElementById('chat-launch');
  launcher?.addEventListener('click', () => {
    const body = panel?.querySelector('.tp-floating-body');
    if (body && !body.querySelector('.tp-wa-connection')) body.prepend(whatsappConnection());
  });
}
