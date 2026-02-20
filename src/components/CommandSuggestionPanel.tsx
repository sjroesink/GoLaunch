import { CommandSuggestion } from "../types";

interface CommandSuggestionPanelProps {
  suggestions: CommandSuggestion[];
  query: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onSave: (suggestion: CommandSuggestion) => void;
  saving: boolean;
}

const REASON_LABELS: Record<string, string> = {
  history_match: "from history",
  similar_item: "similar command exists",
  query_parse: "new command",
};

function CommandSuggestionPanel({
  suggestions,
  query,
  selectedIndex,
  onSelect,
  onSave,
  saving,
}: CommandSuggestionPanelProps) {
  return (
    <div className="window-no-drag flex-1 overflow-y-auto px-2 py-2">
      <div className="px-3 py-2 text-xs text-launcher-muted/70">
        No matching commands for{" "}
        <span className="text-launcher-text font-medium">"{query}"</span>
      </div>

      {suggestions.map((suggestion, index) => {
        const isSelected = index === selectedIndex;

        return (
          <button
            key={`${suggestion.suggested_command}-${index}`}
            type="button"
            onClick={() => onSelect(index)}
            className={`w-full text-left flex items-center px-4 py-2.5 mx-1 rounded-lg transition-all duration-100 ${
              isSelected
                ? "bg-launcher-selected/80 border border-launcher-border/40"
                : "border border-transparent hover:bg-launcher-hover/50"
            }`}
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-launcher-surface/80 text-lg mr-3 flex-shrink-0">
              💡
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium truncate ${
                    isSelected ? "text-white" : "text-launcher-text"
                  }`}
                >
                  {suggestion.suggested_command}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-launcher-accent/20 text-launcher-accent flex-shrink-0">
                  {REASON_LABELS[suggestion.reason] || suggestion.reason}
                </span>
              </div>
              <p className="text-xs text-launcher-muted/70 truncate mt-0.5">
                Save as a predefined command
              </p>
            </div>

            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              {index === 0 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onSave(suggestion);
                  }}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${
                    saving
                      ? "opacity-50 cursor-default bg-launcher-accent/20 text-launcher-accent border-launcher-accent/30"
                      : "bg-launcher-accent/20 text-launcher-accent border-launcher-accent/30 hover:bg-launcher-accent/30"
                  }`}
                >
                  {saving ? "Saving..." : "Save"}
                  <kbd className="text-[9px] px-1 py-0.5 rounded bg-launcher-surface text-launcher-muted border border-launcher-border/30 ml-1">
                    Ctrl+S
                  </kbd>
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default CommandSuggestionPanel;
