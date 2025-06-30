import React, { useState, useRef } from 'react';
import { Upload, Music, FileAudio, X, CheckCircle } from 'lucide-react';
import { Mic } from "lucide-react";


interface AudioFile {
  file: File;
  name: string;
  size: string;
  duration?: string;
  uploadUrl?: string;
  transcript?: string;
  summary?: string;

}


const apiBase = import.meta.env.VITE_API_URL || "https://voicescribe-production.up.railway.app/api";

const uploadToAssemblyAI = async (file: File): Promise<string | null> => {
  try {
    const response = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        authorization: 'd5a335cf283b4c03a942742e38e305bd',
      },
      body: file,
    });

    const data = await response.json();
    return data.upload_url;
  } catch (error) {
    console.error("Upload to AssemblyAI failed:", error);
    return null;
  }
};



const uploadWebmToBackend = async (file: File): Promise<string | null> => {
  try {
    const formData = new FormData();
    formData.append('audio', file);
    const response = await fetch(`${apiBase}/upload-audio`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    return data.downloadUrl;
  } catch (error) {
    console.error("Upload to backend for conversion failed:", error);
    return null;
  }
};




function splitSections(summary: string): Record<string, string> {
  const sectionTitles = [
    "Summary:",
    "Action Items:",
    "Deadlines:",
    "People Responsible:",
    "Note:"
  ];
  const result: Record<string, string> = {};
  for (let i = 0; i < sectionTitles.length; i++) {
    const thisSection = sectionTitles[i];
    const nextSection = sectionTitles[i + 1];
    const start = summary.indexOf(thisSection);
    const end = nextSection ? summary.indexOf(nextSection) : summary.length;
    if (start !== -1) {
      const sectionText = summary.slice(
        start + thisSection.length,
        end !== -1 ? end : undefined
      ).trim();
      result[thisSection.replace(':', '')] = sectionText;
    } else {
      result[thisSection.replace(':', '')] = "None";
    }
  }
  return result;
}



function App() {
  const [uploadedFiles, setUploadedFiles] = useState<AudioFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [transcribingIndex, setTranscribingIndex] = useState<number | null>(null);
  const [summarizingIndex, setSummarizingIndex] = useState<number | null>(null);
  const [chatHistory, setChatHistory] = useState<{ question: string; answer: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const hasTranscript = uploadedFiles.some(f => !!f.duration);
  const [selectedTranscript, setSelectedTranscript] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);





  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isAudioFile = (file: File): boolean =>
    file.type.startsWith('audio/') ||
    file.type === 'video/webm';

  const processFiles = async (files: FileList) => {
    const validFiles = Array.from(files).filter(isAudioFile);
    if (!validFiles.length) {
      setError('Please select valid audio files');
      return;
    }

    setError(null);
    setIsUploading(true);

    const processed: AudioFile[] = [];

    for (const file of validFiles) {
      let uploadUrl: string | null = null;

      if (
        file.type === "audio/webm" ||
        file.type === "video/webm" ||
        file.name.endsWith(".webm")
      ) {
        uploadUrl = await uploadWebmToBackend(file);
      } else {
        uploadUrl = await uploadToAssemblyAI(file);
      }


      if (!uploadUrl) continue;

      processed.push({
        file,
        name: file.name,
        size: formatFileSize(file.size),
        uploadUrl,
      });
    }





    setUploadedFiles(prev => [...prev, ...processed]);
    setIsUploading(false);
  };




  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const clearAll = () => {
    setUploadedFiles([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = '';

  };


  const transcribeFile = async (uploadUrl: string, index: number) => {
    setTranscribingIndex(index);

    try {
      // 1. Start transcription job on your backend
      const res = await fetch(`${apiBase}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: uploadUrl }),
      });
      const data = await res.json();
      const transcriptId = data.id;

      // 2. Poll AssemblyAI for result every 3 seconds
      let status = "queued";
      let transcriptText = "";
      while (status !== "completed" && status !== "failed") {
        await new Promise(r => setTimeout(r, 3000));
        const resp = await fetch(
          `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          {
            headers: {
              authorization: "d5a335cf283b4c03a942742e38e305bd",
            },
          }
        );
        const pollData = await resp.json();
        status = pollData.status;
        if (status === "completed") transcriptText = pollData.text;
        if (status === "failed") transcriptText = "Transcription failed.";
      }

      setUploadedFiles(prev => {
        const updated = [...prev];
        updated[index].duration = transcriptText;
        return updated;
      });


      setTranscribingIndex(null);
    } catch (err) {
      setTranscribingIndex(null);
      console.error("Transcription failed:", err);
    }



  };



  const summarizeTranscript = async (transcript: string, index: number) => {
    setSummarizingIndex(index);
    try {
      const res = await fetch(`${apiBase}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      setUploadedFiles(prev => {
        const updated = [...prev];
        (updated[index] as any).summary = data.summary;
        return updated;
      });
      setSummarizingIndex(null);
    } catch (err) {
      setSummarizingIndex(null);
      console.error('Summarization failed:', err);
    }
  };


  const handleChat = async () => {
    if (!chatInput.trim()) return;
    setChatLoading(true);

    let transcriptIdx = selectedTranscript ?? uploadedFiles.findIndex(f => !!f.duration);
    if (transcriptIdx === -1) transcriptIdx = 0; // fallback
    const transcript = uploadedFiles[transcriptIdx]?.duration;

    if (!transcript) {
      setChatLoading(false);
      alert("No transcript available to chat with.");
      return;
    }

    try {
      const res = await fetch(`${apiBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, question: chatInput }),
      });
      const data = await res.json();
      if (data?.answer) {
        setChatHistory(prev => [...prev, { question: chatInput, answer: data.answer }]);
        setChatInput("");
      } else {
        setChatHistory(prev => [...prev, { question: chatInput, answer: "Sorry, no answer available." }]);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { question: chatInput, answer: "Failed to get response." }]);
    }
    setChatLoading(false);
  };



  type SpeechRecognitionEvent = Event & {
    results: {
      [key: number]: {
        [key: number]: {
          transcript: string;
        };
      };
    };
  };

  function handleMicClick() {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in your browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    setRecording(true);
    recognition.start();

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setChatInput(transcript);
      setRecording(false);
    };

    recognition.onerror = () => {
      setRecording(false);
      alert("Could not recognize speech. Try again.");
    };

    recognition.onend = () => setRecording(false);
  }




  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Bolt.new badge in top right */}
<div
  style={{
    position: 'fixed',
    top: 18,
    right: 18,
    zIndex: 1000,
    background: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    boxShadow: '0 2px 8px #0001',
    padding: 4,
    display: 'flex',
    alignItems: 'center'
  }}
>
  <a
    href="https://bolt.new/?ref=badge"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Built with Bolt.new"
  >
    <img
      src="https://bolt.new/badge.svg"
      alt="Built with Bolt.new"
      style={{ height: 36, width: 'auto', display: 'block' }}
    />
  </a>
</div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl mb-6 shadow-lg">
              <Music className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              VoiceScribe – Upload Audio
            </h1>
            <p className="text-lg text-gray-600 max-w-md mx-auto">
              Upload your audio files with ease. Supports MP3, WAV, FLAC, and more.
            </p>
          </div>

          {/* Upload Area */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-8">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${isDragOver
                  ? 'border-purple-500 bg-purple-50 scale-105'
                  : 'border-gray-300 hover:border-purple-400 hover:bg-purple-25'
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,video/webm,audio/webm"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />


                <div className="space-y-4">
                  <div
                    className={`inline-flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 ${isDragOver ? 'bg-purple-600 scale-110' : 'bg-gray-100'
                      }`}
                  >
                    <Upload
                      className={`w-10 h-10 ${isDragOver ? 'text-white' : 'text-gray-400'
                        }`}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {isDragOver ? 'Drop your audio files here' : 'Upload Audio Files'}
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Drag and drop your audio files here, or click to browse
                    </p>
                    <p className="text-sm text-gray-400">
                      Supports MP3, WAV, FLAC, AAC, OGG, and more
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-600 text-sm font-medium">{error}</p>
                </div>
              )}
            </div>

            {/* Uploaded Files */}
            {uploadedFiles.length > 0 && (
              <div className="px-8 pb-8">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Upload Successful!
                  </h3>
                  <p className="text-gray-600">
                    {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} uploaded.
                  </p>
                </div>

                {uploadedFiles.map((file, i) => (
                  <div
                    key={i}
                    className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6 border border-purple-100 mb-4"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                        <FileAudio className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-semibold text-gray-900 mb-1 truncate">{file.name}</h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span className="flex items-center">
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                            Size: {file.size}
                          </span>
                          <span className="flex items-center">
                            <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                            Format: {file.file.type.split('/')[1].toUpperCase()}
                          </span>
                        </div>

                        {/* ✅ Audio Preview */}
                        <audio
                          controls
                          className="mt-4 w-full rounded-lg"
                          src={URL.createObjectURL(file.file)}
                        >
                          Your browser does not support the audio element.
                        </audio>





                        {file.duration && (
                          <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">
                            <span className="font-medium">Transcript:</span> {file.duration}
                          </p>
                        )}






                        {!file.duration && (
                          transcribingIndex === i ? (
                            <button
                              className="mt-2 px-4 py-2 bg-blue-300 text-white text-sm rounded-lg flex items-center gap-2 cursor-not-allowed"
                              disabled
                            >
                              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                              </svg>
                              Transcribing...
                            </button>
                          ) : (
                            <button
                              onClick={() => transcribeFile(file.uploadUrl!, i)}
                              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-all"
                            >
                              Transcribe
                            </button>
                          )
                        )}





                        {file.transcript && (
                          <a
                            href={`data:text/plain;charset=utf-8,${encodeURIComponent(file.transcript)}`}
                            download={`${file.name.replace(/\.[^/.]+$/, "")}-transcript.txt`}
                            className="inline-block mt-2 text-sm text-blue-700 underline"
                          >
                            Download Transcript
                          </a>
                        )}




                        {file.summary && (() => {
                          const sections = splitSections(file.summary);
                          return (
                            <div className="mt-2 p-3 bg-blue-50 rounded-xl text-base">
                              {Object.entries(sections).map(([title, content]) => (
                                <div key={title} className="mb-2">
                                  <span className="font-bold text-blue-700 text-lg">{title}:</span>
                                  <div className="text-gray-900 text-base ml-2">{String(content)}</div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}






                        {file.duration && !file.summary && (
                          summarizingIndex === i ? (
                            <button
                              className="mt-2 px-4 py-2 bg-blue-300 text-white text-sm rounded-lg flex items-center gap-2 cursor-not-allowed"
                              disabled
                            >
                              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                              </svg>
                              Summarizing...
                            </button>
                          ) : (
                            <button
                              onClick={() => summarizeTranscript(file.duration!, i)}
                              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-all"
                            >
                              Summarize
                            </button>
                          )
                        )}















                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                        title="Remove file"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}


                <div className="flex space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Upload More Files
                  </button>
                  <button
                    onClick={clearAll}
                    className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors duration-200 font-medium"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}

            {isUploading && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4 mx-auto"></div>
                  <p className="text-gray-600 font-medium">Processing your audio files...</p>
                </div>
              </div>
            )}
          </div>






          {hasTranscript && (
            <div className="mt-10 bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              {/* Show dropdown if more than one transcript */}
              {uploadedFiles.filter(f => !!f.duration).length > 1 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Choose transcript to chat with:
                  </label>
                  <select
                    value={selectedTranscript ?? ""}
                    onChange={e => setSelectedTranscript(Number(e.target.value))}
                    className="p-2 border rounded-lg w-full"
                  >
                    <option value="">-- Select a transcript --</option>
                    {uploadedFiles.map((file, idx) =>
                      file.duration ? (
                        <option value={idx} key={idx}>
                          {file.name}
                        </option>
                      ) : null
                    )}
                  </select>
                </div>
              )}

              <h3 className="text-lg font-bold text-gray-800 mb-2">
                Ask VoiceScribe about your transcript
              </h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  className="flex-1 p-2 border rounded-lg"
                  placeholder="e.g. What in particular do you want to know?"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleChat(); }}
                  disabled={chatLoading || recording}
                />
                <button
                  type="button"
                  onClick={handleMicClick}
                  className={`p-2 rounded-lg border transition-all ${recording ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-700'} hover:bg-blue-200`}
                  title={recording ? "Listening..." : "Speak your question"}
                  aria-label={recording ? "Listening..." : "Speak your question"}
                  disabled={chatLoading}
                >
                  <Mic className={`w-6 h-6 ${recording ? "animate-pulse" : ""}`} />
                </button>
              </div>

              <button
                onClick={handleChat}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                disabled={chatLoading || !chatInput.trim()}
              >
                {chatLoading ? "Thinking..." : "Ask"}
              </button>
              <div className="mt-4 space-y-2">
                {chatHistory.map((entry, idx) => (
                  <div key={idx} className="p-3 bg-blue-50 rounded-xl">
                    <div className="font-semibold text-gray-700">You: {entry.question}</div>
                    <div className="text-gray-900">VoiceScribe: {entry.answer}</div>
                  </div>
                ))}
              </div>
            </div>
          )}







          {/* Features */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Upload className="w-6 h-6 text-purple-600" />,
                title: 'Easy Upload',
                desc: 'Simple drag-and-drop or click to upload',
              },
              {
                icon: <FileAudio className="w-6 h-6 text-blue-600" />,
                title: 'Multiple Formats',
                desc: 'MP3, WAV, FLAC, AAC, and more',
              },
              {
                icon: <CheckCircle className="w-6 h-6 text-green-600" />,
                title: 'Instant Feedback',
                desc: 'Get immediate file info',
              },
            ].map((f, i) => (
              <div className="text-center p-6" key={i}>
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
