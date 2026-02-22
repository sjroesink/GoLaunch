import type { SlashCommand } from "../types";

interface SlashCommandListProps {
  commands: SlashCommand[];
  query: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onExecute: (command: SlashCommand, args: string) => void;
}

function SlashCommandList({
  commands,
  query,
  selectedIndex,
  onSelect,
  onExecute,
}: SlashCommandListProps) {
  return (
    <div className="window-no-drag flex-1 overflow-y-auto px-2 py-2">
      <div className="px-3 py-2 text-xs text-launcher-muted/70">
        Slash commands
        {query.length > 1 && (
          <>
            {" "}matching{" "}
            <span className="text-launcher-text font-medium">
              "{query}"
            </span>
          </>
        )}
      </div>

      {commands.map((cmd, index) => {
        const isSelected = index === selectedIndex;
        return (
          <button
            key={cmd.id}
            type="button"
            onClick={() => onSelect(index)}
            onDoubleClick={() => onExecute(cmd, "")}
            className={`w-full text-left flex items-center px-4 py-2.5 mx-1 rounded-lg transition-all duration-100 ${
              isSelected
                ? "bg-launcher-selected/80 border border-launcher-border/40"
                : "border border-transparent hover:bg-launcher-hover/50"
            }`}
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-launcher-surface/80 text-lg mr-3 flex-shrink-0 font-mono text-launcher-accent">
              /
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium truncate ${
                    isSelected ? "text-white" : "text-launcher-text"
                  }`}
                >
                  /{cmd.name}
                </span>
                {cmd.usage_count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-launcher-accent/20 text-launcher-accent flex-shrink-0">
                    {cmd.usage_count}x used
                  </span>
                )}
              </div>
              {cmd.description && (
                <p className="text-xs text-launcher-muted/70 truncate mt-0.5">
                  {cmd.description}
                </p>
              )}
            </div>
          </button>
        );
      })}

      {commands.length === 0 && query.length > 1 && (
        <div className="px-4 py-3 text-xs text-launcher-muted/50 text-center">
          No slash commands matching "{query}" — press Enter to create one with AI
        </div>
      )}
    </div>
  );
}

export default SlashCommandList;
