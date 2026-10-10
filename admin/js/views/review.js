/**
 * 审核队列：待审核视频的专门工作台。
 *
 * 支持批量勾选 + 键盘快捷键（A 通过 / R 驳回 / 空格播放）。若没有勾选任何
 * 条目，快捷键作用于列表中的第一条，这样连续审核时不需要鼠标。
 */
import { api } from '../api.js';
import {
  clear,
  el,
  emptyState,
  fmtBytes,
  loadingRows,
  promptModal,
  relTime,
  toast,
} from '../ui.js';
import { stopPlayback, videoCard } from './video-card.js';

export const meta = {
  title: '审核队列',
  subtitle: '待审核的视频 · A 通过 / R 驳回 / 空格播放',
};

const selected = new Set();
let rerender = () => {};

async function approveMany(ids, { silent = false } = {}) {
  if (ids.length === 0) return;
  await api.videos.bulk(ids, 'approve');
  if (!silent) toast(`已通过 ${ids.length} 条`, 'success');
  ids.forEach((id) => selected.delete(id));
  await rerender();
}

async function rejectMany(ids) {
  if (ids.length === 0) return;
  const reason = await promptModal({
    title: `驳回 ${ids.length} 条视频`,
    label: '驳回原因（会展示给作者）',
    placeholder: '例如：画面模糊 / 内容重复 / 含违规信息',
    confirmText: '确认驳回',
  });
  if (reason === null) return;

  await api.videos.bulk(ids, 'reject', reason);
  toast(`已驳回 ${ids.length} 条`, 'success');
  ids.forEach((id) => selected.delete(id));
  await rerender();
}

export async function render(mount, { refreshBadges }) {
  clear(mount);
  mount.append(loadingRows(3));

  const load = async () => {
    const [pending, approved] = await Promise.all([
      api.videos.list({ status: 'pending', limit: 24 }),
      api.videos.list({ status: 'approved', limit: 6, sort: 'oldest' }),
    ]);
    return { pending: pending.items, approved: approved.items };
  };

  let data = await load();

  const draw = async () => {
    clear(mount);

    const ids = [...selected];

    mount.append(
      el(
        'div',
        { class: 'stack', style: 'gap:16px' },

        // ── 操作条 ──────────────────────────────────────────────────
        el(
          'div',
          { class: 'card', style: 'display:flex;align-items:center;gap:14px;flex-wrap:wrap' },
          el('div', { class: 'grow' },
            el('div', { style: 'font-weight:650', text: ids.length ? `已选中 ${ids.length} 条` : `待审核 ${data.pending.length} 条` }),
            el('div', { class: 'card-sub', text: ids.length ? '选择要执行的操作' : '勾选卡片可批量处理；未勾选时快捷键作用于第一条' }),
          ),
          ids.length
            ? el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { selected.clear(); draw(); } }, '取消选择')
            : null,
          el(
            'button',
            {
              class: 'btn btn-success btn-sm',
              type: 'button',
              disabled: data.pending.length === 0,
              onclick: () => approveMany(ids.length ? ids : [data.pending[0]?.id]).then(afterChange),
            },
            ids.length ? `批量通过 ${ids.length}` : '通过第一条',
          ),
          el(
            'button',
            {
              class: 'btn btn-danger btn-sm',
              type: 'button',
              disabled: data.pending.length === 0,
              onclick: () => rejectMany(ids.length ? ids : [data.pending[0]?.id]).then(afterChange),
            },
            ids.length ? `批量驳回 ${ids.length}` : '驳回第一条',
          ),
        ),

        // ── 待审核网格 ──────────────────────────────────────────────
        data.pending.length
          ? el(
              'div',
              { class: 'video-grid' },
              data.pending.map((video) =>
                videoCard(video, {
                  selectable: true,
                  selected: selected.has(video.id),
                  onSelect: (id, checked) => {
                    if (checked) selected.add(id);
                    else selected.delete(id);
                    draw();
                  },
                  onApprove: async (v) => {
                    await approveMany([v.id]);
                    afterChange();
                  },
                  onReject: async (v) => {
                    await rejectMany([v.id]);
                    afterChange();
                  },
                  onOpen: async (v) => {
                    const { openVideoDrawer } = await import('./video-card.js');
                    openVideoDrawer(v, { onChanged: afterChange });
                  },
                }),
              ),
            )
          : el('div', { class: 'card' }, emptyState('🎉', '审核队列已清空，没有待处理的视频')),

        // ── 最近通过 ────────────────────────────────────────────────
        data.approved.length
          ? el(
              'div',
              { class: 'card' },
              el('div', { class: 'card-head' }, el('h3', { text: '最近通过' })),
              el(
                'div',
                { class: 'stack', style: 'gap:9px' },
                data.approved.map((video) =>
                  el(
                    'div',
                    { class: 'row', style: 'gap:12px' },
                    el(
                      'div',
                      { style: 'width:38px;height:50px;border-radius:7px;overflow:hidden;flex:none;background:var(--surface-3);display:grid;place-items:center' },
                      video.coverPath ? el('img', { src: video.coverPath, alt: '', style: 'width:100%;height:100%;object-fit:cover', loading: 'lazy' }) : '🎞️',
                    ),
                    el(
                      'div',
                      { style: 'min-width:0;flex:1' },
                      el('div', { class: 'truncate', style: 'font-size:13px', text: video.caption }),
                      el('div', { class: 'faint', style: 'font-size:12px', text: `${video.user?.name ?? ''} · ${fmtBytes(video.sizeBytes)}` }),
                    ),
                    el('span', { class: 'faint', style: 'font-size:12px', text: relTime(video.createdAt) }),
                  ),
                ),
              ),
            )
          : null,
      ),
    );
  };

  const afterChange = async () => {
    data = await load();
    refreshBadges();
    await draw();
  };

  rerender = async () => {
    data = await load();
    refreshBadges();
    await draw();
  };

  refreshBadges();
  await draw();

  // ── 键盘快捷键 ────────────────────────────────────────────────────
  const onKey = (event) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (!location.hash.startsWith('#/review')) return;
    // Only act while the user is actually looking at this window. Without this
    // the queue approves videos in the background: a stray keypress from
    // another app, or an automation tool driving the same browser, lands here
    // and silently passes whatever is at the top of the list.
    if (!document.hasFocus()) return;
    // Auto-repeat would otherwise approve video after video while a key is
    // held down, with no way to undo. One press, one action.
    if (event.repeat) return;

    const ids = selected.size ? [...selected] : data.pending[0] ? [data.pending[0].id] : [];

    if (event.key === 'a' || event.key === 'A') {
      event.preventDefault();
      approveMany(ids).then(afterChange);
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      rejectMany(ids).then(afterChange);
    } else if (event.key === ' ') {
      event.preventDefault();
      const first = document.querySelector('#view .video-thumb button');
      first?.click();
    } else if (event.key === 'Escape') {
      selected.clear();
      draw();
    }
  };

  document.addEventListener('keydown', onKey);
  // Detach when the view is replaced by a navigation.
  const observer = new MutationObserver(() => {
    if (!document.body.contains(mount)) {
      document.removeEventListener('keydown', onKey);
      stopPlayback();
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('view').parentElement, { childList: true, subtree: true });
}
