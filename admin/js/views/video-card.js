/**
 * Shared video card, used by the video list and the review queue.
 *
 * Covers are shown as a still image; clicking swaps in a real `<video>` so the
 * reviewer can actually watch before approving. Only one plays at a time and
 * clicking again restores the poster, which keeps a grid of 20 cards cheap.
 */
import { api } from '../api.js';
import { avatar, el, fmtBytes, fmtCount, fmtDuration, relTime, statusBadge, toast } from '../ui.js';

let playing = null;

export function stopPlayback() {
  if (!playing) return;
  playing.pause();
  playing = null;
}

function swapInVideo(thumb, video) {
  const existing = thumb.querySelector('video');
  if (existing) {
    stopPlayback();
    existing.remove();
    return;
  }
  stopPlayback();

  const player = el('video', {
    src: video.filePath,
    controls: true,
    autoplay: true,
    playsinline: true,
    preload: 'metadata',
  });
  player.addEventListener('play', () => {
    if (playing && playing !== player) playing.pause();
    playing = player;
  });
  thumb.append(player);
}

export function videoCard(video, handlers = {}) {
  const { onOpen, onApprove, onReject, onDelete, onFeature, selectable = false, selected = false, onSelect } = handlers;

  const thumb = el('div', { class: 'video-thumb' });
  if (video.coverPath) {
    thumb.append(el('img', { src: video.coverPath, alt: '', loading: 'lazy' }));
  } else {
    thumb.append(el('div', { class: 'placeholder' }, '🎞️'));
  }

  thumb.append(statusBadge(video.status));
  if (video.featured) thumb.append(el('span', { class: 'badge badge-cyan', style: 'left:auto;right:8px' }, '推荐'));
  thumb.append(el('span', { class: 'video-duration', text: fmtDuration(video.durationSeconds) }));

  if (video.filePath) {
    // A transparent hit area over the poster; the real <video> replaces it.
    thumb.append(
      el('button', {
        type: 'button',
        'aria-label': '播放预览',
        style: 'position:absolute;inset:0;background:transparent;border:0;cursor:pointer',
        onclick: (event) => {
          event.stopPropagation();
          swapInVideo(thumb, video);
        },
      }),
    );
  }

  const checkbox = selectable
    ? el('input', {
        type: 'checkbox',
        checked: selected,
        'aria-label': '选择',
        style: 'position:absolute;top:10px;right:10px;width:17px;height:17px;z-index:2;cursor:pointer',
        onclick: (event) => {
          event.stopPropagation();
          onSelect?.(video.id, event.target.checked);
        },
      })
    : null;
  if (checkbox) thumb.append(checkbox);

  const actions = [];
  if (video.status !== 'approved' && onApprove) {
    actions.push(el('button', { class: 'btn btn-success btn-xs', type: 'button', onclick: () => onApprove(video) }, '通过'));
  }
  if (video.status !== 'rejected' && onReject) {
    actions.push(el('button', { class: 'btn btn-danger btn-xs', type: 'button', onclick: () => onReject(video) }, '驳回'));
  }
  if (onFeature) {
    actions.push(
      el(
        'button',
        { class: 'btn btn-ghost btn-xs', type: 'button', onclick: () => onFeature(video) },
        video.featured ? '取消推荐' : '推荐',
      ),
    );
  }
  if (actions.length < 3 && onDelete) {
    actions.push(el('button', { class: 'btn btn-ghost btn-xs', type: 'button', onclick: () => onDelete(video) }, '删除'));
  }

  return el(
    'article',
    { class: 'video-card' },
    thumb,
    el(
      'div',
      { class: 'video-body' },
      el('p', { class: 'video-caption', title: video.caption, text: video.caption || '（无文案）' }),
      el(
        'div',
        { class: 'video-meta' },
        avatar(video.user, 'sm'),
        el('span', { class: 'truncate', text: video.user?.name ?? '未知' }),
        video.user?.verified ? el('span', { class: 'verified', title: '已认证' }, '✓') : null,
      ),
      el(
        'div',
        { class: 'video-stats' },
        el('span', { title: '播放', text: `▶ ${fmtCount(video.metrics?.views)}` }),
        el('span', { title: '点赞', text: `♥ ${fmtCount(video.metrics?.likes)}` }),
        el('span', { title: '评论', text: `💬 ${fmtCount(video.metrics?.comments)}` }),
        el('span', { title: '大小', text: fmtBytes(video.sizeBytes) }),
      ),
      el('div', { class: 'video-meta' }, el('span', { class: 'faint', text: relTime(video.createdAt) })),
      actions.length
        ? el('div', { class: 'video-actions' }, actions)
        : el('div', { class: 'video-actions' }, el('button', { class: 'btn btn-ghost btn-xs', type: 'button', onclick: () => onOpen?.(video) }, '详情')),
    ),
    // Clicking the body (not the buttons) opens the detail drawer.
    el('button', {
      type: 'button',
      'aria-label': '查看详情',
      style: 'position:absolute;inset:0;background:transparent;border:0;cursor:default;pointer-events:none',
    }),
  );
}

/* ── 详情抽屉 ───────────────────────────────────────────────────────── */

export async function openVideoDrawer(video, { onChanged } = {}) {
  const { openDrawer, closeDrawer, confirmModal, promptModal, fmtDate } = await import('../ui.js');

  const reload = async () => {
    const data = await api.videos.get(video.id);
    closeDrawer();
    openVideoDrawer(data.video, { onChanged });
    return data;
  };

  const approve = async () => {
    await api.videos.update(video.id, { status: 'approved' });
    toast('已通过审核', 'success');
    onChanged?.();
    reload();
  };

  const reject = async () => {
    const reason = await promptModal({
      title: '驳回视频',
      label: '驳回原因（会展示给作者）',
      placeholder: '例如：画面模糊 / 内容重复 / 含违规信息',
      confirmText: '确认驳回',
    });
    if (reason === null) return;
    await api.videos.update(video.id, { status: 'rejected', rejectReason: reason });
    toast('已驳回', 'success');
    onChanged?.();
    reload();
  };

  const remove = async () => {
    const ok = await confirmModal({
      title: '删除视频',
      message: '视频文件与评论会一并删除，且不可恢复。确定继续吗？',
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    await api.videos.remove(video.id);
    toast('已删除', 'success');
    closeDrawer();
    onChanged?.();
  };

  const rows = [
    ['ID', el('span', { class: 'mono', text: video.id })],
    ['状态', statusBadge(video.status)],
    ['作者', el('div', { class: 'row' }, avatar(video.user, 'sm'), el('span', { text: `${video.user?.name ?? '—'} @${video.user?.handle ?? ''}` }))],
    ['文案', el('span', { text: video.caption || '—' })],
    ['话题', el('span', { text: video.tags?.length ? video.tags.join(' ') : '—' })],
    ['音乐', el('span', { text: video.music || '—' })],
    ['定位', el('span', { text: video.location || '—' })],
    ['时长 / 大小', el('span', { text: `${fmtDuration(video.durationSeconds)} · ${fmtBytes(video.sizeBytes)}` })],
    ['分辨率', el('span', { text: video.width && video.height ? `${video.width}×${video.height}` : '—' })],
    ['来源', el('span', { text: video.source === 'upload' ? '用户上传' : '种子数据' })],
    ['播放 / 点赞 / 评论', el('span', { text: `${fmtCount(video.metrics.views)} / ${fmtCount(video.metrics.likes)} / ${fmtCount(video.metrics.comments)}` })],
    ['上传时间', el('span', { text: fmtDate(video.createdAt) })],
    ['审核', el('span', { text: video.reviewedAt ? `${fmtDate(video.reviewedAt)} · ${video.reviewedBy ?? ''}` : '未审核' })],
    video.rejectReason ? ['驳回原因', el('span', { style: 'color:#ff8090', text: video.rejectReason })] : null,
  ].filter(Boolean);

  const media = el('div', { style: 'border-radius:10px;overflow:hidden;background:#000;aspect-ratio:3/4;max-height:420px;display:grid;place-items:center' });
  media.append(
    video.filePath
      ? el('video', { src: video.filePath, controls: true, playsinline: true, preload: 'metadata', style: 'width:100%;height:100%;object-fit:contain' })
      : el('span', { class: 'faint', text: '没有视频文件' }),
  );

  const comments = await api.videos.get(video.id).then((d) => d.comments).catch(() => []);

  openDrawer({
    title: video.caption?.slice(0, 26) || '视频详情',
    subtitle: `${video.user?.name ?? ''} · ${fmtDate(video.createdAt)}`,
    body: [
      media,
      el('dl', { class: 'kv' }, rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, v)])),
      el('div', { class: 'section-title', text: `评论 ${comments.length}` }),
      comments.length
        ? el(
            'div',
            { class: 'stack' },
            comments.slice(0, 12).map((c) =>
              el(
                'div',
                { class: 'card', style: 'padding:11px 13px' },
                el(
                  'div',
                  { class: 'row', style: 'margin-bottom:6px' },
                  avatar({ id: c.id, name: c.user_name, avatarUrl: c.user_avatar }, 'sm'),
                  el('span', { style: 'font-size:13px;font-weight:600', text: c.user_name ?? '匿名' }),
                  c.status === 'hidden' ? el('span', { class: 'badge badge-neutral', text: '已隐藏' }) : null,
                  el('span', { class: 'faint', style: 'margin-left:auto;font-size:12px', text: `♥ ${c.likes}` }),
                ),
                el('div', { style: 'font-size:13px;line-height:1.5', text: c.text }),
              ),
            ),
          )
        : el('p', { class: 'faint', text: '暂无评论' }),
    ],
    footer: [
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: closeDrawer }, '关闭'),
      el('button', { class: 'btn btn-danger', type: 'button', onclick: remove }, '删除'),
      el('button', { class: 'btn btn-primary', type: 'button', onclick: reject }, '驳回'),
      el('button', { class: 'btn btn-success', type: 'button', onclick: approve }, '通过'),
    ],
  });
}
