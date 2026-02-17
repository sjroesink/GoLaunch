import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AgentStatus,
  AgentUpdate,
  AgentConfig,
  PermissionRequest,
} from "../types";

export function useAcpAgent() {
  const [status, setStatus] = useState<AgentStatus>("disconnected");
  const [messages, setMessages] = useState("");
  const [thoughts, setThoughts] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [turnActive, setTurnActive] = useState(false);
  const [permissionRequest, setPermissionRequest] =
    useState<PermissionRequest | null>(null);

  useEffect(() => {
    const unlistenUpdate = listen<AgentUpdate>("acp-update", (event) => {
      const update = event.payload;

      switch (update.type) {
        case "message_chunk":
          setMessages((prev) => prev + update.text);
          setIsThinking(false);
          break;
        case "thought_chunk":
          setThoughts((prev) => prev + update.text);
          setIsThinking(true);
          break;
        case "tool_call":
          setIsThinking(true);
          break;
        case "tool_call_update":
          break;
        case "plan":
          break;
        case "turn_complete":
          setTurnActive(false);
          setIsThinking(false);
          break;
        case "status_change":
          setStatus(update.status);
          break;
      }
    });

    const unlistenPermission = listen<PermissionRequest>(
      "acp-permission-request",
      (event) => {
        setPermissionRequest(event.payload);
      }
    );

    return () => {
      unlistenUpdate.then((f) => f());
      unlistenPermission.then((f) => f());
    };
  }, []);

  const connect = useCallback(async (config: AgentConfig) => {
    try {
      await invoke("acp_connect", { config });
    } catch (e) {
      console.error("Failed to connect agent:", e);
      setStatus("error");
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await invoke("acp_disconnect");
      setStatus("disconnected");
    } catch (e) {
      console.error("Failed to disconnect agent:", e);
    }
  }, []);

  const prompt = useCallback(async (query: string) => {
    setMessages("");
    setThoughts("");
    setTurnActive(true);
    setIsThinking(true);

    try {
      // Get all items for context
      const items = await invoke("get_all_items");
      await invoke("acp_prompt", { query, contextItems: items });
    } catch (e) {
      console.error("Failed to prompt agent:", e);
      setTurnActive(false);
      setIsThinking(false);
    }
  }, []);

  const cancel = useCallback(async () => {
    try {
      await invoke("acp_cancel");
      setTurnActive(false);
      setIsThinking(false);
    } catch (e) {
      console.error("Failed to cancel:", e);
    }
  }, []);

  const resolvePermission = useCallback(
    async (requestId: string, optionId: string) => {
      try {
        await invoke("acp_resolve_permission", { requestId, optionId });
        setPermissionRequest(null);
      } catch (e) {
        console.error("Failed to resolve permission:", e);
      }
    },
    []
  );

  return {
    status,
    messages,
    thoughts,
    isThinking,
    turnActive,
    permissionRequest,
    connect,
    disconnect,
    prompt,
    cancel,
    resolvePermission,
  };
}
