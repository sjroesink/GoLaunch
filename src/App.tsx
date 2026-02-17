import { useEffect, useRef } from "react";
import { useLauncher } from "./hooks/useLauncher";
import SearchBar from "./components/SearchBar";
import CategoryBar from "./components/CategoryBar";
import ItemList from "./components/ItemList";
import StatusBar from "./components/StatusBar";

function App() {
  const launcher = useLauncher();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

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
      />

      {launcher.categories.length > 0 && (
        <CategoryBar
          categories={launcher.categories}
          activeCategory={launcher.activeCategory}
          onCategoryChange={launcher.setActiveCategory}
        />
      )}

      <ItemList
        items={launcher.items}
        selectedIndex={launcher.selectedIndex}
        onSelect={launcher.setSelectedIndex}
        onExecute={launcher.executeSelected}
      />

      <StatusBar itemCount={launcher.items.length} />
    </div>
  );
}

export default App;
