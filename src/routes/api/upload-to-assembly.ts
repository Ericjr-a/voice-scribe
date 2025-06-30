
import type { IncomingMessage, ServerResponse } from "http";
import axios from "axios";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, _unused, files) => {
    if (err) {
      res.statusCode = 500;
      res.end("Error parsing form");
      return;
    }

    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;

    if (!audioFile || !audioFile.filepath) {
      res.statusCode = 400;
      res.end("No audio file uploaded");
      return;
    }

    const stream = fs.createReadStream(audioFile.filepath);

    try {
      const response = await axios.post(
        "https://api.assemblyai.com/v2/upload",
        stream,
        {
          headers: {
            authorization: "67060e4149c04a1d9577320871e0ced2",
            "transfer-encoding": "chunked",
          },
        }
      );

      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      res.end(JSON.stringify({ upload_url: response.data.upload_url }));
    } catch (uploadErr) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Upload failed" }));
    }
  });
}
