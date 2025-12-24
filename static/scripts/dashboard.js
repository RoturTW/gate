async function api(path, opts) {
  const res = await fetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || ("HTTP " + res.status);
    throw new Error(msg);
  }
  return data;
}

function el(id) { return document.getElementById(id); }

async function loadLinks() {
  el('error').textContent = '';
  const list = el('links');
  list.innerHTML = '';

  const links = await api('/api/links');
  for (const link of links) {
    const li = document.createElement('li');

    const a = document.createElement('a');
    a.href = '/' + encodeURIComponent(link.id);
    a.textContent = link.id;
    a.target = '_blank';

    const span = document.createElement('span');
    span.textContent = ' -> ' + link.to;

    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = async () => {
      try {
        await api('/api/link?id=' + encodeURIComponent(link.id), { method: 'DELETE' });
        await loadLinks();
      } catch (e) {
        el('error').textContent = e.message;
      }
    };

    li.appendChild(a);
    li.appendChild(span);
    li.appendChild(document.createTextNode(' '));
    li.appendChild(del);
    list.appendChild(li);
  }
}

window.onload = () => {
  el('refresh').onclick = () => loadLinks().catch(e => el('error').textContent = e.message);
  el('create').onclick = async () => {
    try {
      el('error').textContent = '';
      const to = el('new-to').value.trim();
      await api('/api/link?to=' + encodeURIComponent(to), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      el('new-to').value = '';
      await loadLinks();
    } catch (e) {
      el('error').textContent = e.message;
    }
  };

  loadLinks().catch(e => el('error').textContent = e.message);
};
