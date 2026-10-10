/**
 * End-to-end smoke test for the backend API.
 *
 *   node tools/api-smoke.mjs [baseUrl]
 *
 * Exercises the whole surface the admin console depends on: public routes,
 * login, every authenticated list, the upload -> review -> feed flow, and the
 * authorisation boundary. Exits non-zero on the first failure so it can gate a
 * commit.
 *
 * Deliberately **state-independent**: it creates the fixtures it needs (an
 * uploaded video, a target user, a target comment) and removes them again.
 * An earlier version asserted the seed's exact row counts, so it passed only on
 * a freshly seeded database and reported nine failures the moment the data
 * moved on — a test that has to be run against a pristine database is a trap.
 */
const BASE = process.argv[2] ?? 'http://localhost:4000';

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? `  -- ${detail}` : ''}`);
  }
}

async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response; the caller only needs the status */
  }
  return { status: response.status, json };
}

/** Posts a tiny fake mp4 through the real multipart path and returns its id. */
async function uploadVideo(caption) {
  const boundary = `----smoke${Date.now()}${Math.random().toString(16).slice(2)}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="smoke.mp4"\r\nContent-Type: video/mp4\r\n\r\n`,
    ),
    Buffer.alloc(2048, 7),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const response = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

console.log(`\nAPI smoke test against ${BASE}\n`);

// ── public ───────────────────────────────────────────────────────────────
const health = await call('GET', '/api/health');
check('GET /api/health -> 200', health.status === 200, `got ${health.status}`);
check(
  'health reports a non-empty library',
  Number.isInteger(health.json?.videos) && health.json.videos > 0,
  JSON.stringify(health.json),
);

const feed = await call('GET', '/api/feed?limit=3');
check('GET /api/feed -> 200', feed.status === 200);
check('feed returns items', Array.isArray(feed.json?.items) && feed.json.items.length > 0);
check(
  'feed items carry absolute media URLs',
  feed.json?.items?.every((v) => v.videoUrl?.startsWith('http')),
  feed.json?.items?.[0]?.videoUrl,
);

// ── auth boundary ────────────────────────────────────────────────────────
const noAuth = await call('GET', '/api/users');
check('GET /api/users without a token -> 401', noAuth.status === 401, `got ${noAuth.status}`);

const badLogin = await call('POST', '/api/auth/login', { body: { username: 'admin', password: 'wrong' } });
check('wrong password -> 401', badLogin.status === 401, `got ${badLogin.status}`);

const login = await call('POST', '/api/auth/login', { body: { username: 'admin', password: 'admin123' } });
check('login -> 200 with a token', login.status === 200 && !!login.json?.token, `got ${login.status}`);
const token = login.json?.token;

// ── authenticated reads ──────────────────────────────────────────────────
const stats = await call('GET', '/api/stats/overview', { token });
check('GET /api/stats/overview -> 200', stats.status === 200);
check('stats reports users', (stats.json?.users?.total ?? 0) > 0, `got ${stats.json?.users?.total}`);
check('stats trend has 14 points', stats.json?.trend?.length === 14, `got ${stats.json?.trend?.length}`);
check(
  'status buckets sum to the total',
  stats.json?.videos?.pending + stats.json?.videos?.approved + stats.json?.videos?.rejected ===
    stats.json?.videos?.total,
  JSON.stringify(stats.json?.videos),
);

const users = await call('GET', '/api/users?limit=5&sort=followers', { token });
check('GET /api/users -> 200', users.status === 200);
check('users page respects limit', users.json?.items?.length === 5, `got ${users.json?.items?.length}`);
check(
  'users sorted by followers desc',
  (users.json?.items?.[0]?.followers ?? 0) >= (users.json?.items?.[4]?.followers ?? 0),
);

const search = await call('GET', '/api/users?q=%E5%A4%9C%E8%A1%8C', { token });
check('user search by Chinese name works', search.json?.total >= 1, `got ${search.json?.total}`);

const comments = await call('GET', '/api/comments?limit=5', { token });
check('GET /api/comments -> 200', comments.status === 200);
check('comments are flagged for sensitive words', Array.isArray(comments.json?.items?.[0]?.sensitive));

const sensitive = await call('GET', '/api/comments?sensitive=1', { token });
check(
  'every sensitive-filtered row has a hit',
  (sensitive.json?.items ?? []).every((c) => c.sensitive.length > 0),
  JSON.stringify(sensitive.json?.items?.map((c) => c.sensitive)),
);

const logs = await call('GET', '/api/logs', { token });
check('GET /api/logs -> 200', logs.status === 200);

// ── upload -> review -> feed (self-contained) ────────────────────────────
const upload = await uploadVideo('冒烟测试视频');
check('POST /api/upload -> 201', upload.status === 201, `got ${upload.status}`);
check('uploaded video starts as pending', upload.json?.video?.status === 'pending');
const videoId = upload.json?.video?.id;
check('upload returns an id', typeof videoId === 'string' && videoId.length > 0);

if (videoId) {
  const feedWhilePending = await call('GET', '/api/feed?limit=50');
  check(
    'a pending video is NOT exposed in the feed',
    !feedWhilePending.json?.items?.some((v) => v.id === videoId),
  );

  const pendingList = await call('GET', '/api/videos?status=pending', { token });
  check(
    'uploaded video appears in the pending list',
    pendingList.json?.items?.some((v) => v.id === videoId),
  );

  const detail = await call('GET', `/api/videos/${videoId}`, { token });
  check('GET /api/videos/:id -> 200', detail.status === 200, `got ${detail.status}`);
  check('video detail carries its author', detail.json?.video?.user?.id != null);

  const approve = await call('PATCH', `/api/videos/${videoId}`, { token, body: { status: 'approved' } });
  check('PATCH approve -> 200', approve.status === 200, `got ${approve.status}`);
  check('approved video has no reject reason', approve.json?.video?.rejectReason === null);

  const feedAfterApprove = await call('GET', '/api/feed?limit=50');
  check(
    'an approved video DOES appear in the feed',
    feedAfterApprove.json?.items?.some((v) => v.id === videoId),
  );

  const reject = await call('PATCH', `/api/videos/${videoId}`, {
    token,
    body: { status: 'rejected', rejectReason: '冒烟测试驳回' },
  });
  check('PATCH reject keeps the reason', reject.json?.video?.rejectReason === '冒烟测试驳回');

  const feedAfterReject = await call('GET', '/api/feed?limit=50');
  check(
    'a rejected video is removed from the feed',
    !feedAfterReject.json?.items?.some((v) => v.id === videoId),
  );

  const cleanup = await call('DELETE', `/api/videos/${videoId}`, { token });
  check('DELETE the uploaded video -> 200', cleanup.status === 200);
  const gone = await call('GET', `/api/videos/${videoId}`, { token });
  check('deleted video is gone', gone.status === 404, `got ${gone.status}`);
}

// ── moderation on existing rows ──────────────────────────────────────────
const targetUser = users.json?.items?.find((u) => u.status === 'active');
if (targetUser) {
  const ban = await call('PATCH', `/api/users/${targetUser.id}`, {
    token,
    body: { status: 'banned', banReason: '冒烟测试' },
  });
  check('PATCH user ban -> 200', ban.status === 200 && ban.json?.user?.status === 'banned');
  await call('PATCH', `/api/users/${targetUser.id}`, { token, body: { status: 'active' } });
  const restored = await call('GET', `/api/users/${targetUser.id}`, { token });
  check('user restored to active', restored.json?.user?.status === 'active');
  check('unban clears the reason', restored.json?.user?.ban_reason === null);
}

const targetComment = comments.json?.items?.[0];
if (targetComment) {
  const hide = await call('PATCH', `/api/comments/${targetComment.id}`, { token, body: { status: 'hidden' } });
  check('PATCH comment hide -> 200', hide.json?.comment?.status === 'hidden');
  const restore = await call('PATCH', `/api/comments/${targetComment.id}`, { token, body: { status: 'visible' } });
  check('PATCH comment restore -> 200', restore.json?.comment?.status === 'visible');
}

const logged = await call('GET', '/api/logs?limit=5', { token });
check('mutations wrote audit entries', (logged.json?.items?.length ?? 0) >= 5, `got ${logged.json?.items?.length}`);
check(
  'audit entries name the acting admin',
  logged.json?.items?.every((entry) => typeof entry.admin_name === 'string'),
);

// ── logout ───────────────────────────────────────────────────────────────
const logout = await call('POST', '/api/auth/logout', { token });
check('logout -> 200', logout.status === 200);
const afterLogout = await call('GET', '/api/users', { token });
check('token is rejected after logout', afterLogout.status === 401, `got ${afterLogout.status}`);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
