import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLauncher } from "./hooks/useLauncher";
import { useAcpAgent } from "./hooks/useAcpAgent";
import SearchBar from "./components/SearchBar";
import CategoryBar from "./components/CategoryBar";
import ItemList from "./components/ItemList";
import StatusBar from "./components/StatusBar";
import { AgentResponse } from "./components/AgentResponse";
import { PermissionDialog } from "./components/PermissionDialog";
import { AgentSettings } from "./components/AgentSettings";
import type { AgentConfig } from "./types";

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoFallback, setAutoFallback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const agent = useAcpAgent();

  const launcher = useLauncher({
    agentStatus: agent.status,
    agentAutoFallback: autoFallback,
    onAgentPrompt: agent.prompt,
    onAgentCancel: agent.cancel,
    agentTurnActive: agent.turnActive,
  });

  // Load auto_fallback setting on mount
  useEffect(() => {
    invoke<string | null>("get_setting", { key: "acp.auto_fallback" })
      .then((val) => setAutoFallback(val === "true"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Ctrl+, for settings
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if (e.key === "," && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  const handleConnect = useCallback(
    async (config: AgentConfig) => {
      setAutoFallback(config.auto_fallback);
      await agent.connect(config);
    },
    [agent],
  );

  const showAgentResponse =
    launcher.agentMode || agent.turnActive || agent.messages;

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-launcher-bg/95 backdrop-blur-xl rounded-xl border border-launcher-border/50 shadow-2xl overflow-hidden"
      onKeyDown={launcher.handleKeyDown}
      tabIndex={0}
    >
      <SearchBar
        query={launcher.query}
        onQueryChange={launcher.setQuery}
        loading={launcher.loading}
        agentStatus={agent.status}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      {!showAgentResponse && launcher.categories.length > 0 && (
        <CategoryBar
          categories={launcher.categories}
          activeCategory={launcher.activeCategory}
          onCategoryChange={launcher.setActiveCategory}
        />
      )}

      {showAgentResponse ? (
        <>
          <AgentResponse
            messages={agent.messages}
            thoughts={agent.thoughts}
            isThinking={agent.isThinking}
            turnActive={agent.turnActive}
          />
          {agent.permissionRequest && (
            <PermissionDialog
              request={agent.permissionRequest}
              onResolve={agent.resolvePermission}
            />
          )}
        </>
      ) : (
        <ItemList
          items={launcher.items}
          selectedIndex={launcher.selectedIndex}
          onSelect={launcher.setSelectedIndex}
          onExecute={launcher.executeSelected}
        />
      )}

      <StatusBar
        itemCount={launcher.items.length}
        agentMode={launcher.agentMode}
        agentTurnActive={agent.turnActive}
      />

      {settingsOpen && (
        <AgentSettings
          status={agent.status}
          onConnect={handleConnect}
          onDisconnect={agent.disconnect}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
