/** 用户管理：搜索、筛选、封禁/解封、详情抽屉（含其作品与评论）。 */
import { api } from '../api.js';
import {
  avatar,
  clear,
  confirmModal,
  el,
  emptyState,
  fmtBytes,
  fmtCount,
  fmtDate,
  loadingRows,
  openDrawer,
  closeDrawer,
  pagination,
  promptModal,
  relTime,
  statusBadge,
  toast,
} from '../ui.js';

export const meta = {
  title: '用户管理',
  subtitle: '账号状态、内容产出与互动数据',
};

const state = {
  page: 1,
  limit: 20,
  q: '',
  status: 'all',
  verified: '',
  sort: 'newest',
};

let mountEl = null;
let data = { items: [], total: 0, pages: 1 };

async function load() {
  data = await api.users.list({ ...state, verified: state.verified || undefined });
  return data;
}

async function redraw() {
  await load();
  draw();
}

function draw() {
  const mount = mountEl;
  clear(mount);

  mount.append(
    el(
      'div',
      { class: 'stack', style: 'gap:14px' },
      el(
        'div',
        { class: 'toolbar' },
        el('input', {
          class: 'search',
          type: 'search',
          placeholder: '搜索昵称 / 抖音号 / ID…',
          value: state.q,
          oninput: debounce((event) => {
            state.q = event.target.value.trim();
            state.page = 1;
            redraw();
          }, 300),
        }),
        select([['all', '全部状态'], ['active', '正常'], ['banned', '已封禁']], state.status, (v) => {
          state.status = v;
          state.page = 1;
          redraw();
        }),
        select([['', '全部账号'], ['1', '仅认证'], ['0', '仅未认证']], state.verified, (v) => {
          state.verified = v;
          state.page = 1;
          redraw();
        }),
        select(
          [
            ['newest', '最新注册'],
            ['followers', '粉丝最多'],
            ['likes', '获赞最多'],
            ['videos', '作品最多'],
            ['active', '最近活跃'],
          ],
          state.sort,
          (v) => {
            state.sort = v;
            state.page = 1;
            redraw();
          },
        ),
      ),

      data.items.length === 0
        ? el('div', { class: 'card' }, emptyState('🔍', '没有符合条件的用户'))
        : el(
            'div',
            { class: 'table-wrap' },
            el(
              'table',
              {},
              el(
                'thead',
                {},
                el(
                  'tr',
                  {},
                  el('th', { text: '用户' }),
                  el('th', { class: 'num', text: '粉丝' }),
                  el('th', { class: 'num', text: '获赞' }),
                  el('th', { class: 'num', text: '作品' }),
                  el('th', { text: '状态' }),
                  el('th', { text: '注册时间' }),
                  el('th', { text: '最后活跃' }),
                  el('th', { class: 'actions', text: '操作' }),
                ),
              ),
              el(
                'tbody',
                {},
                data.items.map((user) =>
                  el(
                    'tr',
                    {},
                    el(
                      'td',
                      {},
                      el(
                        'div',
                        { class: 'cell-main' },
                        avatar(user, 'sm'),
                        el(
                          'div',
                          { style: 'min-width:0' },
                          el(
                            'div',
                            { class: 'cell-title' },
                            user.name,
                            user.verified ? el('span', { class: 'verified', style: 'margin-left:5px', title: '已认证' }, '✓') : null,
                          ),
                          el('div', { class: 'cell-sub mono', text: `@${user.handle}` }),
                        ),
                      ),
                    ),
                    el('td', { class: 'num', text: fmtCount(user.followers) }),
                    el('td', { class: 'num', text: fmtCount(user.likes) }),
                    el('td', { class: 'num', text: String(user.video_count ?? 0) }),
                    el(
                      'td',
                      {},
                      user.status === 'banned'
                        ? el('span', { class: 'badge badge-rejected', title: user.ban_reason ?? '', text: '已封禁' })
                        : el('span', { class: 'badge badge-approved', text: '正常' }),
                    ),
                    el('td', { class: 'faint', text: fmtDate(user.created_at) }),
                    el('td', { class: 'faint', text: relTime(user.last_active_at) }),
                    el(
                      'td',
                      { class: 'actions' },
                      el('button', { class: 'btn btn-ghost btn-xs', type: 'button', onclick: () => openUser(user.id) }, '详情'),
                      user.status === 'banned'
                        ? el('button', { class: 'btn btn-success btn-xs', type: 'button', style: 'margin-left:5px', onclick: () => unban(user) }, '解封')
                        : el('button', { class: 'btn btn-danger btn-xs', type: 'button', style: 'margin-left:5px', onclick: () => ban(user) }, '封禁'),
                    ),
                  ),
                ),
              ),
            ),
          ),

      pagination({
        page: data.page,
        pages: data.pages,
        total: data.total,
        onPage: (page) => {
          state.page = page;
          redraw();
          mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      }),
    ),
  );
}

function select(options, value, onChange) {
  return el(
    'select',
    { onchange: (event) => onChange(event.target.value) },
    options.map(([val, label]) => el('option', { value: val, selected: val === value }, label)),
  );
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function ban(user) {
  const reason = await promptModal({
    title: `封禁 ${user.name}`,
    label: '封禁原因（内部记录）',
    placeholder: '例如：发布违规内容',
    confirmText: '确认封禁',
  });
  if (reason === null) return;
  await api.users.update(user.id, { status: 'banned', banReason: reason });
  toast(`已封禁 ${user.name}`, 'success');
  await redraw();
}

async function unban(user) {
  await api.users.update(user.id, { status: 'active' });
  toast(`已解封 ${user.name}`, 'success');
  await redraw();
}

export async function openUser(id) {
  const detail = await api.users.get(id);
  const { user, videos, comments, totals } = detail;

  const body = [
    el(
      'div',
      { class: 'row', style: 'gap:14px' },
      avatar(user, 'lg'),
      el(
        'div',
        { style: 'min-width:0' },
        el('div', { style: 'font-size:17px;font-weight:700' }, user.name, user.verified ? el('span', { class: 'verified', style: 'margin-left:6px' }, '✓') : null),
        el('div', { class: 'faint mono', style: 'font-size:12px', text: `@${user.handle} · ${user.id}` }),
        el('div', { class: 'row', style: 'margin-top:7px;gap:7px' },
          user.status === 'banned'
            ? el('span', { class: 'badge badge-rejected', text: '已封禁' })
            : el('span', { class: 'badge badge-approved', text: '正常' }),
          user.verified ? el('span', { class: 'badge badge-cyan', text: '已认证' }) : null,
        ),
      ),
    ),

    user.bio ? el('p', { class: 'muted', style: 'font-size:13px', text: user.bio }) : null,
    user.ban_reason ? el('p', { style: 'color:#ff8090;font-size:13px', text: `封禁原因：${user.ban_reason}` }) : null,

    el(
      'div',
      { class: 'stat-grid', style: 'grid-template-columns:repeat(4,1fr)' },
      miniStat('粉丝', fmtCount(user.followers)),
      miniStat('关注', fmtCount(user.following)),
      miniStat('获赞', fmtCount(user.likes)),
      miniStat('作品', String(videos.length)),
    ),

    el(
      'dl',
      { class: 'kv' },
      el('dt', { text: '总播放' }), el('dd', { text: fmtCount(totals.views) }),
      el('dt', { text: '作品占存' }), el('dd', { text: fmtBytes(totals.bytes) }),
      el('dt', { text: '注册' }), el('dd', { text: fmtDate(user.created_at) }),
      el('dt', { text: '最后活跃' }), el('dd', { text: fmtDate(user.last_active_at) }),
    ),

    el('div', { class: 'section-title', text: `作品 ${videos.length}` }),
    videos.length
      ? el(
          'div',
          { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px' },
          videos.map((video) =>
            el(
              'div',
              { style: 'border-radius:8px;overflow:hidden;background:var(--surface-3);aspect-ratio:3/4;position:relative' },
              video.cover_path
                ? el('img', { src: video.cover_path, alt: '', style: 'width:100%;height:100%;object-fit:cover', loading: 'lazy' })
                : el('div', { style: 'display:grid;place-items:center;height:100%', text: '🎞️' }),
              el('div', { style: 'position:absolute;top:5px;left:5px' }, statusBadge(video.status)),
            ),
          ),
        )
      : el('p', { class: 'faint', text: '还没有作品' }),

    el('div', { class: 'section-title', text: `最近评论 ${comments.length}` }),
    comments.length
      ? el(
          'div',
          { class: 'stack', style: 'gap:8px' },
          comments.map((c) =>
            el(
              'div',
              { class: 'card', style: 'padding:10px 12px' },
              el('div', { style: 'font-size:13px', text: c.text }),
              el('div', { class: 'faint', style: 'font-size:11px;margin-top:5px', text: `${relTime(c.created_at)} · ♥ ${c.likes}${c.status === 'hidden' ? ' · 已隐藏' : ''}` }),
            ),
          ),
        )
      : el('p', { class: 'faint', text: '暂无评论' }),
  ];

  const remove = async () => {
    const ok = await confirmModal({
      title: `删除用户 ${user.name}`,
      message: `该用户的 ${videos.length} 个视频与全部评论会一并删除，不可恢复。`,
      confirmText: '永久删除',
      danger: true,
    });
    if (!ok) return;
    const result = await api.users.remove(user.id);
    toast(`已删除，连带 ${result.deletedVideos} 个视频`, 'success');
    closeDrawer();
    await redraw();
  };

  openDrawer({
    title: user.name,
    subtitle: `@${user.handle}`,
    body,
    footer: [
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: closeDrawer }, '关闭'),
      el('button', { class: 'btn btn-danger', type: 'button', onclick: remove }, '删除用户'),
      user.status === 'banned'
        ? el('button', { class: 'btn btn-success', type: 'button', onclick: async () => { await unban(user); closeDrawer(); } }, '解封')
        : el('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { await ban(user); closeDrawer(); } }, '封禁'),
    ],
  });
}

const miniStat = (label, value) =>
  el(
    'div',
    { style: 'background:var(--surface-2);border-radius:9px;padding:10px 12px' },
    el('div', { class: 'faint', style: 'font-size:11px', text: label }),
    el('div', { style: 'font-size:17px;font-weight:700;font-variant-numeric:tabular-nums', text: value }),
  );

export async function render(mount, { query }) {
  mountEl = mount;
  if (query.status) state.status = query.status;
  if (query.q) state.q = query.q;
  clear(mount);
  mount.append(loadingRows(6));
  await load();
  draw();
}
