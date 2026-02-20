import { useEffect, useRef, useCallback } from "react";
import type { ConversationWithPreview } from "../types";

interface ConversationHistoryProps {
  conversations: ConversationWithPreview[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onLoad: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
  onNewConversation: () => void;
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr + "Z"); // SQLite dates are UTC
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function ConversationHistory({
  conversations,
  selectedIndex,
  onSelect,
  onLoad,
  onDelete,
  onNewConversation,
}: ConversationHistoryProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (conversations.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        onSelect(Math.min(selectedIndex + 1, conversations.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onSelect(Math.max(selectedIndex - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const conv = conversations[selectedIndex];
        if (conv) onLoad(conv.id);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const conv = conversations[selectedIndex];
          if (conv) onDelete(conv.id);
        }
      }
    },
    [conversations, selectedIndex, onSelect, onLoad, onDelete],
  );

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-launcher-muted/60 px-4">
        <svg
          className="w-8 h-8 mb-3 opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h8M8 14h5m-1 8h8a2 2 0 002-2V8a2 2 0 00-2-2h-8l-4 4v10a2 2 0 002 2h2z"
          />
        </svg>
        <span className="text-sm">No conversations yet</span>
        <span className="text-xs mt-1 opacity-60">
          Start typing to chat with the agent
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="px-2 py-1.5 flex items-center justify-between border-b border-launcher-border/20">
        <span className="text-xs text-launcher-muted/70 px-2">
          Recent conversations
        </span>
        <button
          onClick={onNewConversation}
          className="text-xs px-2 py-0.5 rounded text-launcher-muted hover:text-launcher-text hover:bg-launcher-hover transition-colors"
          title="New conversation"
        >
          + New
        </button>
      </div>
      <div ref={listRef}>
        {conversations.map((conv, index) => {
          const isSelected = index === selectedIndex;
          return (
            <div
              key={conv.id}
              className={`px-4 py-2.5 cursor-pointer border-b border-launcher-border/10 transition-colors ${
                isSelected
                  ? "bg-launcher-hover/80"
                  : "hover:bg-launcher-hover/40"
              }`}
              onClick={() => onLoad(conv.id)}
              onMouseEnter={() => onSelect(index)}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm truncate flex-1 ${
                    isSelected
                      ? "text-launcher-text"
                      : "text-launcher-text/80"
                  }`}
                >
                  {conv.title}
                </span>
                <span className="text-xs text-launcher-muted/50 ml-2 flex-shrink-0">
                  {relativeTime(conv.updated_at)}
                </span>
              </div>
              <div className="flex items-center mt-0.5">
                <span className="text-xs text-launcher-muted/50 truncate flex-1">
                  {conv.last_message_preview || "(empty)"}
                </span>
                <span className="text-xs text-launcher-muted/40 ml-2 flex-shrink-0">
                  {conv.message_count} msg{conv.message_count !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
