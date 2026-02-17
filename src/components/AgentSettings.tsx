import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AgentConfig, AgentStatus, RegistryAgent } from "../types";

interface AgentSettingsProps {
  status: AgentStatus;
  onConnect: (config: AgentConfig) => void;
  onDisconnect: () => void;
  onClose: () => void;
}

export function AgentSettings({
  status,
  onConnect,
  onDisconnect,
  onClose,
}: AgentSettingsProps) {
  const [config, setConfig] = useState<AgentConfig>({
    source: "manual",
    agent_id: "",
    binary_path: "",
    args: "",
    env: "",
    auto_fallback: false,
  });
  const [registryAgents, setRegistryAgents] = useState<RegistryAgent[]>([]);
  const [loadingRegistry, setLoadingRegistry] = useState(false);

  useEffect(() => {
    invoke<AgentConfig>("get_agent_config").then(setConfig).catch(console.error);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSave() {
    try {
      await invoke("save_agent_config", { config });
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  }

  async function handleRefreshRegistry() {
    setLoadingRegistry(true);
    try {
      const agents = await invoke<RegistryAgent[]>("acp_fetch_registry");
      setRegistryAgents(agents);
    } catch (e) {
      console.error("Failed to fetch registry:", e);
    }
    setLoadingRegistry(false);
  }

  function handleConnect() {
    handleSave();
    onConnect(config);
  }

  function selectRegistryAgent(agent: RegistryAgent) {
    setConfig((prev) => ({
      ...prev,
      source: "registry",
      agent_id: agent.id,
      binary_path: agent.distribution_detail,
    }));
  }

  return (
    <div className="agent-settings-overlay">
      <div className="agent-settings-panel">
        <div className="settings-header">
          <h3>Agent Settings</h3>
          <button className="settings-close-btn" onClick={onClose}>
            &#x2715;
          </button>
        </div>

        <div className="settings-section">
          <label className="settings-label">
            <input
              type="radio"
              name="source"
              value="registry"
              checked={config.source === "registry"}
              onChange={() =>
                setConfig((prev) => ({ ...prev, source: "registry" }))
              }
            />
            From Registry
          </label>
          <label className="settings-label">
            <input
              type="radio"
              name="source"
              value="manual"
              checked={config.source !== "registry"}
              onChange={() =>
                setConfig((prev) => ({ ...prev, source: "manual" }))
              }
            />
            Manual
          </label>
        </div>

        {config.source === "registry" && (
          <div className="settings-section">
            <button
              className="settings-btn"
              onClick={handleRefreshRegistry}
              disabled={loadingRegistry}
            >
              {loadingRegistry ? "Loading..." : "Refresh Registry"}
            </button>
            {registryAgents.length > 0 && (
              <div className="registry-list">
                {registryAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className={`registry-item ${config.agent_id === agent.id ? "registry-item-selected" : ""}`}
                    onClick={() => selectRegistryAgent(agent)}
                  >
                    <strong>{agent.name}</strong>
                    <span className="registry-version">v{agent.version}</span>
                    <div className="registry-description">
                      {agent.description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {config.source !== "registry" && (
          <div className="settings-section">
            <label className="settings-field-label">Binary Path</label>
            <input
              type="text"
              className="settings-input"
              value={config.binary_path}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  binary_path: e.target.value,
                }))
              }
              placeholder="/path/to/agent"
            />
            <label className="settings-field-label">Arguments</label>
            <input
              type="text"
              className="settings-input"
              value={config.args}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, args: e.target.value }))
              }
              placeholder="--flag value"
            />
            <label className="settings-field-label">
              Environment Variables
            </label>
            <input
              type="text"
              className="settings-input"
              value={config.env}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, env: e.target.value }))
              }
              placeholder="KEY=VALUE,KEY2=VALUE2"
            />
          </div>
        )}

        <div className="settings-section">
          <label className="settings-label">
            <input
              type="checkbox"
              checked={config.auto_fallback}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  auto_fallback: e.target.checked,
                }))
              }
            />
            Auto-fallback to agent on zero results
          </label>
        </div>

        <div className="settings-actions">
          {status === "connected" ? (
            <button className="settings-btn settings-btn-danger" onClick={onDisconnect}>
              Disconnect
            </button>
          ) : (
            <button
              className="settings-btn settings-btn-primary"
              onClick={handleConnect}
              disabled={status === "connecting"}
            >
              {status === "connecting" ? "Connecting..." : "Connect"}
            </button>
          )}
          <span className={`settings-status settings-status-${status}`}>
            {status}
          </span>
        </div>
      </div>
    </div>
  );
}
