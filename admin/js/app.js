/**
 * Console bootstrap: session gate, layout, navigation and route wiring.
 */
import { ApiError, api, session, setUnauthorizedHandler } from './api.js';
import { register, navigate, setNotFound, start } from './router.js';
import { avatar, clear, el, toast } from './ui.js';

import * as commentsView from './views/comments.js';
import * as dashboardView from './views/dashboard.js';
import * as logsView from './views/logs.js';
import * as reviewView from './views/review.js';
import * as usersView from './views/users.js';
import * as videosView from './views/videos.js';

const NAV = [
  { path: '/dashboard', label: '数据概览', icon: '📊', view: dashboardView },
  { path: '/review', label: '审核队列', icon: '🛡️', view: reviewView, badge: 'pending' },
  { path: '/videos', label: '视频管理', icon: '🎬', view: videosView },
  { path: '/users', label: '用户管理', icon: '👥', view: usersView },
  { path: '/comments', label: '评论管理', icon: '💬', view: commentsView },
  { path: '/logs', label: '操作日志', icon: '📜', view: logsView },
];

const el$ = (id) => document.getElementById(id);

/* ── 登录 ───────────────────────────────────────────────────────────── */

function showLogin() {
  el$('app').hidden = true;
  el$('login-screen').hidden = false;
  el$('login-username')?.focus();
}

function showConsole() {
  el$('login-screen').hidden = true;
  el$('app').hidden = false;
}

function renderAdminChip() {
  const admin = session.admin ?? { displayName: '管理员', username: 'admin' };
  const host = el$('admin-chip');
  clear(host);
  host.append(
    avatar({ id: admin.username, name: admin.displayName ?? admin.username }),
    el('div', {}, el('div', { text: admin.displayName ?? admin.username }), el('div', { class: 'faint', style: 'font-size:11px', text: `@${admin.username}` })),
  );
}

/* ── 导航 ───────────────────────────────────────────────────────────── */

let pendingCount = 0;

function renderNav() {
  const active = location.hash.replace(/^#/, '').split('?')[0] || '/dashboard';
  const host = el$('nav');
  clear(host);

  for (const item of NAV) {
    const count = item.badge === 'pending' ? pendingCount : 0;
    host.append(
      el(
        'a',
        {
          class: `nav-item ${active === item.path ? 'active' : ''}`,
          href: `#${item.path}`,
          onclick: (event) => {
            event.preventDefault();
            navigate(item.path);
          },
        },
        el('span', { class: 'nav-icon', text: item.icon }),
        el('span', { text: item.label }),
        count > 0 ? el('span', { class: 'nav-count', text: String(count) }) : null,
      ),
    );
  }
}

/** Refreshes the review-queue badge; called after any review action. */
export async function refreshBadges() {
  try {
    const stats = await api.overview();
    pendingCount = stats.videos.pending;
    renderNav();
    setHealth(true);
    return stats;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) setHealth(false);
    return null;
  }
}

function setHealth(ok) {
  const node = el$('health');
  node.className = `health ${ok ? 'ok' : 'bad'}`;
  node.textContent = ok ? '服务正常' : '连接失败';
}

/* ── 路由 ───────────────────────────────────────────────────────────── */

function mountViews() {
  for (const item of NAV) {
    register(item.path, {
      render(mount, ctx) {
        // Re-render the sidebar on every navigation: `renderNav` compares
        // against the current hash, and without this the active highlight
        // stays on whichever item was selected at login.
        renderNav();
        el$('page-title').textContent = item.view.meta?.title ?? item.label;
        el$('page-subtitle').textContent = item.view.meta?.subtitle ?? '';
        item.view.render(mount, { ...ctx, refreshBadges });
        // Fire-and-forget: keeps the review-queue badge honest as the user
        // moves around, without holding up the view that is already rendering.
        refreshBadges();
      },
    });
  }

  setNotFound({
    render(mount) {
      el$('page-title').textContent = '页面不存在';
      el$('page-subtitle').textContent = '';
      clear(mount);
      mount.append(
        el(
          'div',
          { class: 'empty' },
          el('div', { class: 'big', text: '🧭' }),
          el('div', { text: '这个地址没有对应的页面' }),
          el('div', { style: 'margin-top:14px' }, el('a', { href: '#/dashboard', class: 'btn btn-ghost btn-sm' }, '回到数据概览')),
        ),
      );
    },
  });
}

/* ── 启动 ───────────────────────────────────────────────────────────── */

async function boot() {
  setUnauthorizedHandler(() => {
    showLogin();
    toast('登录已过期，请重新登录', 'error');
  });

  el$('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = el$('login-error');
    error.hidden = true;

    const button = event.target.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = '登录中…';

    try {
      await api.login(el$('login-username').value.trim(), el$('login-password').value);
      await enterConsole();
      toast('登录成功', 'success');
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = '登录';
    }
  });

  el$('logout').addEventListener('click', async () => {
    await api.logout();
    session.clear();
    showLogin();
    toast('已退出登录', 'info');
  });

  el$('refresh').addEventListener('click', async () => {
    await refreshBadges();
    start();
    toast('已刷新', 'success', 1600);
  });

  // Validate a stored token before trusting it.
  if (session.token) {
    try {
      await api.me();
      await enterConsole();
      return;
    } catch {
      session.clear();
    }
  }
  showLogin();
}

async function enterConsole() {
  renderAdminChip();
  renderNav();
  mountViews();
  showConsole();
  await refreshBadges();
  start();
  // Keep the health pill honest without hammering the server.
  setInterval(() => {
    api.health().then(() => setHealth(true)).catch(() => setHealth(false));
  }, 30_000);
}

boot();
