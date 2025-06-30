import React, { useRef, useState } from "react";

function AudioUploader() {
  const [fileName, setFileName] = useState("");
  const [uploadUrl, setUploadUrl] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [status, setStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startTranscription = async (audioUrl: string) => {
    setStatus("Starting transcription...");

    const res = await fetch("/api/start-transcription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_url: audioUrl }),
    });

    const data = await res.json();
    const transcriptId = data.transcript_id;

    const pollTranscription = async () => {
      const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          authorization: "67060e4149c04a1d9577320871e0ced2",
        },
      });

      const result = await response.json();

      if (result.status === "completed") {
        setTranscriptText(result.text);
        setStatus("Transcription complete ✅");
      } else if (result.status === "error") {
        setStatus("Transcription failed ❌");
      } else {
        setTimeout(pollTranscription, 3000);
      }
    };

    pollTranscription();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(`${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    setStatus("Uploading...");

    const formData = new FormData();
    formData.append("audio", file);

    const res = await fetch("/api/upload-to-assembly", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setUploadUrl(data.upload_url);
    setStatus("Upload successful ✅");

    await startTranscription(data.upload_url);
  };

  const handleUploadAnother = () => {
    setFileName("");
    setUploadUrl("");
    setTranscriptText("");
    setStatus("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  return (
    <div className="p-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleUpload}
        className="hidden"
      />

      {!fileName && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Upload Audio File
        </button>
      )}

      {fileName && <p className="mt-2">Selected: {fileName}</p>}
      {uploadUrl && <p className="mt-2 break-words text-sm text-gray-600">Upload URL: {uploadUrl}</p>}
      <p className="mt-2 text-blue-700">{status}</p>

      {transcriptText && (
        <div className="mt-4 bg-gray-100 p-4 rounded">
          <h3 className="font-bold mb-2">Transcript:</h3>
          <p className="whitespace-pre-wrap">{transcriptText}</p>

          <button
            onClick={handleUploadAnother}
            className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
          >
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );
}

export default AudioUploader;
