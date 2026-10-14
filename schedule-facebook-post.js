const fs = require('fs');
const path = require('path');

// ============================================================
// Config
// ============================================================
const PAGE_ID = process.env.FACEBOOK_PAGE_ID || '107517918055535';
const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const GRAPH = 'https://graph.facebook.com/v18.0';

// All images are consolidated in this single folder
const imagesDir = path.join(process.cwd(), 'all_images');
const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

// Original captions extracted from the Facebook export (may be missing)
let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'post_manifest.json'), 'utf8'));
} catch (e) {
  console.warn('⚠️  post_manifest.json not found — posting without original captions.');
}

// ============================================================
// 1. Pick a random image from all_images/
// ============================================================
if (!fs.existsSync(imagesDir)) {
  console.error('❌ all_images folder not found:', imagesDir);
  process.exit(1);
}

const files = fs
  .readdirSync(imagesDir)
  .filter((f) => ALLOWED.has(path.extname(f).toLowerCase()));

if (files.length === 0) {
  console.error('❌ No images found in all_images!');
  process.exit(1);
}

const randomFile = files[Math.floor(Math.random() * files.length)];
const filePath = path.join(imagesDir, randomFile);

// Original caption — null means the original post had no text
const caption = manifest[randomFile] || null;

// ============================================================
// 2. Determine the posting slot: 10:00 or 20:00 GMT+6
//    10:00 GMT+6 = 04:00 UTC  |  20:00 GMT+6 = 14:00 UTC
//    POST_SLOT env: '10:00' | '20:00' | 'auto'
// ============================================================
let slot = process.env.POST_SLOT || 'auto';
if (slot === 'auto') {
  slot = new Date().getUTCHours() < 12 ? '10:00' : '20:00';
}
const utcHour = slot === '20:00' ? 14 : 4;

// Compute the next occurrence of that slot (must be >5 min in the future)
function nextTargetEpoch() {
  const now = Date.now();
  const d = new Date();
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), utcHour, 0, 0);
  if (t <= now + 5 * 60 * 1000) {
    t += 24 * 60 * 60 * 1000; // roll to tomorrow
  }
  return Math.floor(t / 1000);
}
const scheduledPublishTime = nextTargetEpoch();

const gmt6 = new Date((scheduledPublishTime + 6 * 3600) * 1000)
  .toISOString()
  .replace('T', ' ')
  .slice(0, 16);
const utc = new Date(scheduledPublishTime * 1000)
  .toISOString()
  .replace('T', ' ')
  .slice(0, 16);

console.log('📸 Image selected :', randomFile, `(${files.length} total images)`);
console.log('⏰ Post slot      :', slot, 'GMT+6');
console.log('📅 Scheduled for  :', `${gmt6} GMT+6  (${utc} UTC)`);
console.log(
  '📝 Caption        :',
  caption ? caption : '(no text — original post had no caption)'
);

// ============================================================
// 3. Schedule on Facebook (only when token is set)
// ============================================================
function mimeOf(name) {
  const e = path.extname(name).toLowerCase();
  if (e === '.png') return 'image/png';
  if (e === '.webp') return 'image/webp';
  if (e === '.gif') return 'image/gif';
  return 'image/jpeg';
}

async function scheduleOnFacebook() {
  const form = new FormData();
  form.append(
    'source',
    new Blob([fs.readFileSync(filePath)], { type: mimeOf(randomFile) }),
    randomFile
  );
  // Only attach text when the original post had one
  if (caption) {
    form.append('message', caption);
  }
  form.append('published', 'false'); // schedule, don't publish now
  form.append('scheduled_publish_time', String(scheduledPublishTime));
  form.append('access_token', ACCESS_TOKEN);

  const res = await fetch(`${GRAPH}/${PAGE_ID}/photos`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`code ${data.error.code}: ${data.error.message}`);
  }
  console.log('✅ Scheduled on Facebook! Post ID:', data.post_id || data.id);
}

(async () => {
  if (!ACCESS_TOKEN) {
    console.log('');
    console.log('ℹ️  DRY RUN — FACEBOOK_ACCESS_TOKEN not set, nothing was posted.');
    console.log('   To post for real: GitHub → Settings → Secrets and variables → Actions');
    console.log('   → add secret FACEBOOK_ACCESS_TOKEN (page token with pages_manage_posts).');
    process.exit(0);
  }
  try {
    await scheduleOnFacebook();
  } catch (err) {
    console.error('❌ Facebook scheduling failed:', err.message);
    process.exit(1);
  }
})();
