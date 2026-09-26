/**
 * Add a new API = add one object to APIS and drop its snippet files in /public/snippets/<id>/
 */
const APIS = [
  {
    id: 'shiprocket-edd',
    title: 'Shiprocket EDD',
    description: 'Pincode checker that shows the estimated delivery date from Shiprocket serviceability.',
    method: 'POST',
    endpoint: '/api/shiprocket/edd',
    steps: [
      'In <code class="inline">lib/stores.js</code> add the store key + all its domains (custom, www, myshopify).',
      'In Vercel → Settings → Environment Variables add <code class="inline">SHIPROCKET_&lt;KEY&gt;_EMAIL</code> and <code class="inline">SHIPROCKET_&lt;KEY&gt;_PASSWORD</code> (Shiprocket API user), then redeploy.',
      'Create <code class="inline">assets/pincode-checker.js</code> in the theme and paste the JS below.',
      'Paste the Liquid markup into the product section block, and add the block schema to the section’s <code class="inline">blocks</code>.',
      'Style <code class="inline">.pincode-checker</code> in the theme CSS.'
    ],
    files: [
      { name: 'assets/pincode-checker.js', src: '/snippets/shiprocket-edd/pincode-checker.js' },
      { name: 'Block markup (Liquid)', src: '/snippets/shiprocket-edd/pincode-checker.liquid' },
      { name: 'Block schema (add inside "blocks": [])', src: '/snippets/shiprocket-edd/block-schema.json' }
    ],
    test: { placeholder: 'Pincode e.g. 400001', body: (pincode, store) => ({ pincode, store }) }
  }

  // {
  //   id: 'next-api',
  //   title: 'Next API',
  //   ...
  // }
];

const API_ORIGIN = location.origin;
const tabs = document.querySelector('.tabs');
const panel = document.getElementById('panel');

const escapeHtml = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const loadFile = async (src) => {
  const text = await (await fetch(src)).text();
  return text.replaceAll('__API_ORIGIN__', API_ORIGIN);
};

const render = async (api) => {
  const url = `${API_ORIGIN}${api.endpoint}`;

  panel.innerHTML = `
    <h1>${api.title}</h1>
    <p class="lead">${api.description}</p>

    <div class="card endpoint">
      <span class="method">${api.method}</span>
      <code>${url}</code>
    </div>

    <h2>Setup for a new store</h2>
    <div class="card"><ol class="steps">${api.steps.map(s => `<li>${s}</li>`).join('')}</ol></div>

    <h2>Copy-paste files</h2>
    <div class="files"></div>

    <h2>Test</h2>
    <div class="card">
      <form class="test">
        <input name="store" placeholder="Store key e.g. blep" required>
        <input name="value" placeholder="${api.test.placeholder}" required>
        <button type="submit">Run</button>
      </form>
      <div class="test-output"></div>
    </div>
  `;

  const files = await Promise.all(api.files.map(f => loadFile(f.src)));
  panel.querySelector('.files').innerHTML = api.files.map((f, i) => `
    <div class="file">
      <div class="file__head"><span>${f.name}</span><button type="button" data-copy="${i}">Copy</button></div>
      <pre><code>${escapeHtml(files[i])}</code></pre>
    </div>
  `).join('');

  panel.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(files[btn.dataset.copy]);
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = 'Copy'), 1500);
    });
  });

  panel.querySelector('.test').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const out = panel.querySelector('.test-output');
    out.className = 'test-output';
    out.textContent = 'Loading…';

    try {
      const res = await fetch(api.endpoint, {
        method: api.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(api.test.body(form.value.value.trim(), form.store.value.trim()))
      });
      const data = await res.json();
      out.classList.add(res.ok ? 'ok' : 'fail');
      out.textContent = `${res.status}\n${JSON.stringify(data, null, 2)}`;
    } catch (err) {
      out.classList.add('fail');
      out.textContent = err.message;
    }
  });
};

const select = (id) => {
  const api = APIS.find(a => a.id === id) || APIS[0];
  tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b.dataset.id === api.id));
  history.replaceState(null, '', `#${api.id}`);
  render(api);
};

tabs.innerHTML = APIS.map(a => `<button role="tab" data-id="${a.id}">${a.title}</button>`).join('');
tabs.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn) select(btn.dataset.id);
});

select(location.hash.slice(1));
