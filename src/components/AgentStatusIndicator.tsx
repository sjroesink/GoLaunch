import type { AgentStatus } from "../types";

interface AgentStatusIndicatorProps {
  status: AgentStatus;
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  connected: "#4ade80",
  connecting: "#facc15",
  disconnected: "#9ca3af",
  error: "#f87171",
};

export function AgentStatusIndicator({ status }: AgentStatusIndicatorProps) {
  if (status === "disconnected") return null;

  return (
    <span
      className="agent-status-dot"
      title={`Agent: ${status}`}
      style={{ backgroundColor: STATUS_COLORS[status] }}
    />
  );
}
