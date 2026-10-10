/**
 * Seeds the database so the admin has real data to work with immediately.
 *
 * Imports the app's existing fixtures (8 creators, the signed-in user, 8 videos
 * and their comment threads) and copies the matching media out of `assets/`
 * into `server/uploads/`, so every seeded video is actually playable in the
 * admin. A batch of synthetic accounts is added on top to make the user list
 * realistic (search, filtering and pagination need more than nine rows).
 *
 * Idempotent: re-running without --force does nothing once seeded.
 *
 *   node seed.js           # seed if empty
 *   node seed.js --force   # wipe and reseed
 */
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashPassword } from './auth.js';
import { AVATAR_DIR, COVER_DIR, VIDEO_DIR, daysAgo, get, nowIso, run } from './db.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');

export const DEFAULT_ADMIN = { username: 'admin', password: 'admin123' };

const CREATORS = [
  ['u1', '夜行者Leo', 'leo_nightwalk', '城市夜景摄影｜走了 37 个城市的天台', 1, 312, 1_284_000, 18_920_000],
  ['u2', '旅行的鱼', 'fish_travel', '在海边住了一整年 🐟 日落收集者', 1, 208, 862_000, 9_140_000],
  ['u3', '慢生活研究所', 'slowlab', '一杯咖啡的时间，聊聊怎么把日子过慢', 0, 421, 396_000, 4_530_000],
  ['u4', '橘猫日记', 'orange_cat_diary', '家里有两只橘，一只胖，另一只更胖', 0, 96, 2_310_000, 41_600_000],
  ['u5', '铁馆阿哲', 'iron_zhe', '健身教练｜带 8000 人减掉第一斤', 1, 154, 674_000, 7_820_000],
  ['u6', '深夜提交', 'midnight_commit', '写了 12 年代码，还在改 bug', 0, 63, 528_000, 6_070_000],
  ['u7', '干饭人小鹿', 'deer_eats', '探店 600 家｜只推荐自己会再去的', 1, 507, 1_960_000, 28_400_000],
  ['u8', '背包客阿May', 'may_onroad', '一个人走了 23 个国家｜路上见', 0, 289, 443_000, 5_260_000],
  ['me', '小怂猪', 'xiaosongzhu', '记录一下，随便拍拍 📷', 0, 128, 2_431, 18_602],
];

// id, user, caption, tags, music, location, likes, comments, favorites, shares, status, featured, age(days)
// Ages are deliberately kept inside the dashboard's 14-day window so the trend
// chart shows a real curve instead of one lonely spike.
const VIDEOS = [
  ['v1', 'u1', '凌晨三点的城市，比白天诚实得多。', ['#城市夜景', '#摄影', '#夜行者'], '夜行 · 原声 - 夜行者Leo', '上海·外滩', 128_400, 2_431, 18_920, 6_742, 'approved', 0, 13],
  ['v2', 'u2', '等了 40 分钟，就为这 12 秒的落日。值。', ['#日落', '#海边', '#治愈'], 'Golden Hour - JVKE', '青岛·石老人', 342_800, 8_164, 92_310, 21_530, 'approved', 1, 11],
  ['v3', 'u3', '手冲第三年，终于明白「慢」不是速度，是注意力。', ['#手冲咖啡', '#慢生活', '#咖啡日常'], 'Coffee - beabadoobee', null, 76_520, 1_893, 24_070, 4_118, 'approved', 0, 9],
  ['v4', 'u4', '它每天准点坐在这里等我下班，一秒不差。', ['#橘猫', '#猫日常', '#萌宠'], 'Happy Cat - 原声', '家', 892_300, 15_720, 143_600, 52_940, 'approved', 0, 7],
  ['v5', 'u5', '减脂期最容易被忽略的 3 个细节，第 2 个我踩了两年坑。', ['#健身', '#减脂', '#新手健身'], 'Pump It - Black Eyed Peas', null, 214_700, 6_308, 88_450, 19_260, 'approved', 0, 5],
  ['v6', 'u6', '凌晨两点改完最后一个 issue，窗外开始亮了。', ['#程序员', '#代码人生', '#加班'], 'Lo-fi Coding Beats - 深夜电台', '深圳·南山', 158_900, 4_762, 61_230, 12_840, 'pending', 0, 3],
  ['v7', 'u7', '开了 20 年的深夜面馆，老板说他只做一种面。', ['#深夜食堂', '#探店', '#城市烟火'], '深夜食堂 - 原声', '成都·玉林', 476_100, 11_240, 105_800, 38_620, 'approved', 1, 6],
  ['v8', 'u8', '一个人旅行的第 23 天，学会了自己跟自己聊天。', ['#旅行vlog', '#一个人旅行', '#背包客'], 'On the Road - 原声', '大理·洱海', 93_640, 2_915, 33_470, 8_106, 'pending', 0, 1],
];

// videoId, authorId, text, likes, replies[]
const COMMENTS = [
  ['v1', 'u2', '这个机位是哪个天台啊，求个位置 🙏', 1284, [['u1', '私你了，注意安全，别翻栏杆', 642], ['u3', '同求！', 38]]],
  ['v1', 'u6', '凌晨三点的城市确实安静，安静到能听见自己敲键盘的声音', 856, []],
  ['v1', 'u5', '构图太顶了，这个蓝调时刻抓得准', 421, []],
  ['v2', 'u8', '为了 12 秒等 40 分钟，这才是旅行该有的样子', 3642, [['u2', '对的，好天气都是等出来的', 918]]],
  ['v2', 'u4', '看哭了，我上一次看日落还是去年', 2105, []],
  ['v2', 'u7', '石老人这个角度我拍过，但没你拍得好看', 764, []],
  ['v3', 'u3', '补充一下：水温 92 度，粉水比 1:15，闷蒸 30 秒', 1896, [['u6', '收藏了，明天就试', 214]]],
  ['v3', 'u1', '「慢不是速度，是注意力」这句我要抄下来', 932, []],
  ['v4', 'u8', '它是不是每天都在同一个位置等你', 12408, [['u4', '对，一秒都不差，比闹钟准', 6231], ['u2', '这就是养猫的意义吧', 1872]]],
  ['v4', 'u7', '橘猫的体重是不是也在准点增长', 8640, []],
  ['v5', 'u6', '第 2 个细节是什么，别卖关子啊教练', 4218, [['u5', '睡眠。练得再狠，睡不够等于白练', 3104]]],
  ['v5', 'u3', '跟着练了两个月，掉了 9 斤，谢谢教练', 2760, []],
  ['v6', 'u1', '「窗外开始亮了」这句话太真实了', 5128, [['u6', '然后你就知道该睡了', 2046]]],
  ['v6', 'u5', '程序员的身体是革命的本钱，记得起来动一动', 1932, []],
  ['v7', 'u3', '只做一种面的店，一般都好吃到离谱', 7842, [['u7', '对，老板说做多了就做不精', 4106]]],
  ['v7', 'u4', '地址发一下，这周就去', 2318, []],
  ['v8', 'u2', '一个人旅行最难的不是路，是吃饭的时候没人说话', 3642, [['u8', '所以学会了自己跟自己聊，也挺好', 1508]]],
  ['v8', 'u1', '23 天，佩服。我第三天就想回家了', 1284, []],
];

const EXTRA_SURNAMES = ['林', '陈', '周', '吴', '郑', '孙', '钱', '赵', '沈', '韩', '冯', '曹', '许', '邓', '萧', '程'];
const EXTRA_GIVEN = ['一诺', '小满', '子墨', '知遥', '清和', '亦然', 'молч', '星野', '听风', '南乔', '云舒', '初see', '鹤鸣', '望舒', '拾光', '栖迟'];
const EXTRA_TOPICS = ['旅行', '美食', '健身', 'vlog', '摄影', '编程', '手作', '音乐'];

function buildExtraUsers(count) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const surname = EXTRA_SURNAMES[i % EXTRA_SURNAMES.length];
    const given = EXTRA_GIVEN[(i * 7) % EXTRA_GIVEN.length].replace(/[^\u4e00-\u9fa5a-z]/gi, '') || '小满';
    const topic = EXTRA_TOPICS[(i * 3) % EXTRA_TOPICS.length];
    const name = `${surname}${given}`;
    rows.push({
      id: `g${String(i + 1).padStart(3, '0')}`,
      name,
      handle: `${topic}_${i + 1}${String((i * 37) % 900 + 100)}`,
      bio: `${topic}爱好者 · 第 ${i + 1} 天记录`,
      verified: i % 9 === 0 ? 1 : 0,
      status: i % 17 === 0 ? 'banned' : 'active',
      banReason: i % 17 === 0 ? '发布违规内容（系统自动）' : null,
      following: 20 + ((i * 13) % 480),
      followers: 120 + ((i * 977) % 240_000),
      likes: 300 + ((i * 4111) % 3_200_000),
      // The first ten land inside the dashboard's 14-day window; the rest are
      // spread further back so the platform does not look brand new.
      age: i < 10 ? (i * 13) % 14 : 16 + ((i * 11) % 180),
    });
  }
  return rows;
}

function copyIfPresent(from, to) {
  if (!existsSync(from)) return false;
  copyFileSync(from, to);
  return true;
}

function isSeeded() {
  return get('SELECT COUNT(*) AS n FROM videos').n > 0;
}

export function seed({ force = false, log = console.log } = {}) {
  if (isSeeded() && !force) {
    return { seeded: false, reason: 'already seeded' };
  }

  if (force) {
    for (const table of ['audit_logs', 'comments', 'videos', 'users', 'sessions', 'admins']) {
      run(`DELETE FROM ${table}`);
    }
    log('  cleared existing rows');
  }

  // --- admin -------------------------------------------------------------
  if (!get('SELECT id FROM admins LIMIT 1')) {
    run(
      `INSERT INTO admins (username, password_hash, display_name, role, created_at)
       VALUES (?, ?, ?, 'owner', ?)`,
      [DEFAULT_ADMIN.username, hashPassword(DEFAULT_ADMIN.password), '超级管理员', nowIso()],
    );
    log(`  admin created: ${DEFAULT_ADMIN.username} / ${DEFAULT_ADMIN.password}`);
  }

  // --- users -------------------------------------------------------------
  let avatarCopies = 0;
  for (const [id, name, handle, bio, verified, following, followers, likes] of CREATORS) {
    const avatarName = `${id}.png`;
    if (copyIfPresent(join(ASSETS, 'avatars', avatarName), join(AVATAR_DIR, avatarName))) {
      avatarCopies += 1;
    }
    run(
      `INSERT INTO users (id, name, handle, avatar_url, bio, verified, status, following, followers, likes, created_at, last_active_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
      [id, name, handle, `/uploads/avatars/${avatarName}`, bio, verified, following, followers, likes, daysAgo(180 - (Number(id.replace(/^u/, '')) || 30)), daysAgo(0)],
    );
  }

  const extras = buildExtraUsers(36);
  for (const u of extras) {
    run(
      `INSERT INTO users (id, name, handle, avatar_url, bio, verified, status, ban_reason, following, followers, likes, created_at, last_active_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.name, u.handle, u.bio, u.verified, u.status, u.banReason, u.following, u.followers, u.likes, daysAgo(u.age), daysAgo(Math.min(u.age, 6))],
    );
  }
  log(`  users: ${CREATORS.length} imported + ${extras.length} synthetic`);

  // --- videos ------------------------------------------------------------
  let videoCopies = 0;
  let coverCopies = 0;
  for (const row of VIDEOS) {
    const [id, userId, caption, tags, music, location, likes, comments, favorites, shares, status, featured, age] = row;
    const file = `${id}.mp4`;
    const cover = `${id}.jpg`;
    if (copyIfPresent(join(ASSETS, 'videos', file), join(VIDEO_DIR, file))) videoCopies += 1;
    if (copyIfPresent(join(ASSETS, 'thumbs', cover), join(COVER_DIR, cover))) coverCopies += 1;

    run(
      `INSERT INTO videos (id, user_id, title, caption, tags, music, location, file_path, cover_path,
                           mime_type, duration_seconds, size_bytes, width, height, status, featured,
                           views, likes, comments_count, favorites, shares, source, created_at, reviewed_at, reviewed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'video/mp4', 8, ?, 720, 1280, ?, ?, ?, ?, ?, ?, ?, 'seed', ?, ?, ?)`,
      [
        id, userId, caption.slice(0, 18), caption, JSON.stringify(tags), music, location,
        `/uploads/videos/${file}`, `/uploads/covers/${cover}`,
        320 * 1024, status, featured,
        likes * 4, likes, comments, favorites, shares,
        daysAgo(age),
        status === 'approved' ? daysAgo(Math.max(0, age - 1)) : null,
        status === 'approved' ? 'admin' : null,
      ],
    );
  }
  log(`  videos: ${VIDEOS.length} (${videoCopies} media + ${coverCopies} covers copied)`);
  log(`  avatars copied: ${avatarCopies}`);

  // --- comments ----------------------------------------------------------
  let commentSeq = 0;
  for (const [videoId, authorId, text, likes, replies] of COMMENTS) {
    const rootId = `c${String(++commentSeq).padStart(3, '0')}`;
    run(
      `INSERT INTO comments (id, video_id, user_id, text, likes, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'visible', ?)`,
      [rootId, videoId, authorId, text, likes, daysAgo(2 + (commentSeq % 6))],
    );
    // Replies are keyed by their index within the parent, not by the global
    // comment counter -- reusing the counter collided once a root had 2+ replies.
    replies.forEach(([replyAuthor, replyText, replyLikes], idx) => {
      run(
        `INSERT INTO comments (id, video_id, user_id, text, likes, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'visible', ?)`,
        [`${rootId}r${idx + 1}`, videoId, replyAuthor, replyText, replyLikes, daysAgo(1 + (commentSeq % 3))],
      );
    });
  }

  // A few synthetic comments on the synthetic accounts, including one hidden
  // and one that trips the sensitive-word filter. Both are deliberately the
  // most recent rows so the moderation features are visible on page 1 rather
  // than buried behind pagination.
  const filler = [
    ['广告嫌疑，建议审核一下', 'hidden'],
    ['求个原图！', 'visible'],
    ['打卡第 N 天，坚持就是胜利', 'visible'],
    ['这个也太好看了吧，已收藏', 'visible'],
    ['刷到第三次了，算法懂我', 'visible'],
    ['背景音乐叫什么名字？', 'visible'],
  ];
  filler.forEach(([text, status], i) => {
    const video = VIDEOS[i % VIDEOS.length][0];
    run(
      `INSERT INTO comments (id, video_id, user_id, text, likes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [`f${String(i + 1).padStart(3, '0')}`, video, extras[(i * 5) % extras.length].id, text, 12 + i * 37, status, daysAgo(i % 5)],
    );
  });

  const totalComments = get('SELECT COUNT(*) AS n FROM comments').n;
  log(`  comments: ${totalComments}`);

  run(
    `INSERT INTO audit_logs (admin_id, admin_name, action, target_type, target_id, detail, created_at)
     VALUES (NULL, 'system', 'seed', 'database', NULL, ?, ?)`,
    [`导入 ${CREATORS.length + extras.length} 用户 / ${VIDEOS.length} 视频 / ${totalComments} 评论`, nowIso()],
  );

  return { seeded: true };
}

// Allow `node seed.js [--force]`
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const force = process.argv.includes('--force');
  console.log(force ? 'Reseeding (--force)...' : 'Seeding...');
  const result = seed({ force });
  console.log(result.seeded ? '\nDone.' : `\nSkipped: ${result.reason}. Use --force to wipe and reseed.`);
}
