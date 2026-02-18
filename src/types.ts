export interface LaunchItem {
  id: string;
  title: string;
  subtitle: string | null;
  icon: string | null;
  action_type: string;
  action_value: string;
  category: string;
  tags: string;
  frequency: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ACP Agent types

export type AgentStatus = "disconnected" | "connecting" | "connected" | "error";

export type AgentUpdate =
  | { type: "message_chunk"; text: string }
  | { type: "thought_chunk"; text: string }
  | { type: "tool_call"; id: string; title: string; kind: string }
  | { type: "tool_call_update"; id: string; title: string | null; status: string | null }
  | { type: "plan"; entries: PlanEntry[] }
  | { type: "turn_complete"; stop_reason: string }
  | { type: "status_change"; status: AgentStatus };

export interface PlanEntry {
  content: string;
  priority: string;
  status: string;
}

export interface PermissionRequest {
  request_id: string;
  session_id: string;
  tool_name: string;
  tool_description: string | null;
  command_preview: string | null;
  options: PermissionOption[];
}

export interface PermissionOption {
  option_id: string;
  name: string;
  kind: string;
}

export interface RegistryAgent {
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string | null;
  distribution_type: string;
  distribution_detail: string;
}

export interface AgentConfig {
  source: string;
  agent_id: string;
  binary_path: string;
  args: string;
  env: string;
  auto_fallback: boolean;
}
