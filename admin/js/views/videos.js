/** 视频管理：搜索、按状态/来源筛选、网格与列表双视图、批量操作。 */
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
  fmtDuration,
  loadingRows,
  pagination,
  promptModal,
  relTime,
  statusBadge,
  toast,
} from '../ui.js';
import { openVideoDrawer, stopPlayback, videoCard } from './video-card.js';

export const meta = {
  title: '视频管理',
  subtitle: '全部视频内容与审核状态',
};

const state = {
  page: 1,
  limit: 12,
  q: '',
  status: 'all',
  source: 'all',
  sort: 'newest',
  view: 'grid',
  selected: new Set(),
};

let data = { items: [], total: 0, pages: 1 };
let mountEl = null;
let initialized = false;

async function load() {
  const result = await api.videos.list({
    page: state.page,
    limit: state.limit,
    q: state.q,
    status: state.status,
    source: state.source,
    sort: state.sort,
  });
  data = result;
  return result;
}

async function redraw() {
  if (!mountEl) return;
  await load();
  draw();
}

function draw() {
  const mount = mountEl;
  clear(mount);
  const ids = [...state.selected];

  mount.append(
    el(
      'div',
      { class: 'stack', style: 'gap:14px' },

      // ── 筛选栏 ────────────────────────────────────────────────────
      el(
        'div',
        { class: 'toolbar' },
        el('input', {
          class: 'search',
          type: 'search',
          placeholder: '搜索文案 / 音乐 / 作者…',
          value: state.q,
          oninput: debounce((event) => {
            state.q = event.target.value.trim();
            state.page = 1;
            redraw();
          }, 300),
        }),
        select(
          [
            ['all', '全部状态'],
            ['pending', '待审核'],
            ['approved', '已通过'],
            ['rejected', '已驳回'],
          ],
          state.status,
          (value) => {
            state.status = value;
            state.page = 1;
            redraw();
          },
        ),
        select(
          [
            ['all', '全部来源'],
            ['upload', '用户上传'],
            ['seed', '种子数据'],
          ],
          state.source,
          (value) => {
            state.source = value;
            state.page = 1;
            redraw();
          },
        ),
        select(
          [
            ['newest', '最新优先'],
            ['oldest', '最早优先'],
            ['views', '播放最多'],
            ['likes', '点赞最多'],
            ['size', '文件最大'],
          ],
          state.sort,
          (value) => {
            state.sort = value;
            state.page = 1;
            redraw();
          },
        ),
        el('div', { class: 'grow' }),
        el(
          'div',
          { style: 'display:flex;gap:4px' },
          el('button', { class: `btn btn-sm ${state.view === 'grid' ? 'btn-primary' : 'btn-ghost'}`, type: 'button', onclick: () => { state.view = 'grid'; draw(); } }, '网格'),
          el('button', { class: `btn btn-sm ${state.view === 'list' ? 'btn-primary' : 'btn-ghost'}`, type: 'button', onclick: () => { state.view = 'list'; draw(); } }, '列表'),
        ),
      ),

      // ── 批量操作条 ────────────────────────────────────────────────
      ids.length
        ? el(
            'div',
            { class: 'card', style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap' },
            el('strong', { text: `已选中 ${ids.length} 条` }),
            el('div', { class: 'grow' }),
            el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { state.selected.clear(); draw(); } }, '取消选择'),
            el('button', { class: 'btn btn-success btn-sm', type: 'button', onclick: () => bulk('approve') }, '批量通过'),
            el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: () => bulk('reject') }, '批量驳回'),
            el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: () => bulk('delete') }, '批量删除'),
          )
        : null,

      // ── 内容 ──────────────────────────────────────────────────────
      data.items.length === 0
        ? el('div', { class: 'card' }, emptyState('🔍', '没有符合条件的视频'))
        : state.view === 'grid'
          ? el(
              'div',
              { class: 'video-grid' },
              data.items.map((video) =>
                videoCard(video, {
                  selectable: true,
                  selected: state.selected.has(video.id),
                  onSelect: (id, checked) => {
                    if (checked) state.selected.add(id);
                    else state.selected.delete(id);
                    draw();
                  },
                  onApprove: (v) => patch(v, { status: 'approved' }, '已通过'),
                  onReject: async (v) => {
                    const reason = await promptModal({
                      title: '驳回视频',
                      label: '驳回原因',
                      placeholder: '例如：画面模糊 / 内容重复',
                      confirmText: '确认驳回',
                    });
                    if (reason !== null) patch(v, { status: 'rejected', rejectReason: reason }, '已驳回');
                  },
                  onDelete: (v) => removeOne(v),
                  onOpen: (v) => openVideoDrawer(v, { onChanged: redraw }),
                }),
              ),
            )
          : tableView(),

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

function tableView() {
  return el(
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
          el('th', { style: 'width:38px' }),
          el('th', { text: '视频' }),
          el('th', { text: '作者' }),
          el('th', { text: '状态' }),
          el('th', { class: 'num', text: '播放' }),
          el('th', { class: 'num', text: '点赞' }),
          el('th', { class: 'num', text: '评论' }),
          el('th', { class: 'num', text: '大小' }),
          el('th', { text: '上传时间' }),
          el('th', { class: 'actions', text: '操作' }),
        ),
      ),
      el(
        'tbody',
        {},
        data.items.map((video) =>
          el(
            'tr',
            {},
            el(
              'td',
              {},
              el('input', {
                type: 'checkbox',
                checked: state.selected.has(video.id),
                'aria-label': '选择',
                onchange: (event) => {
                  if (event.target.checked) state.selected.add(video.id);
                  else state.selected.delete(video.id);
                  draw();
                },
              }),
            ),
            el(
              'td',
              {},
              el(
                'div',
                { class: 'cell-main' },
                el(
                  'div',
                  { style: 'width:34px;height:45px;border-radius:6px;overflow:hidden;flex:none;background:var(--surface-3);display:grid;place-items:center' },
                  video.coverPath ? el('img', { src: video.coverPath, alt: '', style: 'width:100%;height:100%;object-fit:cover', loading: 'lazy' }) : '🎞️',
                ),
                el(
                  'div',
                  { style: 'min-width:0' },
                  el('div', { class: 'cell-title truncate', style: 'max-width:260px', text: video.caption || '（无文案）' }),
                  el('div', { class: 'cell-sub', text: `${fmtDuration(video.durationSeconds)} · ${video.tags?.join(' ') || '无话题'}` }),
                ),
              ),
            ),
            el('td', {}, el('div', { class: 'row' }, avatar(video.user, 'sm'), el('span', { text: video.user?.name ?? '—' }))),
            el('td', {}, statusBadge(video.status), video.featured ? el('span', { class: 'badge badge-cyan', style: 'margin-left:5px' }, '推荐') : null),
            el('td', { class: 'num', text: fmtCount(video.metrics.views) }),
            el('td', { class: 'num', text: fmtCount(video.metrics.likes) }),
            el('td', { class: 'num', text: fmtCount(video.metrics.comments) }),
            el('td', { class: 'num', text: fmtBytes(video.sizeBytes) }),
            el('td', { title: fmtDate(video.createdAt), text: relTime(video.createdAt) }),
            el(
              'td',
              { class: 'actions' },
              el('button', { class: 'btn btn-ghost btn-xs', type: 'button', onclick: () => openVideoDrawer(video, { onChanged: redraw }) }, '详情'),
              el('button', { class: 'btn btn-danger btn-xs', type: 'button', style: 'margin-left:5px', onclick: () => removeOne(video) }, '删除'),
            ),
          ),
        ),
      ),
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

async function patch(video, body, message) {
  await api.videos.update(video.id, body);
  toast(message, 'success');
  await redraw();
}

async function removeOne(video) {
  const ok = await confirmModal({
    title: '删除视频',
    message: `将删除《${(video.caption || '无文案').slice(0, 20)}》及其评论和文件，不可恢复。`,
    confirmText: '删除',
    danger: true,
  });
  if (!ok) return;
  await api.videos.remove(video.id);
  state.selected.delete(video.id);
  toast('已删除', 'success');
  await redraw();
}

async function bulk(action) {
  const ids = [...state.selected];
  if (ids.length === 0) return;

  let reason;
  if (action === 'reject') {
    reason = await promptModal({
      title: `驳回 ${ids.length} 条视频`,
      label: '驳回原因',
      placeholder: '例如：内容重复',
      confirmText: '确认驳回',
    });
    if (reason === null) return;
  }
  if (action === 'delete') {
    const ok = await confirmModal({
      title: `删除 ${ids.length} 条视频`,
      message: '文件与评论会一并删除，且不可恢复。',
      confirmText: '全部删除',
      danger: true,
    });
    if (!ok) return;
  }

  const result = await api.videos.bulk(ids, action, reason);
  state.selected.clear();
  toast(`已处理 ${result.affected} 条`, 'success');
  await redraw();
}

export async function render(mount, { query }) {
  mountEl = mount;

  // A deep link (e.g. `#/videos?status=pending`) seeds the filter once.
  if (!initialized || query.status) {
    if (query.status) state.status = query.status;
    if (query.q) state.q = query.q;
    if (query.source) state.source = query.source;
    state.page = 1;
    initialized = true;
  }

  stopPlayback();
  clear(mount);
  mount.append(loadingRows(4));
  await load();
  draw();
}
