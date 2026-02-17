use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryAgent {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub icon: Option<String>,
    pub distribution_type: String,
    pub distribution_detail: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentUpdate {
    MessageChunk { text: String },
    ThoughtChunk { text: String },
    ToolCall { id: String, title: String, kind: String },
    ToolCallUpdate { id: String, title: Option<String>, status: Option<String> },
    Plan { entries: Vec<PlanEntry> },
    TurnComplete { stop_reason: String },
    StatusChange { status: AgentStatus },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanEntry {
    pub content: String,
    pub priority: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionRequest {
    pub request_id: String,
    pub session_id: String,
    pub tool_name: String,
    pub tool_description: Option<String>,
    pub command_preview: Option<String>,
    pub options: Vec<PermissionOptionInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionOptionInfo {
    pub option_id: String,
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentConfig {
    pub source: String,
    pub agent_id: String,
    pub binary_path: String,
    pub args: String,
    pub env: String,
    pub auto_fallback: bool,
}
