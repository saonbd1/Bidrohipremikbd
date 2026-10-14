const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get all files from the facebook folder
const fbFolder = path.join(process.cwd(), 'facebook-bidrohipremikbd-2026-10-14-s3v2GM9o/files');

// Check if folder exists
if (!fs.existsSync(fbFolder)) {
  console.error('❌ Facebook folder not found!');
  console.error(`Expected at: ${fbFolder}`);
  process.exit(1);
}

// Get image files
const files = fs.readdirSync(fbFolder)
  .filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.gif'));

if (files.length === 0) {
  console.error('❌ No image files found in the Facebook folder!');
  process.exit(1);
}

// Randomly select one file
const randomFile = files[Math.floor(Math.random() * files.length)];
const filePath = path.join(fbFolder, randomFile);

// Generate a random future publish time (1-7 days from now)
const now = Math.floor(Date.now() / 1000);
const randomDays = Math.floor(Math.random() * 7) + 1;
const scheduledTime = now + (randomDays * 24 * 60 * 60);

// Create caption with filename
const caption = `Random post - ${randomFile}`;

// Get secrets from environment
const pageId = process.env.PAGE_ID;
const accessToken = process.env.PAGE_ACCESS_TOKEN;

if (!pageId || !accessToken) {
  console.error('❌ Missing Facebook secrets!');
  console.error('Set FACEBOOK_PAGE_ID and FACEBOOK_ACCESS_TOKEN in GitHub repository secrets');
  process.exit(1);
}

// Use Facebook Graph API to schedule the photo post
// Facebook API v18.0 (adjust version if needed)
const graphApiVersion = 'v18.0';
const apiUrl = `https://graph.facebook.com/${graphApiVersion}/${pageId}/photos`;

// Build the form data for Facebook API
const formData = new URLSearchParams({
  published: 'false',
  access_token: accessToken,
  message: caption,
  scheduled_publish_time: scheduledTime.toString()
});

// Add the source URL - we'll use the local file path approach
// Since the files are in the repo folder, we need to upload or use a URL
// For now, let's create a temp approach: read the file and encode it

try {
  // Read the file content
  const fileContent = fs.readFileSync(filePath);
  const base64Content = fileContent.toString('base64');
  const mimeType = getMimeType(randomFile);
  
  console.log(`📸 Selected file: ${randomFile}`);
  console.log(`📅 Scheduled for: ${new Date(scheduledTime * 1000).toISOString()}`);
  console.log(`📝 Caption: ${caption}`);
  console.log(`🖼️ MIME type: ${mimeType}`);
  
  // Note: Actual Facebook API posting would need proper media upload
  // This is a structured example - the actual API call is more complex
  // For production, use Composio's FACEBOOK_CREATE_PHOTO_POST tool
  
  console.log('\n✅ Post scheduling logic would execute here');
  console.log('   - Upload image to Facebook');
  console.log('   - Schedule with future publish time');
  console.log('   - Return post ID for verification');

} catch (error) {
  console.error('❌ Error reading file:', error.message);
  process.exit(1);
}

// Helper function to determine MIME type
function getMimeType(filename) {
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  if (filename.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}
