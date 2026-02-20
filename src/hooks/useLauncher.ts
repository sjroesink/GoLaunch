import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LaunchItem, AgentStatus, CommandSuggestion } from "../types";

interface UseLauncherOptions {
  agentStatus: AgentStatus;
  agentAutoFallback: boolean;
  onAgentPrompt: (query: string) => void;
  onAgentCancel: () => void;
  agentTurnActive: boolean;
}

export function useLauncher(options: UseLauncherOptions) {
  const [query, setQueryState] = useState("");
  const [items, setItems] = useState<LaunchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [focusInputSignal, setFocusInputSignal] = useState(0);
  const [savingCommand, setSavingCommand] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const queryBeforeSuggestionSelectRef = useRef<string | null>(null);

  const setQuery = useCallback((nextQuery: string) => {
    queryBeforeSuggestionSelectRef.current = null;
    setSelectedSuggestionIndex(-1);
    setQueryState(nextQuery);
  }, []);

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

  // Fetch suggestions when no results and not in agent mode
  useEffect(() => {
    const shouldSuggest =
      filteredItems.length === 0 &&
      query.length > 2 &&
      !agentMode;

    if (shouldSuggest) {
      invoke<CommandSuggestion[]>("get_command_suggestions", { query })
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    } else {
      setSuggestions([]);
    }
  }, [filteredItems.length, query, agentMode]);

  useEffect(() => {
    if (suggestions.length === 0) {
      setSelectedSuggestionIndex(-1);
      queryBeforeSuggestionSelectRef.current = null;
      return;
    }

    if (selectedSuggestionIndex >= suggestions.length) {
      setSelectedSuggestionIndex(suggestions.length - 1);
    }
  }, [suggestions, selectedSuggestionIndex]);

  const previewSuggestion = useCallback(
    (nextIndex: number) => {
      if (suggestions.length === 0) return;

      const clampedIndex = Math.max(0, Math.min(nextIndex, suggestions.length - 1));

      setSelectedSuggestionIndex(clampedIndex);
      if (queryBeforeSuggestionSelectRef.current === null) {
        queryBeforeSuggestionSelectRef.current = query;
      }
      setQueryState(suggestions[clampedIndex].suggested_command);
    },
    [suggestions, query],
  );

  const restoreQueryFromSuggestionPreview = useCallback(() => {
    setSelectedSuggestionIndex(-1);
    if (queryBeforeSuggestionSelectRef.current !== null) {
      setQueryState(queryBeforeSuggestionSelectRef.current);
    }
    queryBeforeSuggestionSelectRef.current = null;
    setFocusInputSignal((prev) => prev + 1);
  }, []);

  const handleInputFocus = useCallback(() => {
    if (selectedSuggestionIndex >= 0) {
      restoreQueryFromSuggestionPreview();
    }
  }, [selectedSuggestionIndex, restoreQueryFromSuggestionPreview]);

  const selectSuggestion = useCallback(
    (index: number) => {
      previewSuggestion(index);
    },
    [previewSuggestion],
  );

  const saveCommandFromSuggestion = useCallback(
    async (suggestion: CommandSuggestion) => {
      setSavingCommand(true);
      try {
        await invoke("add_item_from_suggestion", {
          title: suggestion.suggested_command,
          actionValue: suggestion.suggested_command,
          actionType: "command",
          category: null,
        });
        await fetchItems(query);
        fetchCategories();
        setSuggestions([]);
      } catch (err) {
        console.error("Failed to save command:", err);
      } finally {
        setSavingCommand(false);
      }
    },
    [query, fetchItems, fetchCategories],
  );

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

      // Ctrl+S saves the top suggestion as a command
      if (
        suggestions.length > 0 &&
        e.key === "s" &&
        (e.ctrlKey || e.metaKey)
      ) {
        e.preventDefault();
        saveCommandFromSuggestion(suggestions[0]);
        return;
      }

      if (suggestions.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();

        if (selectedSuggestionIndex < 0) {
          if (e.key === "ArrowDown") {
            previewSuggestion(0);
          } else {
            previewSuggestion(suggestions.length - 1);
          }
          return;
        }

        if (e.key === "ArrowDown") {
          if (selectedSuggestionIndex >= suggestions.length - 1) {
            restoreQueryFromSuggestionPreview();
          } else {
            previewSuggestion(selectedSuggestionIndex + 1);
          }
        } else if (selectedSuggestionIndex <= 0) {
          restoreQueryFromSuggestionPreview();
        } else {
          previewSuggestion(selectedSuggestionIndex - 1);
        }

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
          if (selectedSuggestionIndex >= 0) {
            restoreQueryFromSuggestionPreview();
            break;
          }
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
      suggestions,
      saveCommandFromSuggestion,
      selectedSuggestionIndex,
      previewSuggestion,
      restoreQueryFromSuggestionPreview,
      setQuery,
    ],
  );

  const refresh = useCallback(() => {
    fetchItems(query);
    fetchCategories();
  }, [fetchItems, fetchCategories, query]);

  const reset = useCallback(() => {
    setQuery("");
    setSelectedIndex(0);
    setActiveCategory(null);
    setSuggestions([]);
    fetchItems("");
    fetchCategories();
  }, [fetchItems, fetchCategories, setQuery]);

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
    suggestions,
    selectedSuggestionIndex,
    selectSuggestion,
    focusInputSignal,
    handleInputFocus,
    savingCommand,
    saveCommandFromSuggestion,
    refresh,
    reset,
  };
}
