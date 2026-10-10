/** 评论管理：搜索、敏感词高亮、隐藏/恢复/删除。 */
import { api } from '../api.js';
import {
  avatar,
  clear,
  confirmModal,
  el,
  emptyState,
  fmtCount,
  highlightSensitive,
  loadingRows,
  pagination,
  relTime,
  toast,
} from '../ui.js';

export const meta = {
  title: '评论管理',
  subtitle: '评论审核与敏感内容排查',
};

const state = { page: 1, limit: 20, q: '', status: 'all', sensitive: false };

let mountEl = null;
let data = { items: [], total: 0, pages: 1 };

async function load() {
  data = await api.comments.list({
    page: state.page,
    limit: state.limit,
    q: state.q,
    status: state.status,
    sensitive: state.sensitive ? '1' : undefined,
  });
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
          placeholder: '搜索评论内容…',
          value: state.q,
          oninput: debounce((event) => {
            state.q = event.target.value.trim();
            state.page = 1;
            redraw();
          }, 300),
        }),
        el(
          'select',
          {
            onchange: (event) => {
              state.status = event.target.value;
              state.page = 1;
              redraw();
            },
          },
          [
            ['all', '全部状态'],
            ['visible', '可见'],
            ['hidden', '已隐藏'],
          ].map(([value, label]) => el('option', { value, selected: value === state.status }, label)),
        ),
        el(
          'label',
          { class: 'row', style: 'gap:7px;cursor:pointer;font-size:13px;color:var(--muted)' },
          el('input', {
            type: 'checkbox',
            checked: state.sensitive,
            onchange: (event) => {
              state.sensitive = event.target.checked;
              state.page = 1;
              redraw();
            },
          }),
          '只看命中敏感词',
        ),
      ),

      data.items.length === 0
        ? el('div', { class: 'card' }, emptyState('💬', '没有符合条件的评论'))
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
                  el('th', { text: '评论内容' }),
                  el('th', { text: '作者' }),
                  el('th', { text: '所属视频' }),
                  el('th', { class: 'num', text: '点赞' }),
                  el('th', { text: '状态' }),
                  el('th', { text: '时间' }),
                  el('th', { class: 'actions', text: '操作' }),
                ),
              ),
              el(
                'tbody',
                {},
                data.items.map((comment) =>
                  el(
                    'tr',
                    {},
                    el(
                      'td',
                      {},
                      el('div', {
                        style: 'max-width:380px;line-height:1.5',
                        html: highlightSensitive(comment.text, comment.sensitive),
                      }),
                      comment.sensitive?.length
                        ? el('div', { style: 'margin-top:5px' }, el('span', { class: 'badge badge-pending', text: `命中：${comment.sensitive.join('、')}` }))
                        : null,
                    ),
                    el(
                      'td',
                      {},
                      el(
                        'div',
                        { class: 'cell-main' },
                        avatar({ id: comment.user_handle ?? comment.id, name: comment.user_name, avatarUrl: comment.user_avatar }, 'sm'),
                        el('span', { style: 'font-size:13px', text: comment.user_name ?? '匿名' }),
                      ),
                    ),
                    el(
                      'td',
                      {},
                      el('div', { class: 'truncate', style: 'max-width:200px;font-size:12px;color:var(--muted)', text: comment.video_caption ?? '—' }),
                    ),
                    el('td', { class: 'num', text: fmtCount(comment.likes) }),
                    el(
                      'td',
                      {},
                      comment.status === 'hidden'
                        ? el('span', { class: 'badge badge-neutral', text: '已隐藏' })
                        : el('span', { class: 'badge badge-approved', text: '可见' }),
                    ),
                    el('td', { class: 'faint nowrap', text: relTime(comment.created_at) }),
                    el(
                      'td',
                      { class: 'actions' },
                      comment.status === 'hidden'
                        ? el('button', { class: 'btn btn-success btn-xs', type: 'button', onclick: () => setStatus(comment, 'visible') }, '恢复')
                        : el('button', { class: 'btn btn-ghost btn-xs', type: 'button', onclick: () => setStatus(comment, 'hidden') }, '隐藏'),
                      el('button', { class: 'btn btn-danger btn-xs', type: 'button', style: 'margin-left:5px', onclick: () => remove(comment) }, '删除'),
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

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function setStatus(comment, status) {
  await api.comments.update(comment.id, status);
  toast(status === 'hidden' ? '已隐藏' : '已恢复', 'success');
  await redraw();
}

async function remove(comment) {
  const ok = await confirmModal({
    title: '删除评论',
    message: `「${comment.text.slice(0, 30)}」将被永久删除。`,
    confirmText: '删除',
    danger: true,
  });
  if (!ok) return;
  await api.comments.remove(comment.id);
  toast('已删除', 'success');
  await redraw();
}

export async function render(mount, { query }) {
  mountEl = mount;
  if (query.status) state.status = query.status;
  if (query.sensitive === '1') state.sensitive = true;
  clear(mount);
  mount.append(loadingRows(6));
  await load();
  draw();
}
