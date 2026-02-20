import type { CommandSuggestion } from "../types";

interface RewriteQuickActionsProps {
  suggestions: CommandSuggestion[];
  onSelect: (prompt: string) => void;
  selectedIndex: number;
  onHover: (index: number) => void;
}

export function RewriteQuickActions({
  suggestions,
  onSelect,
  selectedIndex,
  onHover,
}: RewriteQuickActionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="px-3 pt-2 pb-1">
        <div className="text-[10px] font-medium text-launcher-muted/70 uppercase tracking-wider mb-1.5">
          Recent rewrites
        </div>
      </div>
      <div className="px-1">
        {suggestions.map((s, i) => (
          <button
            key={s.suggested_command}
            onClick={() => onSelect(s.suggested_command)}
            onMouseEnter={() => onHover(i)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2.5 transition-colors ${
              i === selectedIndex
                ? "bg-launcher-hover/80 text-launcher-text"
                : "text-launcher-text/80 hover:bg-launcher-hover/50"
            }`}
          >
            <span className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center bg-purple-500/20 text-purple-300">
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </span>
            <span className="truncate">{s.suggested_command}</span>
            <span className="ml-auto text-[10px] text-launcher-muted/50 flex-shrink-0">
              Enter
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
