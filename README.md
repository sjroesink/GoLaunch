# GoLaunch

A fast, keyboard-driven launcher inspired by Raycast, built with [Tauri](https://tauri.app/) and React. Items are managed via a CLI, making it ideal for automation by AI agents.

## Architecture

```
GoLaunch/
├── golaunch-core/      # Shared library (SQLite database + models)
├── golaunch-cli/       # CLI for managing launcher items
├── src-tauri/          # Tauri desktop application
├── src/                # React frontend (Raycast-like UI)
└── .github/workflows/  # Release automation
```

## Features

- **Raycast-like UI** — Dark, borderless, always-on-top launcher window
- **Keyboard-first** — Navigate with arrow keys, Enter to execute, Esc to dismiss, Tab for categories
- **Global shortcut** — `Ctrl+Space` to toggle the launcher
- **CLI management** — Add, remove, update, search, import/export items via `golaunch-cli`
- **SQLite database** — Lightweight, file-based storage shared between app and CLI
- **AI-agent friendly** — JSON output, scriptable CLI, import/export for batch operations
- **Cross-platform** — Linux, macOS, and Windows via Tauri

## CLI Usage

```bash
# Add items
golaunch-cli add --title "Google" --action-type url --action-value "https://google.com" --icon "🔍" --category "Web"
golaunch-cli add --title "Terminal" --action-type command --action-value "gnome-terminal" --icon "⚡" --category "Apps"
golaunch-cli add --title "Deploy" --action-type script --action-value "./deploy.sh" --category "DevOps"

# List all items
golaunch-cli list
golaunch-cli list --json
golaunch-cli list --category Web

# Search
golaunch-cli search "google" --json

# Update an item
golaunch-cli update <id> --title "New Title" --icon "🚀"

# Remove an item
golaunch-cli remove <id>

# Import from JSON
golaunch-cli import items.json

# Export all items
golaunch-cli export --output backup.json

# Execute an item by ID
golaunch-cli run <id>

# Show database location
golaunch-cli db-path
```

### Import JSON format

```json
[
  {
    "title": "Google",
    "action_type": "url",
    "action_value": "https://google.com",
    "subtitle": "Search engine",
    "icon": "🔍",
    "category": "Web",
    "tags": "search,web"
  }
]
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Space` | Toggle launcher window |
| `↑` / `↓` | Navigate items |
| `Enter` | Execute selected item |
| `Escape` | Clear search / hide window |
| `Tab` / `Shift+Tab` | Cycle through categories |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://rustup.rs/) >= 1.70
- System dependencies (Linux): `libwebkit2gtk-4.1-dev libgtk-3-dev libappindicator3-dev librsvg2-dev`

### Setup

```bash
npm install
cargo build --workspace
```

### Run in development

```bash
npx tauri dev
```

### Build for production

```bash
npx tauri build
```

### Build CLI only

```bash
cargo build --release --package golaunch-cli
```

## Releases

Releases are automated via GitHub Actions. To create a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This triggers the release workflow which:
1. Creates a draft GitHub Release
2. Builds the Tauri app for Linux, macOS (arm64 + x64), and Windows
3. Builds the CLI for all platforms
4. Attaches all artifacts to the release
5. Publishes the release

## Database

GoLaunch uses SQLite, stored at:
- **Linux**: `~/.local/share/golaunch/golaunch.db`
- **macOS**: `~/Library/Application Support/golaunch/golaunch.db`
- **Windows**: `C:\Users\<user>\AppData\Local\golaunch\golaunch.db`

Both the Tauri app and CLI share the same database file.

## License

MIT
