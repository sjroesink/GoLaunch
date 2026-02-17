interface StatusBarProps {
  itemCount: number;
}

function StatusBar({ itemCount }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-launcher-border/30 text-[11px] text-launcher-muted/50">
      <span>
        {itemCount} {itemCount === 1 ? "item" : "items"}
      </span>
      <div className="flex items-center gap-3">
        <span>
          <kbd className="px-1 py-0.5 rounded bg-launcher-surface/50 border border-launcher-border/20">
            ↑↓
          </kbd>{" "}
          navigate
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-launcher-surface/50 border border-launcher-border/20">
            ↵
          </kbd>{" "}
          open
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-launcher-surface/50 border border-launcher-border/20">
            tab
          </kbd>{" "}
          category
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-launcher-surface/50 border border-launcher-border/20">
            esc
          </kbd>{" "}
          close
        </span>
      </div>
    </div>
  );
}

export default StatusBar;
