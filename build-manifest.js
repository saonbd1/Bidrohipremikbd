// build-manifest.js
// Parses Facebook export HTML files and builds post_manifest.json
// mapping each image filename -> original post caption (or null).
//
// Priority for captions:
//   1. profile_posts_1.html   (post message text / photo caption _3-95)
//   2. uncategorized_photos.html (photo caption _3-95)
//   3. album/*.html           (photo caption _3-95 fallback)

const fs = require('fs');
const path = require('path');

const postsDir = path.join(
  process.cwd(),
  "facebook-bidrohipremikbd-2026-10-14-s3v2GM9o",
  "this_profile's_activity_across_facebook",
  'posts'
);
const allImagesDir = path.join(process.cwd(), 'all_images');

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function decodeEntities(s) {
  return s
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .trim();
}

// Metadata lines that are NOT real post captions
function isJunkText(t) {
  if (!t) return true;
  if (/^(Updated|Taken|Orientation|Upload IP address|Edited|From|To)\b/i.test(t)) return true;
  // bare dates like "May 10, 2024 8:24:03 pm"
  if (/^[A-Z][a-z]{2} \d{1,2}, \d{4} \d{1,2}:\d{2}:\d{2} [ap]m$/i.test(t)) return true;
  return false;
}

function splitSections(html) {
  const re = /<section class="_a6-g"[^>]*>[\s\S]*?<\/section>/g;
  return html.match(re) || [];
}

function extractImages(sectionHtml) {
  const re = /<img src="[^"]*\/([^"\/]+\.(?:jpg|jpeg|png|webp|gif))"/gi;
  const out = [];
  let m;
  while ((m = re.exec(sectionHtml)) !== null) out.push(m[1]);
  return out;
}

function extractPhotoCaptions(sectionHtml) {
  // _3-95 divs = per-photo captions, in order
  const re = /<div class="_3-95">([\s\S]*?)<\/div>/g;
  const out = [];
  let m;
  while ((m = re.exec(sectionHtml)) !== null) {
    const t = decodeEntities(m[1].replace(/<[^>]*>/g, ''));
    if (!isJunkText(t)) out.push(t);
  }
  return out;
}

function extractPostMessage(sectionHtml) {
  // post message = text directly inside the LAST <div class="_2pin"><div>...</div>
  const re = /<div class="_2pin"><div>([^<]*)<\/div>/g;
  let m;
  let last = null;
  while ((m = re.exec(sectionHtml)) !== null) {
    const t = decodeEntities(m[1]);
    if (!isJunkText(t)) last = t;
  }
  return last;
}

// ------------------------------------------------------------
// Build manifest
// ------------------------------------------------------------
const manifest = {}; // filename -> caption | null
let covered = 0;

function addCaption(file, caption) {
  if (!fs.existsSync(path.join(allImagesDir, file))) return; // only all_images files
  if (manifest[file] !== undefined && manifest[file] !== null) return; // keep existing caption
  const isNew = manifest[file] === undefined;
  manifest[file] = caption !== null && caption !== '' ? caption : (isNew ? null : manifest[file]);
  if (caption) covered++;
}

function processProfilePosts(file) {
  const html = fs.readFileSync(file, 'utf8');
  const sections = splitSections(html);
  let withText = 0;
  for (const sec of sections) {
    const images = extractImages(sec);
    if (images.length === 0) continue;
    const message = extractPostMessage(sec); // post-level text
    const photoCaps = extractPhotoCaptions(sec); // per-photo captions
    if (message || photoCaps.length) withText++;
    images.forEach((img, i) => {
      const caption = message || photoCaps[i] || null;
      const isNew = manifest[img] === undefined;
      if (isNew || manifest[img] === null) {
        if (caption) {
          manifest[img] = caption;
          covered++;
        } else if (isNew) {
          manifest[img] = null;
        }
      }
    });
  }
  console.log(`${path.basename(file)}: ${sections.length} sections, ${withText} with text`);
}

function processCaptionOnly(file) {
  const html = fs.readFileSync(file, 'utf8');
  const sections = splitSections(html);
  let added = 0;
  for (const sec of sections) {
    const images = extractImages(sec);
    if (images.length === 0) continue;
    const photoCaps = extractPhotoCaptions(sec);
    images.forEach((img, i) => {
      const caption = photoCaps[i] || null;
      const isNew = manifest[img] === undefined;
      if (caption && (isNew || manifest[img] === null)) {
        manifest[img] = caption;
        added++;
      } else if (isNew) {
        manifest[img] = null;
      }
    });
  }
  console.log(`${path.basename(file)}: ${sections.length} sections, ${added} captions added`);
}

// 1. Profile posts (richest source: message text + photo captions)
processProfilePosts(path.join(postsDir, 'profile_posts_1.html'));

// 2. Uncategorized photos (photo captions only)
processCaptionOnly(path.join(postsDir, 'uncategorized_photos.html'));

// 3. Albums (caption fallback)
const albumDir = path.join(postsDir, 'album');
if (fs.existsSync(albumDir)) {
  for (const f of fs.readdirSync(albumDir).filter((x) => x.endsWith('.html'))) {
    processCaptionOnly(path.join(albumDir, f));
  }
}

// ------------------------------------------------------------
// Stats + write
// ------------------------------------------------------------
const total = Object.keys(manifest).length;
const withCap = Object.values(manifest).filter((v) => v !== null).length;
fs.writeFileSync(path.join(process.cwd(), 'post_manifest.json'), JSON.stringify(manifest, null, 1), 'utf8');
console.log('----------------------------------------');
console.log(`Total images in manifest : ${total}`);
console.log(`With original caption    : ${withCap}`);
console.log(`Without caption          : ${total - withCap}`);
console.log(`Wrote post_manifest.json`);
