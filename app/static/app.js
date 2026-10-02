const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

const state = {
  text: localStorage.getItem('pad_text') || '',
  title: localStorage.getItem('pad_title') || 'سند بدون عنوان',
  tab: 'source'
};

$('#editor').value = state.text;
$('#docTitle').textContent = state.title;

function toast(t) {
  const x = $('#toast');
  x.textContent = t;
  x.classList.add('show');
  clearTimeout(x._t);
  x._t = setTimeout(() => x.classList.remove('show'), 1800);
}

function save() {
  state.text = $('#editor').value;
  state.title = $('#docTitle').textContent.trim() || 'سند بدون عنوان';
  localStorage.setItem('pad_text', state.text);
  localStorage.setItem('pad_title', state.title);
  $('#saveState').textContent = 'ذخیره شد';
  setTimeout(() => { $('#saveState').textContent = 'ذخیره خودکار'; }, 1200);
}

/* ── Lightweight Python / JS syntax highlight ── */
function highlightCode(code, lang) {
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let s = esc(code);
  const L = (lang || '').toLowerCase();

  if (L === 'python' || L === 'py') {
    // comments
    s = s.replace(/(#.*)$/gm, '<span class="tok-cmt">$1</span>');
    // strings
    s = s.replace(/(&quot;{3}[\s\S]*?&quot;{3}|&#39;{3}[\s\S]*?&#39;{3}|&quot;[^&]*&quot;|&#39;[^&]*&#39;)/g,
      '<span class="tok-str">$1</span>');
    // numbers
    s = s.replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-num">$1</span>');
    // keywords
    s = s.replace(
      /\b(and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield)\b/g,
      '<span class="tok-kw">$1</span>'
    );
    // function defs
    s = s.replace(/\b(def|class)\s+(\w+)/g, '<span class="tok-kw">$1</span> <span class="tok-fn">$2</span>');
  } else if (L === 'js' || L === 'javascript' || L === 'ts' || L === 'typescript') {
    s = s.replace(/(\/\/.*)$/gm, '<span class="tok-cmt">$1</span>');
    s = s.replace(/(&quot;[^&]*&quot;|&#39;[^&]*&#39;|`[^`]*`)/g, '<span class="tok-str">$1</span>');
    s = s.replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-num">$1</span>');
    s = s.replace(
      /\b(const|let|var|function|return|if|else|for|while|class|new|this|import|export|from|async|await|try|catch|throw|typeof|instanceof|true|false|null|undefined)\b/g,
      '<span class="tok-kw">$1</span>'
    );
  } else if (L === 'sql') {
    s = s.replace(
      /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|ASC|DESC|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|AND|OR|NOT|AS|IN|LIKE|LIMIT|OFFSET)\b/gi,
      m => '<span class="tok-kw">' + m + '</span>'
    );
  }
  return s;
}

function enhancePreview() {
  // syntax highlight code blocks
  $$('#preview .code-block code').forEach(codeEl => {
    const block = codeEl.closest('.code-block');
    const lang = block?.dataset.lang || '';
    // only highlight if not already tokenized
    if (codeEl.querySelector('.tok-kw,.tok-str')) return;
    const raw = codeEl.textContent;
    codeEl.innerHTML = highlightCode(raw, lang);
  });

  // copy buttons
  $$('#preview .code-copy').forEach(btn => {
    btn.onclick = () => {
      const pre = btn.closest('.code-block')?.querySelector('code');
      if (!pre) return;
      navigator.clipboard.writeText(pre.textContent).then(() => {
        btn.textContent = 'کپی شد';
        setTimeout(() => { btn.textContent = 'کپی'; }, 1200);
      }).catch(() => toast('کپی ناموفق'));
    };
  });

  // isolate Latin/IP inside table cells
  $$('#preview td, #preview th').forEach(cell => {
    if (cell.dataset.iso) return;
    cell.dataset.iso = '1';
    const walk = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walk.nextNode())) nodes.push(n);
    nodes.forEach(node => {
      const t = node.nodeValue;
      if (!/[A-Za-z0-9]/.test(t)) return;
      const span = document.createElement('span');
      span.innerHTML = t.replace(
        /(https?:\/\/\S+|\b(?:\d{1,3}\.){3}\d{1,3}\b|\b[A-Za-z][A-Za-z0-9_./:+\-]*\b)/g,
        m => '<span class="ltr" dir="ltr">' + m + '</span>'
      );
      node.parentNode.replaceChild(span, node);
    });
  });
}

async function render() {
  const text = $('#editor').value;
  try {
    const r = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const j = await r.json();
    $('#preview').innerHTML = j.html;
    applyTypography();
    enhancePreview();
    outline();
    stats();
  } catch (e) {
    console.error(e);
    toast('خطا در رندر');
  }
}

let timer;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => { save(); render(); }, 220);
}

$('#editor').addEventListener('input', schedule);
$('#docTitle').addEventListener('input', save);

function stats() {
  const t = $('#editor').value;
  const words = t.trim() ? t.trim().split(/\s+/).length : 0;
  $('#wordCount').textContent = fa(words) + ' کلمه';
  $('#charCount').textContent = fa(t.length) + ' نویسه';
  const p = $('#editor').selectionStart || 0;
  const before = t.slice(0, p).split('\n');
  $('#cursorPos').textContent = 'سطر ' + fa(before.length) + '، ستون ' + fa(before.at(-1).length + 1);
}
$('#editor').addEventListener('keyup', stats);
$('#editor').addEventListener('click', stats);

function outline() {
  const o = $('#outline');
  o.innerHTML = '';
  $$('#preview h1,#preview h2,#preview h3,#preview h4').forEach((h, i) => {
    h.id = 'h' + i;
    const d = document.createElement('div');
    d.textContent = h.textContent;
    d.style.paddingRight = (h.tagName === 'H1' ? 0 : h.tagName === 'H2' ? 10 : 20) + 'px';
    d.onclick = () => h.scrollIntoView({ behavior: 'smooth' });
    o.appendChild(d);
  });
}

function applyTypography() {
  const p = $('#preview .document');
  if (!p) return;
  p.style.fontFamily = $('#fontSelect').value + ',Tahoma,sans-serif';
  p.style.fontSize = $('#fontSize').value + 'px';
  p.style.lineHeight = $('#lineHeight').value;
}
['fontSelect', 'fontSize', 'lineHeight'].forEach(id =>
  $('#' + id).addEventListener('input', applyTypography)
);

$$('.tab').forEach(b => {
  b.onclick = () => {
    state.tab = b.dataset.tab;
    $$('.tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const e = $('#editor'), p = $('#preview');
    e.style.display = state.tab === 'preview' ? 'none' : 'block';
    p.style.display = state.tab === 'source' ? 'none' : 'block';
    if (state.tab === 'split') {
      e.style.width = '50%';
      e.style.left = '0';
      p.style.display = 'block';
      p.style.right = '0';
      p.style.left = '50%';
    } else {
      e.style.width = '100%';
      e.style.left = '0';
      p.style.left = '0';
      p.style.right = '0';
    }
  };
});

function insert(before, after = '', placeholder = '') {
  const e = $('#editor');
  const a = e.selectionStart, b = e.selectionEnd, v = e.value;
  const s = v.slice(a, b) || placeholder;
  e.setRangeText(before + s + after, a, b, 'select');
  e.focus();
  schedule();
}

$$('[data-action]').forEach(b => {
  b.onclick = () => {
    const a = b.dataset.action;
    if (a === 'h1') insert('# ', '', 'عنوان');
    else if (a === 'h2') insert('## ', '', 'زیرعنوان');
    else if (a === 'bold') insert('**', '**', 'متن');
    else if (a === 'italic') insert('*', '*', 'متن');
    else if (a === 'quote') insert('> ', '', 'نقل قول');
    else if (a === 'code') insert(
      '```python\n',
      '\n```',
      'def hello(name):\n    print(f"سلام {name}")\n    return True'
    );
    else if (a === 'table') insert(
      '| تجهیز | وضعیت | آدرس IP |\n' +
      '| --- | --- | --- |\n' +
      '| روتر | Up | 192.168.1.1 |\n' +
      '| سوئیچ | Down | 192.168.1.2 |\n' +
      '| فایروال | Up | 10.10.10.1 |\n',
      '',
      ''
    );
    else if (a === 'math') insert('$$\n', '\n$$', 'E = mc^2');
    else if (a === 'mathi') insert('$', '$', 'x^2 + y^2');
    else if (a === 'hr') insert('\n---\n');
  };
});

$('#newBtn').onclick = () => {
  if (confirm('سند فعلی پاک شود؟')) {
    $('#editor').value = '';
    $('#docTitle').textContent = 'سند بدون عنوان';
    save();
    render();
  }
};
$('#saveBtn').onclick = () => { save(); toast('سند ذخیره شد'); };

$('#exportPdf').onclick = () => {
  render().then(() => {
    const old = state.tab;
    document.body.classList.add('printing');
    $('#preview').style.display = 'block';
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing');
      if (old === 'source') $('#preview').style.display = 'none';
    }, 500);
  });
};

$('#exportDocx').onclick = async () => {
  try {
    const r = await fetch('/api/export/docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: $('#editor').value })
    });
    if (!r.ok) throw new Error(await r.text());
    const b = await r.blob();
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = (state.title || 'persian-document') + '.docx';
    a.click();
    URL.revokeObjectURL(u);
    toast('فایل Word ساخته شد');
  } catch (e) {
    toast('خطا: ' + String(e.message || e).slice(0, 100));
  }
};

$('#findBtn').onclick = () => {
  const q = $('#find').value;
  if (!q) return;
  const e = $('#editor');
  const i = e.value.indexOf(q, e.selectionEnd);
  e.focus();
  const pos = i < 0 ? e.value.indexOf(q) : i;
  if (pos >= 0) e.setSelectionRange(pos, pos + q.length);
  else toast('پیدا نشد');
};

$('#replaceBtn').onclick = () => {
  const q = $('#find').value, r = $('#replace').value;
  if (!q) return;
  const e = $('#editor');
  e.value = e.value.split(q).join(r);
  schedule();
};

$$('[data-ai]').forEach(b => {
  b.onclick = () => { $('#aiPrompt').value = b.dataset.ai; };
});

function getSettings() {
  return JSON.parse(localStorage.getItem('ai_settings') || '{}');
}
function loadSettings() {
  const s = getSettings();
  $('#baseUrl').value = s.baseUrl || 'http://localhost:11434';
  $('#apiKey').value = s.apiKey || '';
  $('#defaultModel').value = s.model || 'qwen3';
  $('#model').value = s.model || 'qwen3';
  $('#theme').value = s.theme || 'light';
  applyTheme();
}
function applyTheme() {
  let t = $('#theme').value || 'light';
  if (t === 'auto') {
    t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = t;
  // clear any legacy inline overrides
  ['--bg','--panel','--ink','--line','--bg0','--bg1','--surface'].forEach(k => {
    document.documentElement.style.removeProperty(k);
  });
}
$('#settingsBtn').onclick = () => {
  $('#settingsModal').classList.remove('hidden');
  loadSettings();
};
$('#closeSettings').onclick = () => $('#settingsModal').classList.add('hidden');
$('#saveSettings').onclick = () => {
  localStorage.setItem('ai_settings', JSON.stringify({
    baseUrl: $('#baseUrl').value.trim(),
    apiKey: $('#apiKey').value,
    model: $('#defaultModel').value.trim(),
    theme: $('#theme').value
  }));
  applyTheme();
  $('#settingsModal').classList.add('hidden');
  toast('تنظیمات ذخیره شد');
};

async function runAI() {
  const prompt = $('#aiPrompt').value.trim();
  if (!prompt) return toast('ابتدا دستور را وارد کنید');
  const s = getSettings();
  const provider = $('#provider').value;
  const model = $('#model').value.trim() || s.model || 'qwen3';
  let base = s.baseUrl || 'http://localhost:11434';
  let url = base.replace(/\/$/, '');
  if (provider === 'ollama') url += '/api/chat';
  else url += '/v1/chat/completions';

  const context = $('#editor').value;
  const system =
    'You are a precise Persian document editor. ' +
    'Preserve factual meaning. Return only the requested revised text. ' +
    'Keep Markdown structure unless asked otherwise. ' +
    'Use correct Persian punctuation and نیم‌فاصله. ' +
    'Never reverse English identifiers, code, IPs or numbers. ' +
    'Keep code fences and tables intact.';

  const body = provider === 'ollama'
    ? { model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt + '\n\nمتن سند:\n' + context }], stream: false }
    : { model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt + '\n\nمتن سند:\n' + context }] };

  const btn = $('#aiRun');
  const old = btn.textContent;
  btn.textContent = 'در حال اجرا…';
  btn.disabled = true;

  try {
    const h = { 'Content-Type': 'application/json' };
    if (s.apiKey) h.Authorization = 'Bearer ' + s.apiKey;
    const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    const out = provider === 'ollama' ? j.message?.content : j.choices?.[0]?.message?.content;
    if (!out) throw new Error('پاسخ مدل خالی است');
    $('#editor').value = out.trim();
    schedule();
    $('#history').innerHTML =
      '<div class="item">' + new Date().toLocaleTimeString('fa-IR') + ' · ' + prompt.slice(0, 70) + '</div>' +
      $('#history').innerHTML;
    toast('ویرایش AI اعمال شد');
  } catch (e) {
    toast('خطا: ' + String(e.message || e).slice(0, 100));
  } finally {
    btn.textContent = old;
    btn.disabled = false;
  }
}

$('#aiRun').onclick = runAI;
$('#editor').addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    runAI();
  }
});

/* ═══════════════════════════════════════════
   Templates — شرکت توزیع
   ═══════════════════════════════════════════ */
const TPL_COLORS = [
  { bg: 'linear-gradient(135deg,#0891b2,#0e7490)', soft: 'rgba(8,145,178,.12)', border: '#0891b2' },
  { bg: 'linear-gradient(135deg,#7c3aed,#6d28d9)', soft: 'rgba(124,58,237,.12)', border: '#7c3aed' },
  { bg: 'linear-gradient(135deg,#059669,#047857)', soft: 'rgba(5,150,105,.12)', border: '#059669' },
  { bg: 'linear-gradient(135deg,#d97706,#b45309)', soft: 'rgba(217,119,6,.12)', border: '#d97706' },
  { bg: 'linear-gradient(135deg,#dc2626,#b91c1c)', soft: 'rgba(220,38,38,.12)', border: '#dc2626' },
  { bg: 'linear-gradient(135deg,#2563eb,#1d4ed8)', soft: 'rgba(37,99,235,.12)', border: '#2563eb' },
  { bg: 'linear-gradient(135deg,#db2777,#be185d)', soft: 'rgba(219,39,119,.12)', border: '#db2777' },
  { bg: 'linear-gradient(135deg,#4f46e5,#4338ca)', soft: 'rgba(79,70,229,.12)', border: '#4f46e5' },
  { bg: 'linear-gradient(135deg,#0d9488,#0f766e)', soft: 'rgba(13,148,136,.12)', border: '#0d9488' },
  { bg: 'linear-gradient(135deg,#ea580c,#c2410c)', soft: 'rgba(234,88,12,.12)', border: '#ea580c' }
];

function defaultTemplates() {
  return [
    {
      id: 'admin-letter',
      icon: '✉️',
      name: 'نامه اداری',
      desc: 'مکاتبه رسمی داخلی یا خارجی با سربرگ، موضوع و امضا',
      colorIdx: 0,
      fields: [
        { key: 'subject', label: 'موضوع نامه', placeholder: 'مثلاً: ابلاغ قطعی موقت فیدر ۲۳', full: false },
        { key: 'number', label: 'شماره نامه', placeholder: 'مثلاً: ۱۴۰۳/۱۲۳۴', full: false },
        { key: 'date', label: 'تاریخ', placeholder: 'مثلاً: ۱۴۰۳/۰۷/۱۵', full: false },
        { key: 'audience', label: 'مخاطب (نام)', placeholder: 'مثلاً: آقای مهندس رضایی', full: false },
        { key: 'role', label: 'سمت مخاطب', placeholder: 'مثلاً: مدیر بهره‌برداری ناحیه شمال', full: false },
        { key: 'from', label: 'از طرف / امضاکننده', placeholder: 'مثلاً: واحد فناوری اطلاعات', full: false },
        { key: 'notes', label: 'متن و جزئیات نامه', placeholder: 'متن اصلی نامه، درخواست‌ها، مهلت و هر نکته‌ای که باید بیاید…', full: true, rows: 5 }
      ],
      skeleton: (f) => `# نامه اداری

**از:** ${f.from || '………………'}
**به:** ${f.audience || '………………'}${f.role ? ' — ' + f.role : ''}
**موضوع:** ${f.subject || '………………'}
**تاریخ:** ${f.date || '…………'}    **شماره:** ${f.number || '…………'}

با سلام و احترام،

${f.notes || 'متن نامه در این قسمت نوشته می‌شود.'}

خواهشمند است دستور فرمایید اقدام لازم صورت پذیرد.

با تشکر و احترام  
**${f.from || 'نام و سمت امضاکننده'}**
`
    },
    {
      id: 'it-sop',
      icon: '🖥️',
      name: 'دستورالعمل IT',
      desc: 'رویه عملیاتی فناوری اطلاعات، مراحل اجرا و مسئولان',
      colorIdx: 1,
      fields: [
        { key: 'subject', label: 'عنوان دستورالعمل', placeholder: 'مثلاً: رویه پشتیبان‌گیری سرورها', full: false },
        { key: 'from', label: 'واحد صادرکننده', placeholder: 'واحد فناوری اطلاعات', full: false },
        { key: 'audience', label: 'مخاطبان', placeholder: 'کارشناسان و مسئولان واحدهای مرتبط', full: false },
        { key: 'role', label: 'محدوده اجرا', placeholder: 'شرکت توزیع و واحدهای تابعه', full: false },
        { key: 'notes', label: 'هدف و توضیحات', placeholder: 'هدف دستورالعمل، نکات ایمنی و هر جزئیات فنی…', full: true, rows: 5 }
      ],
      skeleton: (f) => `# دستورالعمل IT
## ${f.subject || 'عنوان دستورالعمل'}

**مخاطبان:** ${f.audience || 'کارشناسان و مسئولان واحدهای مرتبط'}${f.role ? ' (' + f.role + ')' : ''}
**واحد صادرکننده:** ${f.from || 'واحد فناوری اطلاعات'}

### ۱. هدف
${f.notes || 'هدف از این دستورالعمل مشخص شود.'}

### ۲. دامنه اجرا
این دستورالعمل در محدوده ${f.role || 'شرکت توزیع و واحدهای تابعه'} لازم‌الاجرا است.

### ۳. تعاریف و مسئولیت‌ها
| نقش | مسئولیت |
| --- | --- |
| کارشناس IT | اجرای فنی |
| مدیر واحد | نظارت و تأیید |

### ۴. مراحل اجرا
1. درخواست / ثبت تیکت
2. بررسی و اولویت‌بندی
3. اجرا و مستندسازی
4. تأیید نهایی

### ۵. نکات ایمنی و امنیتی
- دسترسی‌ها بر اساس حداقل امتیاز
- ثبت لاگ تغییرات

### ۶. مراجع و پیوست‌ها
—
`
    },
    {
      id: 'tech-report',
      icon: '📊',
      name: 'گزارش فنی',
      desc: 'گزارش وضعیت شبکه، تجهیزات یا پروژه برای مدیریت',
      colorIdx: 2,
      fields: [
        { key: 'subject', label: 'عنوان گزارش', placeholder: 'مثلاً: وضعیت شبکه ناحیه غرب — مهر ۱۴۰۳', full: false },
        { key: 'from', label: 'تهیه‌کننده', placeholder: 'نام و واحد تهیه‌کننده', full: false },
        { key: 'audience', label: 'گیرنده', placeholder: 'مدیریت / معاونت فنی', full: false },
        { key: 'role', label: 'سمت گیرنده', placeholder: 'مدیرعامل / معاون بهره‌برداری', full: false },
        { key: 'period', label: 'بازه زمانی', placeholder: 'مثلاً: ۱ تا ۳۰ مهر ۱۴۰۳', full: false },
        { key: 'notes', label: 'خلاصه و یافته‌ها', placeholder: 'خلاصه مدیریتی، یافته‌های مهم، پیشنهادات…', full: true, rows: 5 }
      ],
      skeleton: (f) => `# گزارش فنی
## ${f.subject || 'عنوان گزارش'}

**تهیه‌کننده:** ${f.from || '………………'}
**گیرنده:** ${f.audience || '………………'}${f.role ? ' — ' + f.role : ''}
**بازه زمانی:** ${f.period || '…………'}

### خلاصه مدیریتی
${f.notes || 'خلاصه وضعیت و مهم‌ترین یافته‌ها.'}

### وضعیت فعلی
شرح وضعیت…

### یافته‌ها
| مورد | وضعیت | توضیح |
| --- | --- | --- |
| سامانه | فعال | نیازمند پایش |
| داده | فعال | کنترل کیفیت |

### اقدامات پیشنهادی
1. …
2. …

### نتیجه‌گیری
—
`
    },
    {
      id: 'minutes',
      icon: '📝',
      name: 'صورت‌جلسه',
      desc: 'صورت‌جلسه داخلی با حاضرین، دستور کار و مصوبات',
      colorIdx: 3,
      fields: [
        { key: 'subject', label: 'موضوع جلسه', placeholder: 'مثلاً: بررسی پروژه نوسازی شبکه', full: false },
        { key: 'date', label: 'تاریخ / ساعت', placeholder: 'مثلاً: ۱۴۰۳/۰۷/۲۰ — ساعت ۱۰', full: false },
        { key: 'location', label: 'محل جلسه', placeholder: 'سالن جلسات ساختمان مرکزی', full: false },
        { key: 'from', label: 'دبیر جلسه', placeholder: 'نام دبیر', full: false },
        { key: 'audience', label: 'حاضرین', placeholder: 'نام‌ها با ویرگول جدا شوند', full: true },
        { key: 'notes', label: 'مذاکرات و نکات', placeholder: 'شرح مذاکرات، نظرات و تصمیمات…', full: true, rows: 4 }
      ],
      skeleton: (f) => `# صورت‌جلسه

**موضوع:** ${f.subject || '………………'}
**تاریخ / ساعت:** ${f.date || '…………'}
**محل:** ${f.location || '…………'}
**دبیر جلسه:** ${f.from || '………………'}

### حاضرین
${(f.audience || 'نام').split(/[,،]/).map(n => '- ' + n.trim()).join('\n')}

### دستور کار
1. …

### مذاکرات
${f.notes || 'شرح مذاکرات…'}

### مصوبات
| ردیف | مصوبه | مسئول | مهلت |
| --- | --- | --- | --- |
| ۱ | … | … | … |

### امضا
—
`
    },
    {
      id: 'circular',
      icon: '📢',
      name: 'بخشنامه / ابلاغیه',
      desc: 'ابلاغ بخشنامه به واحدها و نواحی شرکت توزیع',
      colorIdx: 4,
      fields: [
        { key: 'subject', label: 'موضوع ابلاغیه', placeholder: 'مثلاً: رعایت نکات ایمنی در فصل سرما', full: false },
        { key: 'number', label: 'شماره بخشنامه', placeholder: 'مثلاً: ب/۱۴۰۳/۸۸', full: false },
        { key: 'date', label: 'تاریخ', placeholder: 'مثلاً: ۱۴۰۳/۰۷/۱۰', full: false },
        { key: 'from', label: 'از طرف', placeholder: 'مدیریت / واحد مربوطه', full: false },
        { key: 'audience', label: 'مخاطبان', placeholder: 'کلیه واحدها و نواحی', full: false },
        { key: 'notes', label: 'متن ابلاغیه', placeholder: 'متن کامل بخشنامه و دستورات اجرایی…', full: true, rows: 5 }
      ],
      skeleton: (f) => `# بخشنامه / ابلاغیه

**شماره:** ${f.number || '…………'}    **تاریخ:** ${f.date || '…………'}
**از:** ${f.from || 'مدیریت / واحد مربوطه'}
**به:** ${f.audience || 'کلیه واحدها و نواحی'}
**موضوع:** ${f.subject || '………………'}

با سلام؛

بدین‌وسیله به آگاهی می‌رساند:

${f.notes || 'متن ابلاغیه…'}

مراتب جهت اقدام و اجرا ابلاغ می‌گردد.

**${f.from || 'امضاکننده'}**
`
    },
    {
      id: 'equip-request',
      icon: '📦',
      name: 'درخواست تجهیزات',
      desc: 'درخواست خرید یا تخصیص تجهیزات و اقلام فنی',
      colorIdx: 5,
      fields: [
        { key: 'subject', label: 'موضوع درخواست', placeholder: 'تأمین تجهیزات شبکه', full: false },
        { key: 'from', label: 'متقاضی', placeholder: 'نام و واحد متقاضی', full: false },
        { key: 'audience', label: 'تأییدکننده', placeholder: 'مدیر انبار / تدارکات', full: false },
        { key: 'role', label: 'سمت تأییدکننده', placeholder: 'رئیس تدارکات', full: false },
        { key: 'items', label: 'فهرست اقلام', placeholder: 'مثلاً: کابل ۲۰ متری × ۵، فیوز ۳۲ آمپر × ۱۰', full: true },
        { key: 'notes', label: 'شرح نیاز و محل مصرف', placeholder: 'دلیل درخواست، محل نصب، اولویت…', full: true, rows: 4 }
      ],
      skeleton: (f) => `# درخواست تجهیزات

**متقاضی:** ${f.from || '………………'}
**تأییدکننده پیشنهادی:** ${f.audience || '………………'}${f.role ? ' — ' + f.role : ''}
**موضوع:** ${f.subject || 'تأمین تجهیزات'}

### شرح نیاز
${f.notes || 'دلیل و محل مصرف…'}

### فهرست اقلام
${f.items ? ('| ردیف | شرح کالا | تعداد | اولویت |\n| --- | --- | --- | --- |\n' + f.items.split(/[\n,،]/).filter(Boolean).map((it, i) => '| ' + (i + 1) + ' | ' + it.trim() + ' | … | عادی |').join('\n')) : `| ردیف | شرح کالا | تعداد | اولویت |
| --- | --- | --- | --- |
| ۱ | … | … | عادی |`}

### زمان‌بندی مورد نیاز
…
`
    },
    {
      id: 'outage-report',
      icon: '⚡',
      name: 'گزارش قطع / حادثه',
      desc: 'گزارش خاموشی، حادثه شبکه یا رویداد بهره‌برداری',
      colorIdx: 6,
      fields: [
        { key: 'subject', label: 'عنوان رویداد', placeholder: 'قطع فیدر ۲۳ — ناحیه شمال', full: false },
        { key: 'from', label: 'گزارش‌دهنده', placeholder: 'نام اپراتور / کارشناس', full: false },
        { key: 'audience', label: 'گیرنده', placeholder: 'مرکز دیسپاچینگ / بهره‌برداری', full: false },
        { key: 'feeder', label: 'فیدر / پست', placeholder: 'فیدر ۲۳ — پست شمال', full: false },
        { key: 'start', label: 'زمان شروع', placeholder: '۱۴۰۳/۰۷/۱۲ — ۰۸:۳۰', full: false },
        { key: 'end', label: 'زمان پایان', placeholder: '۱۴۰۳/۰۷/۱۲ — ۱۱:۱۵', full: false },
        { key: 'area', label: 'محدوده تحت تأثیر', placeholder: 'محله‌ها / تعداد مشترکین', full: false },
        { key: 'notes', label: 'شرح واقعه و اقدامات', placeholder: 'شرح قطع، علت اولیه، اقدامات انجام‌شده…', full: true, rows: 5 }
      ],
      skeleton: (f) => `# گزارش قطع / حادثه شبکه

**عنوان:** ${f.subject || '………………'}
**گزارش‌دهنده:** ${f.from || '………………'}
**گیرنده:** ${f.audience || 'مرکز دیسپاچینگ / بهره‌برداری'}

### مشخصات رویداد
| فیلد | مقدار |
| --- | --- |
| زمان شروع | ${f.start || '…'} |
| زمان پایان | ${f.end || '…'} |
| محدوده | ${f.area || '…'} |
| فیدر / پست | ${f.feeder || '…'} |

### شرح واقعه
${f.notes || 'شرح قطع یا حادثه…'}

### علت اولیه
…

### اقدامات انجام‌شده
1. …
2. …

### پیشنهاد پیشگیری
—
`
    },
    {
      id: 'contractor-letter',
      icon: '🏗️',
      name: 'نامه به پیمانکار',
      desc: 'مکاتبه با پیمانکار درباره پروژه، تحویل یا رفع نقص',
      colorIdx: 7,
      fields: [
        { key: 'subject', label: 'موضوع نامه', placeholder: 'رفع نقص قرارداد شماره …', full: false },
        { key: 'audience', label: 'نام پیمانکار', placeholder: 'شرکت پیمانکار …', full: false },
        { key: 'role', label: 'نماینده پیمانکار', placeholder: 'مدیر پروژه پیمانکار', full: false },
        { key: 'from', label: 'از طرف کارفرما', placeholder: 'کارفرمای شرکت توزیع', full: false },
        { key: 'contract', label: 'شماره قرارداد', placeholder: 'مثلاً: پ/۱۴۰۲/۴۵', full: false },
        { key: 'deadline', label: 'مهلت اقدام', placeholder: 'مثلاً: ۱۰ روز کاری', full: false },
        { key: 'notes', label: 'متن درخواست / ابلاغ', placeholder: 'جزئیات درخواست، نواقص، تحویل و…', full: true, rows: 5 }
      ],
      skeleton: (f) => `# نامه به پیمانکار

**به:** ${f.audience || 'شرکت پیمانکار'}${f.role ? ' — ' + f.role : ''}
**از:** ${f.from || 'کارفرمای شرکت توزیع'}
**موضوع:** ${f.subject || '………………'}
**شماره قرارداد:** ${f.contract || '…………'}
**مهلت اقدام:** ${f.deadline || '…………'}

با سلام و احترام،

${f.notes || 'متن درخواست یا ابلاغ به پیمانکار…'}

خواهشمند است ظرف مهلت مقرر نسبت به اقدام لازم و اعلام نتیجه اقدام فرمایید.

با تشکر  
**${f.from || 'امضاکننده'}**
`
    }
  ];
}

let TEMPLATES = (() => {
  try {
    const saved = localStorage.getItem('pad_templates');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) {
        // restore skeleton functions from defaults by id, or use generic
        const defs = defaultTemplates();
        return parsed.map(t => {
          const def = defs.find(d => d.id === t.id);
          return {
            ...t,
            fields: t.fields || def?.fields || genericFields(),
            skeleton: def?.skeleton || genericSkeleton(t.name)
          };
        });
      }
    }
  } catch (_) {}
  return defaultTemplates();
})();

function genericFields() {
  return [
    { key: 'subject', label: 'موضوع / عنوان', placeholder: 'عنوان سند', full: false },
    { key: 'audience', label: 'مخاطب', placeholder: 'نام مخاطب', full: false },
    { key: 'from', label: 'از طرف', placeholder: 'امضاکننده', full: false },
    { key: 'notes', label: 'جزئیات', placeholder: 'متن و نکات…', full: true, rows: 5 }
  ];
}

function genericSkeleton(name) {
  return (f) => `# ${name || 'سند'}

**موضوع:** ${f.subject || '………………'}
**مخاطب:** ${f.audience || '………………'}
**از طرف:** ${f.from || '………………'}

${f.notes || 'متن سند…'}
`;
}

function saveTemplates() {
  const serializable = TEMPLATES.map(({ id, icon, name, desc, colorIdx, fields }) =>
    ({ id, icon, name, desc, colorIdx, fields })
  );
  localStorage.setItem('pad_templates', JSON.stringify(serializable));
}

let selectedTpl = TEMPLATES[0];

function tplFields() {
  const box = $('#tplFields');
  if (!box) return {};
  const data = {};
  box.querySelectorAll('[data-field]').forEach(el => {
    data[el.dataset.field] = (el.value || '').trim();
  });
  return data;
}

function renderTplList() {
  const list = $('#tplList');
  if (!list) return;
  list.innerHTML = '';
  TEMPLATES.forEach((t, i) => {
    const c = TPL_COLORS[t.colorIdx % TPL_COLORS.length] || TPL_COLORS[i % TPL_COLORS.length];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tpl-item' + (selectedTpl && selectedTpl.id === t.id ? ' active' : '');
    btn.style.setProperty('--tpl-c', c.border);
    btn.style.setProperty('--tpl-soft', c.soft);
    btn.style.setProperty('--tpl-bg', c.bg);
    btn.innerHTML = '<span class="ic" style="background:' + c.bg + '">' + t.icon +
      '</span><span><strong>' + t.name + '</strong></span>';
    btn.onclick = () => {
      selectedTpl = t;
      renderTplList();
      showTplDetail();
    };
    list.appendChild(btn);
  });
}

function showTplDetail() {
  if (!selectedTpl) return;
  const c = TPL_COLORS[selectedTpl.colorIdx % TPL_COLORS.length] || TPL_COLORS[0];
  const iconEl = $('#tplIcon');
  iconEl.textContent = selectedTpl.icon;
  iconEl.style.background = c.bg;
  iconEl.style.boxShadow = '0 10px 28px ' + c.soft.replace('0.12', '0.4');
  $('#tplName').textContent = selectedTpl.name;
  $('#tplDesc').textContent = selectedTpl.desc;

  const box = $('#tplFields');
  box.innerHTML = '';
  const fields = selectedTpl.fields || genericFields();
  fields.forEach(f => {
    const lab = document.createElement('label');
    if (f.full) lab.className = 'full';
    lab.textContent = f.label;
    let input;
    if (f.full || f.rows) {
      input = document.createElement('textarea');
      input.rows = f.rows || 4;
      input.placeholder = f.placeholder || '';
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.placeholder = f.placeholder || '';
    }
    input.dataset.field = f.key;
    input.id = 'tpl_' + f.key;
    lab.appendChild(input);
    box.appendChild(lab);
  });
}

function openTemplates() {
  renderTplList();
  showTplDetail();
  $('#templatesModal').classList.remove('hidden');
}

function closeTemplates() {
  $('#templatesModal').classList.add('hidden');
}

$('#templatesBtn') && ($('#templatesBtn').onclick = openTemplates);
$('#closeTemplates') && ($('#closeTemplates').onclick = closeTemplates);
$('#templatesModal') && $('#templatesModal').addEventListener('click', e => {
  if (e.target === $('#templatesModal')) closeTemplates();
});

$('#tplApplySkeleton') && ($('#tplApplySkeleton').onclick = () => {
  if (!selectedTpl) return toast('قالب را انتخاب کنید');
  const body = selectedTpl.skeleton(tplFields());
  if ($('#editor').value.trim() && !confirm('محتوای فعلی سند جایگزین شود؟')) return;
  $('#editor').value = body;
  $('#docTitle').textContent = selectedTpl.name + (tplFields().subject ? ' — ' + tplFields().subject : '');
  schedule();
  closeTemplates();
  toast('اسکلت قالب اعمال شد');
});

async function callAIForTemplate(userPrompt) {
  const s = getSettings();
  const provider = $('#provider').value;
  const model = $('#model').value.trim() || s.model || 'qwen3';
  let base = (s.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
  let url = provider === 'ollama' ? base + '/api/chat' : base + '/v1/chat/completions';
  const system =
    'You are an expert Persian administrative writer for an electric power distribution company (شرکت توزیع). ' +
    'Write formal Persian. Use Markdown structure. Keep tables and headings clean. ' +
    'Never reverse English terms, codes, or numbers. Return ONLY the document text, no explanations.';
  const body = provider === 'ollama'
    ? { model, messages: [{ role: 'system', content: system }, { role: 'user', content: userPrompt }], stream: false }
    : { model, messages: [{ role: 'system', content: system }, { role: 'user', content: userPrompt }] };
  const h = { 'Content-Type': 'application/json' };
  if (s.apiKey) h.Authorization = 'Bearer ' + s.apiKey;
  const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  const out = provider === 'ollama' ? j.message?.content : j.choices?.[0]?.message?.content;
  if (!out || !String(out).trim()) throw new Error('پاسخ مدل خالی است');
  return String(out).trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
}

function fieldsToPromptLines(f) {
  if (!selectedTpl || !selectedTpl.fields) return '';
  return selectedTpl.fields.map(fd => {
    const v = f[fd.key];
    return v ? (fd.label + ': ' + v) : null;
  }).filter(Boolean).join('\n');
}

$('#tplGenerate') && ($('#tplGenerate').onclick = async () => {
  if (!selectedTpl) return toast('قالب را انتخاب کنید');
  const f = tplFields();
  const hasAny = Object.values(f).some(v => v);
  if (!hasAny) return toast('حداقل یک فیلد را پر کنید');
  const btn = $('#tplGenerate');
  const old = btn.textContent;
  btn.textContent = 'در حال تولید…';
  btn.disabled = true;
  try {
    const prompt =
      'یک سند کامل از نوع «' + selectedTpl.name + '» برای شرکت توزیع بنویس.\n' +
      'توضیح قالب: ' + selectedTpl.desc + '\n' +
      fieldsToPromptLines(f) + '\n\n' +
      'خروجی را با Markdown ساخت‌یافته بنویس (تیتر، پاراگراف، جدول در صورت نیاز).';
    const out = await callAIForTemplate(prompt);
    if ($('#editor').value.trim() && !confirm('سند تولیدشده جایگزین متن فعلی شود؟')) return;
    $('#editor').value = out;
    $('#docTitle').textContent = selectedTpl.name + (f.subject ? ' — ' + f.subject : '');
    schedule();
    closeTemplates();
    toast('سند با AI تولید شد');
  } catch (e) {
    toast('خطا: ' + String(e.message || e).slice(0, 120));
  } finally {
    btn.textContent = old;
    btn.disabled = false;
  }
});

$('#tplAdaptText') && ($('#tplAdaptText').onclick = async () => {
  if (!selectedTpl) return toast('قالب را انتخاب کنید');
  const current = $('#editor').value.trim();
  if (!current) return toast('ابتدا متنی در ادیتور داشته باشید یا Paste کنید');
  const f = tplFields();
  const btn = $('#tplAdaptText');
  const old = btn.textContent;
  btn.textContent = 'در حال اصلاح…';
  btn.disabled = true;
  try {
    const extra = fieldsToPromptLines(f);
    const prompt =
      'متن زیر را دقیقاً در قالب «' + selectedTpl.name + '» بازنویسی و ساخت‌یافته کن.\n' +
      'توضیح قالب: ' + selectedTpl.desc + '\n' +
      (extra ? extra + '\n' : '') +
      'معنای متن را حفظ کن. خروجی فقط Markdown نهایی باشد.\n\n--- متن ---\n' + current;
    const out = await callAIForTemplate(prompt);
    $('#editor').value = out;
    if (f.subject) $('#docTitle').textContent = selectedTpl.name + ' — ' + f.subject;
    else $('#docTitle').textContent = selectedTpl.name;
    schedule();
    closeTemplates();
    toast('متن با قالب اصلاح شد');
  } catch (e) {
    toast('خطا: ' + String(e.message || e).slice(0, 120));
  } finally {
    btn.textContent = old;
    btn.disabled = false;
  }
});

$('#tplAddNew') && ($('#tplAddNew').onclick = () => {
  const name = prompt('نام قالب جدید را وارد کنید:', 'قالب سفارشی');
  if (!name || !name.trim()) return;
  const icon = prompt('یک ایموجی برای قالب انتخاب کنید:', '📄') || '📄';
  const desc = prompt('توضیح کوتاه قالب:', 'قالب سفارشی کاربر') || 'قالب سفارشی';
  const newTpl = {
    id: 'custom-' + Date.now(),
    icon: icon.trim().slice(0, 4),
    name: name.trim(),
    desc: desc.trim(),
    colorIdx: TEMPLATES.length % TPL_COLORS.length,
    fields: genericFields(),
    skeleton: genericSkeleton(name.trim())
  };
  TEMPLATES.push(newTpl);
  saveTemplates();
  selectedTpl = newTpl;
  renderTplList();
  showTplDetail();
  toast('قالب جدید اضافه شد');
});

loadSettings();
render();
stats();
