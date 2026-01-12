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

  const me = await api('/api/me');
  const links = await api('/api/links');
  for (const link of links) {
    const li = document.createElement('li');

    const a = document.createElement('a');
    a.href = '/' + encodeURIComponent(link.id);
    a.textContent = link.id;
    a.target = '_blank';

    const span = document.createElement('span');
    span.textContent = ' -> ' + link.to + (link.views ? ` (Clicks: ${link.views})` : '');

    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = async () => {
      if (!confirm('Are you sure you want to delete this link?')) return;
      try {
        await api('/api/link?id=' + encodeURIComponent(link.id), { method: 'DELETE' });
        await loadLinks();
      } catch (e) {
        el('error').textContent = e.message;
      }
    };

    let rename = null;
    if (me.canRename) {
      rename = document.createElement('button');
      rename.textContent = 'Rename';
      rename.onclick = async () => {
        const newName = prompt('Enter new name for this link:', link.id);
        if (!newName || newName === link.id) return;

        try {
          await api(
            '/api/link/rename?id=' +
              encodeURIComponent(link.id) +
              '&newName=' +
              encodeURIComponent(newName),
            { method: 'POST' }
          );
          await loadLinks();
        } catch (e) {
          el('error').textContent = e.message;
        }
      };
    };

    const copy = document.createElement('button');
    copy.textContent = 'Copy Url';
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(window.location.origin + '/' + link.id);
        copy.textContent = 'Copied!';
        setTimeout(() => { copy.textContent = 'Copy Url'; }, 2000);
      } catch (e) {
        el('error').textContent = e.message;
      }
    };

    li.appendChild(a);
    li.appendChild(span);
    li.appendChild(document.createElement('br'));
    li.appendChild(del);
    li.appendChild(document.createTextNode(' '));
    if (rename) li.appendChild(rename);
    li.appendChild(document.createTextNode(' '));
    li.appendChild(copy);
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
