import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import toast from "react-hot-toast";

import {
  ClipboardIcon,
  CheckIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ArrowPathIcon,
  SparklesIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

import {
  HandThumbUpIcon as HandThumbUpSolid,
  HandThumbDownIcon as HandThumbDownSolid,
} from "@heroicons/react/24/solid";

import TypingIndicator from "./TypingIndicator";
import LoadingSkeleton from "./LoadingSkeleton";

function CodeBlock(props) {
  const { children, className } = props;

  const [copied, setCopied] = useState(false);

  const match = /language-(\w+)/.exec(className || "");
  const code = String(children).replace(/\n$/, "");

  // Inline code
  if (!match) {
    return (
      <code className="rounded bg-gray-700 px-1 py-0.5 font-mono text-green-400">
        {children}
      </code>
    );
  }

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied");

    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-gray-700">
      <div className="flex items-center justify-between bg-gray-900 px-4 py-2">
        <span className="text-xs text-gray-400">{match[1]}</span>

        <button
          onClick={copyCode}
          className="flex items-center gap-1 text-xs text-green-400"
        >
          {copied ? (
            <CheckIcon className="h-4 w-4" />
          ) : (
            <ClipboardIcon className="h-4 w-4" />
          )}

          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <SyntaxHighlighter
        language={match[1]}
        style={oneDark}
        wrapLongLines
        customStyle={{
          margin: 0,
          background: "#111827",
          padding: "16px",
          fontSize: "14px",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export default function MessageBubble({
  message,
  isLast,
  onRegenerate,
  onReact,
}) {
  const isUser = message.role === "user";

  const [copied, setCopied] = useState(false);

  async function copyResponse() {
    await navigator.clipboard.writeText(message.content);

    setCopied(true);

    toast.success("Copied");

    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {/* Avatar */}

      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          isUser
            ? "bg-gray-700 text-white"
            : "bg-green-500 text-black"
        }`}
      >
        {isUser ? (
          <UserIcon className="h-5 w-5" />
        ) : (
          <SparklesIcon className="h-5 w-5" />
        )}
      </div>

      {/* Bubble */}

      <div className="max-w-[75%]">

        <div
          className={`rounded-2xl px-5 py-4 shadow-lg ${
            isUser
              ? "bg-green-500 text-black"
              : "bg-gray-800 text-gray-100 border border-gray-700"
          }`}
        >
          {message.status === "typing" ? (
            <TypingIndicator />
          ) : message.status === "loading" ? (
            <LoadingSkeleton />
          ) : isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock,

                ul: ({ children }) => (
                  <ul className="ml-6 list-disc space-y-1">
                    {children}
                  </ul>
                ),

                ol: ({ children }) => (
                  <ol className="ml-6 list-decimal space-y-1">
                    {children}
                  </ol>
                ),

                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-green-400 underline"
                  >
                    {children}
                  </a>
                ),

                strong: ({ children }) => (
                  <strong className="font-bold text-green-400">
                    {children}
                  </strong>
                ),

                p: ({ children }) => (
                  <div className="mb-3 leading-7">
                    {children}
                  </div>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Assistant Buttons */}

        {!isUser && message.status !== "typing" && (
          <div className="mt-2 flex gap-2">

            <button
              onClick={copyResponse}
              className="rounded-lg p-2 hover:bg-gray-800"
            >
              {copied ? (
                <CheckIcon className="h-4 w-4 text-green-400" />
              ) : (
                <ClipboardIcon className="h-4 w-4 text-gray-400" />
              )}
            </button>

            <button
              onClick={() => onReact?.(message.id, "like")}
              className="rounded-lg p-2 hover:bg-gray-800"
            >
              {message.reaction === "like" ? (
                <HandThumbUpSolid className="h-4 w-4 text-green-400" />
              ) : (
                <HandThumbUpIcon className="h-4 w-4 text-gray-400" />
              )}
            </button>

            <button
              onClick={() => onReact?.(message.id, "dislike")}
              className="rounded-lg p-2 hover:bg-gray-800"
            >
              {message.reaction === "dislike" ? (
                <HandThumbDownSolid className="h-4 w-4 text-red-400" />
              ) : (
                <HandThumbDownIcon className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {isLast && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-2 text-sm hover:bg-gray-700"
              >
                <ArrowPathIcon className="h-4 w-4 text-green-400" />
                Regenerate
              </button>
            )}

          </div>
        )}
      </div>
    </motion.div>
  );
}