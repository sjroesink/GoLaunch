import type { AgentStatus } from "../types";

interface AgentStatusIndicatorProps {
  status: AgentStatus;
  onClick?: () => void;
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  connected: "#4ade80",
  connecting: "#facc15",
  disconnected: "#9ca3af",
  error: "#f87171",
};

export function AgentStatusIndicator({ status, onClick }: AgentStatusIndicatorProps) {
  if (status === "disconnected") return null;

  const clickable = onClick && status === "connected";

  return (
    <button
      className={`ml-2 p-1 rounded transition-colors ${
        clickable
          ? "hover:bg-launcher-hover cursor-pointer"
          : "cursor-default"
      }`}
      title={status === "connected" ? "Enter agent mode" : `Agent: ${status}`}
      onClick={clickable ? onClick : undefined}
      tabIndex={clickable ? 0 : -1}
      type="button"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke={STATUS_COLORS[status]}
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-1.47 4.41a2.25 2.25 0 01-2.133 1.59h-6.794a2.25 2.25 0 01-2.133-1.59L5 14.5m14 0H5"
        />
      </svg>
    </button>
  );
}
