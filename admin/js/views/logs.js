/** 操作日志：所有管理动作的审计留痕。 */
import { api } from '../api.js';
import { clear, el, emptyState, fmtDate, loadingRows, pagination } from '../ui.js';

export const meta = {
  title: '操作日志',
  subtitle: '每一次审核、封禁与删除都有记录',
};

const state = { page: 1, limit: 30 };

/** 把内部动作名翻译成中文，顺便决定徽标颜色。 */
const ACTIONS = {
  'video.approve': ['通过视频', 'badge-approved'],
  'video.reject': ['驳回视频', 'badge-rejected'],
  'video.feature': ['设为推荐', 'badge-cyan'],
  'video.update': ['修改视频', 'badge-neutral'],
  'video.delete': ['删除视频', 'badge-rejected'],
  'video.upload': ['用户上传', 'badge-neutral'],
  'video.bulk.approve': ['批量通过', 'badge-approved'],
  'video.bulk.reject': ['批量驳回', 'badge-rejected'],
  'video.bulk.delete': ['批量删除', 'badge-rejected'],
  'user.update': ['修改用户', 'badge-neutral'],
  'user.delete': ['删除用户', 'badge-rejected'],
  'comment.hide': ['隐藏评论', 'badge-pending'],
  'comment.restore': ['恢复评论', 'badge-approved'],
  'comment.delete': ['删除评论', 'badge-rejected'],
  seed: ['初始化数据', 'badge-neutral'],
};

const TARGET_LABEL = { video: '视频', user: '用户', comment: '评论', database: '数据库' };

let mountEl = null;
let data = { items: [], total: 0, pages: 1 };

async function redraw() {
  data = await api.logs.list(state);
  draw();
}

function draw() {
  const mount = mountEl;
  clear(mount);

  mount.append(
    el(
      'div',
      { class: 'stack', style: 'gap:14px' },
      data.items.length === 0
        ? el('div', { class: 'card' }, emptyState('📜', '还没有操作记录'))
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
                  el('th', { style: 'width:170px', text: '时间' }),
                  el('th', { style: 'width:130px', text: '操作人' }),
                  el('th', { style: 'width:140px', text: '动作' }),
                  el('th', { style: 'width:110px', text: '对象' }),
                  el('th', { text: '详情' }),
                ),
              ),
              el(
                'tbody',
                {},
                data.items.map((log) => {
                  const [label, cls] = ACTIONS[log.action] ?? [log.action, 'badge-neutral'];
                  return el(
                    'tr',
                    {},
                    el('td', { class: 'faint nowrap', text: fmtDate(log.created_at) }),
                    el('td', {}, el('span', { class: 'mono', style: 'font-size:12px', text: log.admin_name ?? 'system' })),
                    el('td', {}, el('span', { class: `badge ${cls}`, text: label })),
                    el(
                      'td',
                      { class: 'faint' },
                      log.target_type ? `${TARGET_LABEL[log.target_type] ?? log.target_type}${log.target_id ? ` #${String(log.target_id).slice(0, 14)}` : ''}` : '—',
                    ),
                    el('td', { class: 'mono', style: 'font-size:12px;color:var(--muted);word-break:break-all', text: log.detail ?? '—' }),
                  );
                }),
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

export async function render(mount) {
  mountEl = mount;
  clear(mount);
  mount.append(loadingRows(8));
  await redraw();
}
