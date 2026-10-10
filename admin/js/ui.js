/**
 * Tiny DOM toolkit + shared components.
 *
 * No framework: `el()` builds elements declaratively and the handful of
 * components below (toast, drawer, modal, pagination) are reused by every view.
 * Anything derived from user content goes through `text:` or `escapeHtml()`
 * rather than `html:` so a crafted caption cannot inject markup.
 */

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }

  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const frag = (...children) => {
  const f = document.createDocumentFragment();
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    f.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return f;
};

export const clear = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
};

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/* ── 格式化 ─────────────────────────────────────────────────────────── */

/** 12345 -> 1.2万, 123456789 -> 1.2亿 */
export function fmtCount(value) {
  const n = Number(value) || 0;
  if (n < 10_000) return String(n);
  if (n < 100_000_000) {
    const wan = n / 10_000;
    return `${wan >= 100 ? Math.round(wan) : wan.toFixed(1).replace(/\.0$/, '')}万`;
  }
  return `${(n / 100_000_000).toFixed(1).replace(/\.0$/, '')}亿`;
}

export function fmtBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function fmtDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const pad = (n) => String(n).padStart(2, '0');

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDay(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "3 分钟前" style relative time. */
export function relTime(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const min = Math.round(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} 天前`;
  return fmtDay(iso);
}

/** Deterministic gradient avatar so accounts without an image still look intentional. */
const AVATAR_GRADIENTS = [
  ['#2d1b69', '#7c3aed'], ['#2b1055', '#ff6b35'], ['#3e2723', '#c4a484'],
  ['#1a0000', '#e63946'], ['#001210', '#00ff9c'], ['#2b0b0b', '#ffb703'],
  ['#001219', '#94d2bd'], ['#1b1520', '#fe2c55'],
];

export function avatar(user, size = '') {
  const name = user?.name ?? user?.userName ?? '?';
  const url = user?.avatarUrl ?? user?.userAvatar ?? user?.avatar_url;
  const key = [...String(user?.id ?? name)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [from, to] = AVATAR_GRADIENTS[key % AVATAR_GRADIENTS.length];

  return el(
    'div',
    { class: `avatar ${size}`.trim(), style: `background:linear-gradient(135deg,${from},${to})` },
    url ? el('img', { src: url, alt: '', loading: 'lazy' }) : String(name).slice(0, 1),
  );
}

const STATUS_LABEL = { pending: '待审核', approved: '已通过', rejected: '已驳回' };
const STATUS_CLASS = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };

export const statusBadge = (status) =>
  el('span', { class: `badge ${STATUS_CLASS[status] ?? 'badge-neutral'}` }, STATUS_LABEL[status] ?? status);

/* ── 提示条 ─────────────────────────────────────────────────────────── */

export function toast(message, type = 'info', ms = 3200) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const node = el('div', { class: `toast ${type}` }, message);
  host.append(node);
  setTimeout(() => {
    node.style.transition = 'opacity .2s, transform .2s';
    node.style.opacity = '0';
    node.style.transform = 'translateX(14px)';
    setTimeout(() => node.remove(), 220);
  }, ms);
}

/* ── 抽屉 ───────────────────────────────────────────────────────────── */

let drawerCleanup = null;

export function openDrawer({ title, subtitle, body, footer }) {
  closeDrawer();
  const host = document.getElementById('drawer');
  clear(host);

  const panel = el(
    'div',
    { class: 'drawer-panel', role: 'dialog', 'aria-modal': 'true' },
    el(
      'div',
      { class: 'drawer-head' },
      el('div', {}, el('h3', { text: title }), subtitle ? el('p', { class: 'card-sub', text: subtitle }) : null),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: closeDrawer, 'aria-label': '关闭' }, '✕'),
    ),
    el('div', { class: 'drawer-body' }, body),
    footer ? el('div', { class: 'drawer-foot' }, footer) : null,
  );

  host.append(el('div', { class: 'drawer-backdrop', onclick: closeDrawer }), panel);
  host.hidden = false;

  const onKey = (event) => {
    if (event.key === 'Escape') closeDrawer();
  };
  document.addEventListener('keydown', onKey);
  drawerCleanup = () => document.removeEventListener('keydown', onKey);
  return panel;
}

export function closeDrawer() {
  const host = document.getElementById('drawer');
  if (!host || host.hidden) return;
  host.hidden = true;
  clear(host);
  drawerCleanup?.();
  drawerCleanup = null;
}

/* ── 模态框 ─────────────────────────────────────────────────────────── */

function openModal(content) {
  const host = document.getElementById('modal');
  clear(host);
  host.append(el('div', { class: 'modal-backdrop', onclick: () => closeModal() }), content);
  host.hidden = false;
}

export function closeModal() {
  const host = document.getElementById('modal');
  if (!host) return;
  host.hidden = true;
  clear(host);
}

/** Promise<boolean> — resolves false on cancel / Escape / backdrop click. */
export function confirmModal({ title, message, confirmText = '确认', danger = false }) {
  return new Promise((resolve) => {
    const done = (value) => {
      closeModal();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') done(false);
    };
    document.addEventListener('keydown', onKey);

    openModal(
      el(
        'div',
        { class: 'modal-panel', role: 'dialog', 'aria-modal': 'true' },
        el('h3', { text: title }),
        el('p', { class: 'muted', text: message }),
        el(
          'div',
          { class: 'modal-actions' },
          el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => done(false) }, '取消'),
          el(
            'button',
            { class: `btn ${danger ? 'btn-primary' : 'btn-success'}`, type: 'button', onclick: () => done(true) },
            confirmText,
          ),
        ),
      ),
    );
  });
}

/** Promise<string|null> — a single-line text prompt. */
export function promptModal({ title, label, placeholder = '', value = '', confirmText = '提交' }) {
  return new Promise((resolve) => {
    const input = el('input', { type: 'text', value, placeholder });
    const done = (result) => {
      closeModal();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') done(null);
    };
    document.addEventListener('keydown', onKey);

    const submit = () => done(input.value.trim() || null);

    openModal(
      el(
        'div',
        { class: 'modal-panel', role: 'dialog', 'aria-modal': 'true' },
        el('h3', { text: title }),
        el('label', { class: 'field' }, el('span', { text: label }), input),
        el(
          'div',
          { class: 'modal-actions' },
          el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => done(null) }, '取消'),
          el('button', { class: 'btn btn-primary', type: 'button', onclick: submit }, confirmText),
        ),
      ),
    );
    input.focus();
    input.select();
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submit();
    });
  });
}

/* ── 列表辅助 ───────────────────────────────────────────────────────── */

export function pagination({ page, pages, total, onPage }) {
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(pages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const buttons = [];
  for (let i = start; i <= end; i += 1) {
    buttons.push(
      el(
        'button',
        {
          class: `page-btn ${i === page ? 'active' : ''}`,
          type: 'button',
          onclick: () => onPage(i),
        },
        String(i),
      ),
    );
  }

  return el(
    'div',
    { class: 'pagination' },
    el('span', { class: 'faint', text: `共 ${total} 条 · 第 ${page}/${pages} 页` }),
    el(
      'div',
      { class: 'pages' },
      el('button', { class: 'page-btn', type: 'button', disabled: page <= 1, onclick: () => onPage(page - 1) }, '‹'),
      buttons,
      el('button', { class: 'page-btn', type: 'button', disabled: page >= pages, onclick: () => onPage(page + 1) }, '›'),
    ),
  );
}

export const emptyState = (icon, text) =>
  el('div', { class: 'empty' }, el('div', { class: 'big', text: icon }), el('div', { text }));

export const loadingRows = (count = 6) =>
  el(
    'div',
    { class: 'stack' },
    Array.from({ length: count }, () => el('div', { class: 'skeleton', style: 'height:46px' })),
  );

/** Highlights sensitive words without letting the text escape into markup. */
export function highlightSensitive(text, words) {
  if (!words?.length) return escapeHtml(text);
  let html = escapeHtml(text);
  for (const word of words) {
    const safe = escapeHtml(word);
    html = html.split(safe).join(`<span class="sensitive-hit">${safe}</span>`);
  }
  return html;
}
