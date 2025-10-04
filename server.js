const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const supportersFile = path.join(__dirname, 'supporters.json');
const metadataFile = path.join(__dirname, 'media-metadata.json');

// Middleware to parse request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Ensure upload directories exist (INSIDE backend/)
['uploads', 'uploads/videos', 'uploads/audios', 'uploads/thumbnails', 'uploads/temp'].forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// Serve frontend static files (adjust if needed for local testing)
app.use(express.static(path.join(__dirname, '../frontend')));

// Multer upload config
const upload = multer({ dest: path.join(__dirname, 'uploads/temp/') });

// Helpers to manage media metadata
function readMetadata() {
  if (!fs.existsSync(metadataFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
  } catch {
    return [];
  }
}

function saveMetadata(data) {
  fs.writeFileSync(metadataFile, JSON.stringify(data, null, 2));
}

// === Upload Handler ===
app.post('/upload', upload.fields([
  { name: 'media', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), (req, res) => {
  const mediaFile = req.files?.media?.[0];
  const thumbFile = req.files?.thumbnail?.[0];

  if (!mediaFile) {
    return res.status(400).send('No media file uploaded.');
  }

  const mediaType = mediaFile.mimetype.startsWith('video') ? 'videos' : 'audios';
  const { videoName, username } = req.body;

  // Build unique media filename
  const mediaExt = path.extname(mediaFile.originalname);
  const mediaFilename = `${Date.now()}${mediaExt}`;
  const mediaPath = path.join(__dirname, 'uploads', mediaType, mediaFilename);

  // Move the media file
  fs.renameSync(mediaFile.path, mediaPath);

  // Prepare metadata entry
  const metadataEntry = {
    filename: mediaFilename,
    videoName: videoName || mediaFile.originalname,
    username: username || 'Unknown',
    type: mediaType,
    thumbnail: null,
    uploadedAt: Date.now()
  };

  // Handle thumbnail if provided
  if (thumbFile) {
    const thumbExt = path.extname(thumbFile.originalname);
    const thumbFilename = `${mediaFilename}${thumbExt}`;
    const thumbPath = path.join(__dirname, 'uploads/thumbnails', thumbFilename);
    fs.renameSync(thumbFile.path, thumbPath);

    metadataEntry.thumbnail = `/media/thumbnails/${thumbFilename}`;
  }

  // Save metadata
  const allMetadata = readMetadata();
  allMetadata.push(metadataEntry);
  saveMetadata(allMetadata);

  res.json({ message: 'Upload successful.' });
});

// === Fetch Videos or Audios ===
app.get('/media/:type', (req, res) => {
  const type = req.params.type;
  if (!['videos', 'audios'].includes(type)) {
    return res.status(400).json({ error: 'Invalid media type' });
  }

  const mediaList = readMetadata()
    .filter(item => item.type === type)
    .sort((a, b) => b.uploadedAt - a.uploadedAt);

  res.json(mediaList);
});

// === Search Videos ===
app.get('/media/videos/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase().trim();
  if (!query) return res.json([]);

  const allMetadata = readMetadata();
  const results = allMetadata.filter(item =>
    item.type === 'videos' &&
    (item.videoName.toLowerCase().includes(query) ||
     item.username.toLowerCase().includes(query))
  );

  res.json(results);
});

// === Serve media and thumbnails ===
// Now serving from backend/uploads/
app.use('/media', express.static(path.join(__dirname, 'uploads')));

// === Support Info ===
app.get('/support', (req, res) => {
  res.json({
    phone: "+250783144083",
    message: "🌟 Your support keeps this platform alive and growing! If you’ve enjoyed the content, consider sending a token of appreciation. Every contribution helps — no matter the size. Thank you! 🙏"
  });
});

// === Supporters (JSON file) ===
app.get('/supporters', (req, res) => {
  try {
    if (!fs.existsSync(supportersFile)) return res.json([]);
    const data = fs.readFileSync(supportersFile, 'utf-8');
    const supporters = JSON.parse(data);
    res.json(supporters);
  } catch (err) {
    console.error('Error reading supporters file:', err);
    res.status(500).json([]);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
