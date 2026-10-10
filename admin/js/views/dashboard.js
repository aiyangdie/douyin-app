/** 数据概览：核心指标、14 天趋势、待审核快捷入口。 */
import { api } from '../api.js';
import { avatar, clear, el, emptyState, fmtBytes, fmtCount, loadingRows, relTime } from '../ui.js';

export const meta = {
  title: '数据概览',
  subtitle: '平台整体状况与待处理事项',
};

function statCard({ label, value, note, noteClass = '', accent }) {
  return el(
    'div',
    { class: 'stat', style: accent ? `--accent:${accent}` : '' },
    el('div', { class: 'stat-label', text: label }),
    el('div', { class: 'stat-value', text: value }),
    note ? el('div', { class: `stat-note ${noteClass}`, text: note }) : null,
  );
}

function trendChart(trend) {
  const max = Math.max(1, ...trend.map((p) => Math.max(p.videos, p.users)));

  return el(
    'div',
    {},
    el(
      'div',
      { class: 'chart' },
      trend.map((point) =>
        el(
          'div',
          { class: 'chart-col', title: `${point.date}\n上传 ${point.videos} · 新增用户 ${point.users}` },
          el('div', { class: 'chart-bar', style: `height:${(point.videos / max) * 100}%` }),
          el('div', { class: 'chart-bar users', style: `height:${(point.users / max) * 100}%` }),
        ),
      ),
    ),
    el(
      'div',
      { class: 'chart-legend' },
      el('span', {}, el('i', { style: 'background:var(--brand)' }), '视频上传'),
      el('span', {}, el('i', { style: 'background:var(--cyan)' }), '新增用户'),
      el('span', { class: 'faint', style: 'margin-left:auto', text: `${trend[0]?.date} 至 ${trend.at(-1)?.date}` }),
    ),
  );
}

export async function render(mount, { refreshBadges }) {
  clear(mount);
  mount.append(loadingRows(4));

  const [stats, pending] = await Promise.all([api.overview(), api.pendingQueue()]);
  clear(mount);

  const { users, videos, engagement, comments } = stats;

  mount.append(
    el(
      'div',
      { class: 'stack', style: 'gap:18px' },

      // ── 指标卡 ────────────────────────────────────────────────────
      el(
        'div',
        { class: 'stat-grid' },
        statCard({ label: '总用户', value: fmtCount(users.total), note: `今日 +${users.newToday} · 近 7 天 +${users.new7d}`, accent: 'var(--cyan)' }),
        statCard({ label: '总视频', value: fmtCount(videos.total), note: `今日 +${videos.newToday} · 用户上传 ${videos.uploaded}`, accent: 'var(--brand)' }),
        statCard({ label: '待审核', value: fmtCount(videos.pending), note: videos.pending > 0 ? '需要处理' : '已清空', noteClass: videos.pending > 0 ? 'warn' : '', accent: 'var(--warn)' }),
        statCard({ label: '已通过', value: fmtCount(videos.approved), note: `推荐中 ${videos.featured}`, accent: 'var(--success)' }),
        statCard({ label: '总播放', value: fmtCount(engagement.views), note: `点赞 ${fmtCount(engagement.likes)}` }),
        statCard({ label: '存储占用', value: fmtBytes(videos.storageBytes), note: `${videos.total} 个视频文件` }),
      ),

      // ── 趋势 ──────────────────────────────────────────────────────
      el(
        'div',
        { class: 'card' },
        el(
          'div',
          { class: 'card-head' },
          el('div', {}, el('h3', { text: '近 14 天趋势' }), el('p', { class: 'card-sub', text: '视频上传量与新增用户数' })),
        ),
        trendChart(stats.trend),
      ),

      // ── 待审核 ────────────────────────────────────────────────────
      el(
        'div',
        { class: 'card' },
        el(
          'div',
          { class: 'card-head' },
          el('div', {}, el('h3', { text: '待审核队列' }), el('p', { class: 'card-sub', text: `共 ${videos.pending} 条等待处理` })),
          el('a', { class: 'btn btn-primary btn-sm', href: '#/review' }, '进入审核'),
        ),
        pending.items.length
          ? el(
              'div',
              { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px' },
              pending.items.map((video) =>
                el(
                  'a',
                  {
                    href: '#/review',
                    style: 'display:flex;gap:12px;padding:11px;border:1px solid var(--border);border-radius:10px;text-decoration:none;color:inherit;align-items:center',
                  },
                  el(
                    'div',
                    { style: 'width:56px;height:74px;border-radius:8px;overflow:hidden;flex:none;background:var(--surface-3);display:grid;place-items:center' },
                    video.coverUrl
                      ? el('img', { src: video.coverUrl, alt: '', style: 'width:100%;height:100%;object-fit:cover', loading: 'lazy' })
                      : el('span', { text: '🎞️' }),
                  ),
                  el(
                    'div',
                    { style: 'min-width:0;flex:1' },
                    el('div', { class: 'truncate', style: 'font-size:13px;font-weight:600', text: video.caption || '（无文案）' }),
                    el('div', { class: 'row', style: 'margin-top:6px' }, avatar(video.user, 'sm'), el('span', { class: 'faint', style: 'font-size:12px', text: video.user?.name ?? '' })),
                    el('div', { class: 'faint', style: 'font-size:11px;margin-top:5px', text: `${relTime(video.createdAt)} · ${fmtBytes(video.sizeBytes)}` }),
                  ),
                ),
              ),
            )
          : emptyState('✅', '没有待审核的视频'),
      ),

      // ── 次级指标 ──────────────────────────────────────────────────
      el(
        'div',
        { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px' },
        el(
          'div',
          { class: 'card' },
          el('div', { class: 'card-head' }, el('h3', { text: '用户构成' })),
          el(
            'dl',
            { class: 'kv' },
            el('dt', { text: '正常' }), el('dd', { text: `${fmtCount(users.active)} 人` }),
            el('dt', { text: '已封禁' }), el('dd', { text: `${fmtCount(users.banned)} 人` }),
            el('dt', { text: '已认证' }), el('dd', { text: `${fmtCount(users.verified)} 人` }),
            el('dt', { text: '封禁率' }), el('dd', {}, el('div', { class: 'progress', style: 'max-width:180px' }, el('i', { style: `width:${users.total ? (users.banned / users.total) * 100 : 0}%` }))),
          ),
        ),
        el(
          'div',
          { class: 'card' },
          el('div', { class: 'card-head' }, el('h3', { text: '内容与互动' })),
          el(
            'dl',
            { class: 'kv' },
            el('dt', { text: '评论总数' }), el('dd', { text: `${fmtCount(comments.total)} 条` }),
            el('dt', { text: '已隐藏' }), el('dd', { text: `${fmtCount(comments.hidden)} 条` }),
            el('dt', { text: '收藏' }), el('dd', { text: fmtCount(engagement.favorites) }),
            el('dt', { text: '分享' }), el('dd', { text: fmtCount(engagement.shares) }),
            el('dt', { text: '已驳回' }), el('dd', { text: `${fmtCount(videos.rejected)} 条` }),
          ),
        ),
      ),
    ),
  );

  refreshBadges();
}
