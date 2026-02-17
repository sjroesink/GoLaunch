import { useRef, useEffect } from "react";

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  loading: boolean;
}

function SearchBar({ query, onQueryChange, loading }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center px-4 py-3 border-b border-launcher-border/30">
      <div className="flex items-center justify-center w-8 h-8 mr-3">
        {loading ? (
          <svg
            className="w-5 h-5 text-launcher-accent animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="opacity-25"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 text-launcher-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search commands, apps, URLs..."
        className="flex-1 bg-transparent text-launcher-text text-lg placeholder-launcher-muted/60 outline-none"
        spellCheck={false}
        autoComplete="off"
      />
      {query && (
        <button
          onClick={() => onQueryChange("")}
          className="ml-2 p-1 rounded text-launcher-muted hover:text-launcher-text hover:bg-launcher-hover transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export default SearchBar;
