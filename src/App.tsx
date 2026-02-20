import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLauncher } from "./hooks/useLauncher";
import { useAcpAgent } from "./hooks/useAcpAgent";
import { useLaunchContext } from "./hooks/useLaunchContext";
import SearchBar from "./components/SearchBar";
import CategoryBar from "./components/CategoryBar";
import ItemList from "./components/ItemList";
import StatusBar from "./components/StatusBar";
import { AgentResponse } from "./components/AgentResponse";
import { AgentSettings } from "./components/AgentSettings";
import CommandSuggestionPanel from "./components/CommandSuggestionPanel";
import ConversationHistory from "./components/ConversationHistory";
import { RewriteQuickActions } from "./components/RewriteQuickActions";
import type { AgentConfig } from "./types";

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoFallback, setAutoFallback] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historySelectedIndex, setHistorySelectedIndex] = useState(0);
  const [rewriteSelectedIndex, setRewriteSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const agent = useAcpAgent();
  const launchCtx = useLaunchContext();

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

  const handleShowHistory = useCallback(() => {
    setShowHistory(true);
    setHistorySelectedIndex(0);
    agent.loadConversations();
  }, [agent]);

  const handleHideHistory = useCallback(() => {
    setShowHistory(false);
  }, []);

  const handleLoadConversation = useCallback(
    (conversationId: string) => {
      agent.loadConversation(conversationId);
      setShowHistory(false);
    },
    [agent],
  );

  const handleNewConversation = useCallback(() => {
    agent.newConversation();
    setShowHistory(false);
  }, [agent]);

  const exitAgentMode = useCallback(() => {
    if (agent.turnActive) {
      agent.cancel();
    }

    if (launcher.query.length > 0) {
      launcher.setQuery("");
    }

    if (agent.thread.length > 0) {
      agent.clearThread();
    }

    setShowHistory(false);

    // Refresh search results — the agent may have added/removed items
    launcher.refresh();
  }, [agent, launcher]);

  const handleRewriteQuickAction = useCallback(
    (prompt: string) => {
      agent.prompt(prompt);
      launcher.setQuery("");
    },
    [agent, launcher],
  );

  const showAgentThread = agent.turnActive || agent.thread.length > 0;
  const isAgentInputMode = launcher.agentMode || showAgentThread || showHistory;

  // Determine what to show in agent mode
  const showRewriteActions =
    isAgentInputMode &&
    !showAgentThread &&
    !showHistory &&
    launchCtx.hasSelection &&
    launchCtx.rewriteSuggestions.length > 0 &&
    !launcher.query.trim();

  const showConversationHistory =
    isAgentInputMode &&
    !showAgentThread &&
    !showRewriteActions &&
    (showHistory || agent.conversations.length > 0);

  const showOnlySearch =
    launcher.items.length === 0 &&
    !showAgentThread &&
    !showHistory &&
    !showRewriteActions;
  const windowAnchor = isAgentInputMode ? "bottom" : "top";

  useEffect(() => {
    invoke("set_window_compact", {
      compact: showOnlySearch && !settingsOpen,
      anchor: windowAnchor,
    }).catch(() => {});
  }, [showOnlySearch, settingsOpen, windowAnchor]);

  // Load conversations when entering agent mode with no thread
  useEffect(() => {
    if (isAgentInputMode && !showAgentThread && !showHistory) {
      agent.loadConversations();
    }
  }, [isAgentInputMode, showAgentThread, showHistory]);

  // Filter conversations when typing in history mode
  useEffect(() => {
    if (showHistory && launcher.query.trim()) {
      agent.searchConversations(launcher.query.trim());
    } else if (showHistory) {
      agent.loadConversations();
    }
  }, [showHistory, launcher.query]);

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isAgentInputMode && e.key === "Enter") {
        if (showHistory) {
          // Enter in history mode loads the selected conversation
          e.preventDefault();
          const conv = agent.conversations[historySelectedIndex];
          if (conv) handleLoadConversation(conv.id);
          return;
        }
        // Enter on rewrite quick action triggers agent with that prompt
        if (showRewriteActions && !launcher.query.trim()) {
          e.preventDefault();
          const suggestion =
            launchCtx.rewriteSuggestions[rewriteSelectedIndex];
          if (suggestion) handleRewriteQuickAction(suggestion.suggested_command);
          return;
        }
        e.preventDefault();
        if (!agent.turnActive) {
          const message = launcher.query.trim();
          if (message.length > 0) {
            agent.prompt(message);
            launcher.setQuery("");
          }
        }
        return;
      }

      if (isAgentInputMode && e.key === "Escape") {
        e.preventDefault();
        if (showHistory) {
          handleHideHistory();
        } else {
          exitAgentMode();
        }
        return;
      }

      // Arrow keys in rewrite quick actions mode
      if (
        showRewriteActions &&
        (e.key === "ArrowDown" || e.key === "ArrowUp")
      ) {
        e.preventDefault();
        const max = launchCtx.rewriteSuggestions.length - 1;
        if (e.key === "ArrowDown") {
          setRewriteSelectedIndex((prev) => Math.min(prev + 1, max));
        } else {
          setRewriteSelectedIndex((prev) => Math.max(prev - 1, 0));
        }
        return;
      }

      // Arrow keys in history mode
      if (showHistory && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        if (e.key === "ArrowDown") {
          setHistorySelectedIndex((prev) =>
            Math.min(prev + 1, agent.conversations.length - 1),
          );
        } else {
          setHistorySelectedIndex((prev) => Math.max(prev - 1, 0));
        }
        return;
      }

      launcher.handleKeyDown(e);
    },
    [
      isAgentInputMode,
      showHistory,
      showRewriteActions,
      agent,
      launcher,
      launchCtx,
      exitAgentMode,
      handleHideHistory,
      handleLoadConversation,
      handleRewriteQuickAction,
      historySelectedIndex,
      rewriteSelectedIndex,
    ],
  );

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-launcher-bg/95 backdrop-blur-xl rounded-xl border border-launcher-border/50 shadow-2xl overflow-hidden"
      onKeyDown={handleContainerKeyDown}
      tabIndex={0}
    >
      {isAgentInputMode ? (
        <>
          {showAgentThread ? (
            <AgentResponse
              thread={agent.thread}
              thoughts={agent.thoughts}
              isThinking={agent.isThinking}
              turnActive={agent.turnActive}
              permissionRequest={agent.permissionRequest}
              onResolvePermission={agent.resolvePermission}
              onNewConversation={handleNewConversation}
              onShowHistory={handleShowHistory}
              hasSelection={launchCtx.hasSelection}
              onReplaceSelection={async (text) => {
                try {
                  await launchCtx.replaceSelection(text);
                  // Record the rewrite prompt for future suggestions
                  const lastUserMsg = [...agent.thread]
                    .reverse()
                    .find((m) => m.role === "user");
                  if (lastUserMsg) {
                    launchCtx
                      .recordRewrite(lastUserMsg.content)
                      .catch(() => {});
                  }
                } catch (e) {
                  console.error("Failed to replace selection:", e);
                }
              }}
            />
          ) : showRewriteActions ? (
            <RewriteQuickActions
              suggestions={launchCtx.rewriteSuggestions}
              onSelect={handleRewriteQuickAction}
              selectedIndex={rewriteSelectedIndex}
              onHover={setRewriteSelectedIndex}
            />
          ) : showConversationHistory ? (
            <ConversationHistory
              conversations={agent.conversations}
              selectedIndex={historySelectedIndex}
              onSelect={setHistorySelectedIndex}
              onLoad={handleLoadConversation}
              onDelete={agent.deleteConversation}
              onNewConversation={handleNewConversation}
            />
          ) : (
            <div className="flex-1" />
          )}
          <SearchBar
            query={launcher.query}
            onQueryChange={launcher.setQuery}
            loading={false}
            agentStatus={agent.status}
            onSettingsClick={() => setSettingsOpen(true)}
            onBackClick={exitAgentMode}
            mode="composer"
            position="bottom"
            contextInfo={{
              hasSelection: launchCtx.hasSelection,
              hasClipboard: launchCtx.hasClipboard,
              sourceApp: launchCtx.context.source_window_title,
              selectedText: launchCtx.context.selected_text,
              clipboardText: launchCtx.context.clipboard_text,
            }}
          />
        </>
      ) : (
        <>
          <SearchBar
            query={launcher.query}
            onQueryChange={launcher.setQuery}
            onInputFocus={launcher.handleInputFocus}
            focusSignal={launcher.focusInputSignal}
            loading={launcher.loading}
            agentStatus={agent.status}
            onSettingsClick={() => setSettingsOpen(true)}
            mode="search"
            position="top"
          />

          {!showOnlySearch && launcher.categories.length > 0 && (
            <CategoryBar
              categories={launcher.categories}
              activeCategory={launcher.activeCategory}
              onCategoryChange={launcher.setActiveCategory}
            />
          )}

          {!showOnlySearch &&
            (launcher.suggestions.length > 0 ? (
              <CommandSuggestionPanel
                suggestions={launcher.suggestions}
                query={launcher.query}
                selectedIndex={launcher.selectedSuggestionIndex}
                onSelect={launcher.selectSuggestion}
                onSave={launcher.saveCommandFromSuggestion}
                saving={launcher.savingCommand}
              />
            ) : (
              <ItemList
                items={launcher.items}
                selectedIndex={launcher.selectedIndex}
                onSelect={launcher.setSelectedIndex}
                onExecute={launcher.executeSelected}
              />
            ))}

          {!showOnlySearch && (
            <StatusBar
              itemCount={launcher.items.length}
              agentMode={launcher.agentMode}
              agentTurnActive={agent.turnActive}
              hasSuggestions={launcher.suggestions.length > 0}
            />
          )}
        </>
      )}

      {settingsOpen && (
        <AgentSettings
          status={agent.status}
          configOptions={agent.configOptions}
          onConnect={handleConnect}
          onDisconnect={agent.disconnect}
          onClose={() => setSettingsOpen(false)}
          onSetConfigOption={agent.setConfigOption}
        />
      )}
    </div>
  );
}

export default App;
