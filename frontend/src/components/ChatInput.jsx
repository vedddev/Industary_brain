import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import api from "../api/chatApi";

import {
  PaperAirplaneIcon,
  PaperClipIcon,
  MicrophoneIcon,
  StopCircleIcon,
} from "@heroicons/react/24/solid";

const MAX_CHARS = 4000;

export default function ChatInput({ onSend, isLoading }) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const handleSubmit = () => {
    const trimmed = text.trim();

    if (!trimmed || isLoading) return;

    onSend(trimmed);

    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Upload PDFs
  const handleAttachment = async (e) => {
    const files = [...e.target.files];

    if (!files.length) return;

    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      setUploading(true);

      await api.post("/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success(`${files.length} document(s) uploaded successfully`);
    } catch (err) {
      console.error(err);

      toast.error("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleVoice = () => {
    if (!isRecording) {
      setIsRecording(true);

      toast("Voice input coming soon 🎙️");
    } else {
      setIsRecording(false);

      toast.success("Recording stopped");
    }
  };

  const charCount = text.length;

  const overLimit = charCount > MAX_CHARS;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-5">

      <div className="rounded-3xl border border-gray-700 bg-gray-800 p-3 shadow-xl transition-all focus-within:border-green-400 focus-within:shadow-[0_0_25px_rgba(34,197,94,.4)]">

        <textarea
          ref={textareaRef}
          value={text}
          rows={1}
          placeholder="Ask anything about your documents..."
          onChange={(e) =>
            setText(e.target.value.slice(0, MAX_CHARS + 200))
          }
          onKeyDown={handleKeyDown}
          className="max-h-[220px] w-full resize-none bg-transparent px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none"
        />

        <div className="mt-2 flex items-center justify-between">

          <div className="flex items-center gap-2">

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={handleAttachment}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-full p-2 text-gray-400 transition hover:bg-gray-700 hover:text-green-400"
              title="Upload PDF"
            >
              <PaperClipIcon className="h-5 w-5" />
            </button>

            <button
              onClick={handleVoice}
              className={`rounded-full p-2 transition ${
                isRecording
                  ? "animate-pulse text-red-500"
                  : "text-gray-400 hover:bg-gray-700 hover:text-green-400"
              }`}
            >
              {isRecording ? (
                <StopCircleIcon className="h-5 w-5" />
              ) : (
                <MicrophoneIcon className="h-5 w-5" />
              )}
            </button>

            {uploading && (
              <span className="text-sm text-green-400">
                Uploading...
              </span>
            )}

          </div>

          <div className="flex items-center gap-3">

            <span
              className={`text-xs ${
                overLimit ? "text-red-500" : "text-gray-500"
              }`}
            >
              {charCount}/{MAX_CHARS}
            </span>

            <motion.button
              whileTap={{ scale: 0.9 }}
              disabled={isLoading || overLimit || !text.trim()}
              onClick={handleSubmit}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-green-400 text-black transition hover:scale-105 hover:shadow-[0_0_25px_#39FF14] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </motion.button>

          </div>

        </div>

      </div>

      <p className="mt-2 text-center text-xs text-gray-500">
        Press <kbd className="rounded bg-gray-700 px-1">Enter</kbd> to send ·{" "}
        <kbd className="rounded bg-gray-700 px-1">Shift</kbd> +{" "}
        <kbd className="rounded bg-gray-700 px-1">Enter</kbd> for a new line
      </p>

    </div>
  );
}