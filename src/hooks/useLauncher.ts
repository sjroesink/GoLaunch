import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LaunchItem, AgentStatus } from "../types";

interface UseLauncherOptions {
  agentStatus: AgentStatus;
  agentAutoFallback: boolean;
  onAgentPrompt: (query: string) => void;
  onAgentCancel: () => void;
  agentTurnActive: boolean;
}

export function useLauncher(options: UseLauncherOptions) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LaunchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchItems = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      const results = await invoke<LaunchItem[]>("search_items", {
        query: searchQuery,
      });
      setItems(results);
      setSelectedIndex(0);
    } catch (err) {
      console.error("Failed to fetch items:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await invoke<string[]>("get_categories");
      setCategories(cats);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  }, []);

  useEffect(() => {
    fetchItems("");
    fetchCategories();
  }, [fetchItems, fetchCategories]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchItems(query);
    }, 100);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchItems]);

  const filteredItems = activeCategory
    ? items.filter((item) => item.category === activeCategory)
    : items;

  // Agent mode: zero results, query has content, agent is connected
  const agentMode =
    filteredItems.length === 0 &&
    query.length > 2 &&
    options.agentStatus === "connected" &&
    options.agentAutoFallback;

  const executeSelected = useCallback(async () => {
    const item = filteredItems[selectedIndex];
    if (!item) return;
    try {
      await invoke("execute_item", { id: item.id });
      await invoke("hide_window");
    } catch (err) {
      console.error("Failed to execute item:", err);
    }
  }, [filteredItems, selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // In agent mode with active turn, Escape cancels
      if (options.agentTurnActive && e.key === "Escape") {
        e.preventDefault();
        options.onAgentCancel();
        return;
      }

      // In agent mode, Enter triggers agent prompt
      if (agentMode && e.key === "Enter") {
        e.preventDefault();
        options.onAgentPrompt(query);
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredItems.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredItems.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          executeSelected();
          break;
        case "Escape":
          e.preventDefault();
          if (query) {
            setQuery("");
          } else {
            invoke("hide_window");
          }
          break;
        case "Tab":
          e.preventDefault();
          if (categories.length > 0) {
            const currentIdx = activeCategory
              ? categories.indexOf(activeCategory)
              : -1;
            if (e.shiftKey) {
              setActiveCategory(
                currentIdx <= 0 ? null : categories[currentIdx - 1],
              );
            } else {
              setActiveCategory(
                currentIdx >= categories.length - 1
                  ? null
                  : categories[currentIdx + 1],
              );
            }
            setSelectedIndex(0);
          }
          break;
      }
    },
    [
      filteredItems,
      executeSelected,
      query,
      categories,
      activeCategory,
      agentMode,
      options,
    ],
  );

  return {
    query,
    setQuery,
    items: filteredItems,
    selectedIndex,
    setSelectedIndex,
    categories,
    activeCategory,
    setActiveCategory,
    loading,
    handleKeyDown,
    executeSelected,
    agentMode,
    refresh: () => {
      fetchItems(query);
      fetchCategories();
    },
  };
}
