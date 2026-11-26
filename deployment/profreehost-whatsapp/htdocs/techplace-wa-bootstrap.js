const response = await fetch('/techplace-whatsapp.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'availability' }),
  cache: 'no-store',
  credentials: 'same-origin',
  signal: AbortSignal.timeout(3000),
}).then(res => res.ok ? res.json() : null).catch(() => null);

await import(response?.ready === true ? '/app-whatsapp.js?v=2' : '/app-painel-wa.js?v=3');
