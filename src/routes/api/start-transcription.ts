import { RequestHandler } from "@builder.io/qwik-city";
import { AssemblyAI } from "assemblyai";

const client = new AssemblyAI({
  apiKey: "67060e4149c04a1d9577320871e0ced2",
});

export const onPost: RequestHandler = async ({ request, json }) => {
  const body = await request.json();
  const audioUrl = body.audio_url;

  try {
    const transcript = await client.transcripts.transcribe({
      audio: audioUrl,
      speech_model: "universal",
    });

    console.log("Transcript object:", transcript);

    json(200, {
      transcript: transcript.text,
      transcript_id: transcript.id,
    });
  } catch (err) {
    console.error("Transcription error:", err);
    json(500, { error: "Transcription failed" });
  }
};
