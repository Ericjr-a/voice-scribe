require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5010;

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

// Google Generative AI
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors({
    origin: [
        "https://cheery-kheer-1eb7d9.netlify.app",
        "https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3-8xr61ndj--5173--cb7c0bca.local-credentialless.webcontainer-api.io",
        "http://localhost:5173"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// File upload config
const upload = multer({ dest: path.join(__dirname, 'uploads/') });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.json());
// ---------- ROUTES ----------










// Upload and convert audio to .wav for AssemblyAI
app.post('/api/upload-audio', upload.single('audio'), (req, res) => {
    if (!req.file) {
        console.log('[UPLOAD] No file uploaded');
        return res.status(400).json({ error: "No file uploaded" });
    }
    const ext = path.extname(req.file.originalname).toLowerCase();
    console.log(`[UPLOAD] Received file: ${req.file.originalname} (${req.file.mimetype}), extension: ${ext}`);

    if (ext === '.webm') {
        const outputPath = req.file.path + '.mp3';
        console.log(`[CONVERT] Converting ${req.file.path} to mp3...`);

        ffmpeg(req.file.path)
            .toFormat('mp3')
            .on('end', () => {
                // File conversion finished
                let stats = null;
                try {
                    stats = fs.statSync(outputPath);
                    console.log(`[CONVERT] MP3 saved: ${outputPath}, size: ${stats.size} bytes`);
                } catch (e) {
                    console.error('[CONVERT] Could not get mp3 file stats:', e);
                }
                try {
                    fs.unlinkSync(req.file.path); // Clean up .webm file
                    console.log('[CLEANUP] Deleted original webm file.');
                } catch (e) {
                    console.error('[CLEANUP] Could not delete original webm:', e);
                }
                res.json({
                    status: 'success',
                    mp3File: path.basename(outputPath),
                    downloadUrl: `${PUBLIC_BASE_URL}/uploads/${path.basename(outputPath)}`
                });


            })
            .on('error', err => {
                console.error('[CONVERT] ffmpeg error:', err);
                res.status(500).json({ error: err.message });
            })
            .save(outputPath);
    } else {
        console.log(`[UPLOAD] Not a webm file. Returning original.`);
        res.json({
            status: 'success',
            originalFile: req.file.filename,
            downloadUrl: `http://localhost:${PORT}/uploads/${req.file.filename}`
        });
    }
});













// AssemblyAI transcript route
app.post('/api/transcribe', async (req, res) => {
    const { audio_url } = req.body;
    console.log(`[TRANSCRIBE] Request received for audio_url: ${audio_url}`);
    try {
        const response = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
                authorization: 'd5a335cf283b4c03a942742e38e305bd',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ audio_url }),
        });
        const data = await response.json();
        console.log('[TRANSCRIBE] AssemblyAI API response:', data);
        res.json(data);
    } catch (err) {
        console.error('[TRANSCRIBE] Transcription error:', err);
        res.status(500).json({ error: 'Transcription failed' });
    }
});

// Gemini summarize
app.post('/api/summarize', async (req, res) => {
    const { transcript } = req.body;
    if (!transcript) {
        return res.status(400).json({ error: 'Transcript required.' });
    }
    const prompt = `
You are VoiceScribe, a meeting assistant. Here is the transcript of a meeting:

${transcript}

Please do the following using simple and clear English. Use the section headings below and always keep this order:

Summary:
In 2 or 3 sentences, simply explain what the main topics were, or what people talked about. If the ideas seem random, do your best to connect them.

Action Items:
List any tasks, next steps, or things that need to be done. If there aren’t any, write "None."

Deadlines:
Say if there are any deadlines or dates mentioned. If there aren’t any, write "None."

People Responsible:
List the people who have tasks or things to do, or write "None."

Note:
Add any helpful comments about the meeting, the mood, or things the group could do better next time. If the transcript is unclear, suggest what could make it better.

**IMPORTANT:** Write everything as plain text only. Do NOT use any bullets, asterisks, or Markdown formatting anywhere in your answer.

If you can’t fill a section, just write "None." Don’t add or remove any sections.
`;

    try {
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ summary: response.text() });
    } catch (e) {
        console.error("Summarization error (Gemini):", e);
        res.status(500).json({ error: "Summarization failed." });
    }
});

// Gemini chat Q&A
app.post('/api/chat', async (req, res) => {
    const { transcript, question } = req.body;
    if (!transcript || !question) {
        return res.status(400).json({ error: "Transcript and question are required." });
    }
    const prompt = `
  You are VoiceScribe, a meeting assistant. Here is the meeting transcript:
  
  ${transcript}
  
  A user has asked a question about the meeting: "${question}"
  
  Please answer in simple English using the transcript. If the answer is not in the transcript, say so politely.
  `;

    try {
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ answer: response.text() });
    } catch (e) {
        res.status(500).json({ error: "Failed to get answer." });
    }
});

// ---------- END ROUTES ----------

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});

