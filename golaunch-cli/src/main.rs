use clap::{Parser, Subcommand};
use golaunch_core::{Database, NewItem, UpdateItem};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "golaunch-cli")]
#[command(about = "CLI tool for managing GoLaunch launcher items")]
#[command(version)]
struct Cli {
    /// Path to the database file (defaults to ~/.local/share/golaunch/golaunch.db)
    #[arg(long, global = true)]
    db: Option<PathBuf>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Add a new item to the launcher
    Add {
        /// Item title (displayed in the launcher)
        #[arg(long)]
        title: String,

        /// Action type: 'command', 'url', or 'script'
        #[arg(long, default_value = "command")]
        action_type: String,

        /// The command, URL, or script to execute
        #[arg(long)]
        action_value: String,

        /// Subtitle / description
        #[arg(long)]
        subtitle: Option<String>,

        /// Icon (emoji or icon name)
        #[arg(long)]
        icon: Option<String>,

        /// Category for grouping
        #[arg(long)]
        category: Option<String>,

        /// Comma-separated tags
        #[arg(long)]
        tags: Option<String>,
    },

    /// Remove an item by ID
    Remove {
        /// The item ID to remove
        id: String,
    },

    /// List all items
    List {
        /// Filter by category
        #[arg(long)]
        category: Option<String>,

        /// Include disabled items
        #[arg(long)]
        all: bool,

        /// Output as JSON
        #[arg(long)]
        json: bool,
    },

    /// Search items
    Search {
        /// Search query
        query: String,

        /// Output as JSON
        #[arg(long)]
        json: bool,
    },

    /// Update an existing item
    Update {
        /// The item ID to update
        id: String,

        #[arg(long)]
        title: Option<String>,

        #[arg(long)]
        subtitle: Option<String>,

        #[arg(long)]
        icon: Option<String>,

        #[arg(long)]
        action_type: Option<String>,

        #[arg(long)]
        action_value: Option<String>,

        #[arg(long)]
        category: Option<String>,

        #[arg(long)]
        tags: Option<String>,

        /// Enable or disable the item
        #[arg(long)]
        enabled: Option<bool>,
    },

    /// Import items from a JSON file
    Import {
        /// Path to JSON file
        file: PathBuf,
    },

    /// Export all items as JSON
    Export {
        /// Output file path (defaults to stdout)
        #[arg(long)]
        output: Option<PathBuf>,
    },

    /// Show database path
    DbPath,
}

fn get_db(db_path: Option<PathBuf>) -> Result<Database, String> {
    match db_path {
        Some(path) => Database::with_path(&path),
        None => Database::new(),
    }
}

fn main() {
    let cli = Cli::parse();

    if let Err(e) = run(cli) {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}

fn run(cli: Cli) -> Result<(), String> {
    match cli.command {
        Commands::Add {
            title,
            action_type,
            action_value,
            subtitle,
            icon,
            category,
            tags,
        } => {
            let db = get_db(cli.db)?;
            let item = db.add_item(NewItem {
                title,
                subtitle,
                icon,
                action_type,
                action_value,
                category,
                tags,
            })?;
            println!("{}", serde_json::to_string_pretty(&item).unwrap());
            Ok(())
        }

        Commands::Remove { id } => {
            let db = get_db(cli.db)?;
            if db.remove_item(&id)? {
                println!("Item {id} removed successfully");
            } else {
                eprintln!("Item {id} not found");
                std::process::exit(1);
            }
            Ok(())
        }

        Commands::List {
            category,
            all,
            json,
        } => {
            let db = get_db(cli.db)?;
            let items = db.list_items(category.as_deref(), all)?;

            if json {
                println!("{}", serde_json::to_string_pretty(&items).unwrap());
            } else {
                if items.is_empty() {
                    println!("No items found");
                    return Ok(());
                }
                let header = format!(
                    "{:<38} {:<25} {:<10} {:<10} {}",
                    "ID", "TITLE", "TYPE", "CATEGORY", "ACTION"
                );
                println!("{header}");
                println!("{}", "-".repeat(100));
                for item in &items {
                    let action_display = if item.action_value.len() > 30 {
                        format!("{}...", &item.action_value[..27])
                    } else {
                        item.action_value.clone()
                    };
                    println!(
                        "{:<38} {:<25} {:<10} {:<10} {}",
                        item.id, item.title, item.action_type, item.category, action_display
                    );
                }
                println!("\nTotal: {} items", items.len());
            }
            Ok(())
        }

        Commands::Search { query, json } => {
            let db = get_db(cli.db)?;
            let items = db.search_items(&query)?;

            if json {
                println!("{}", serde_json::to_string_pretty(&items).unwrap());
            } else {
                if items.is_empty() {
                    println!("No items matching '{query}'");
                    return Ok(());
                }
                for item in &items {
                    let icon = item.icon.as_deref().unwrap_or("  ");
                    let subtitle = item
                        .subtitle
                        .as_deref()
                        .map(|s| format!(" - {s}"))
                        .unwrap_or_default();
                    println!(
                        "{} {} [{}]{} ({})",
                        icon, item.title, item.action_type, subtitle, item.id
                    );
                }
            }
            Ok(())
        }

        Commands::Update {
            id,
            title,
            subtitle,
            icon,
            action_type,
            action_value,
            category,
            tags,
            enabled,
        } => {
            let db = get_db(cli.db)?;
            let item = db.update_item(
                &id,
                UpdateItem {
                    title,
                    subtitle,
                    icon,
                    action_type,
                    action_value,
                    category,
                    tags,
                    enabled,
                },
            )?;
            println!("{}", serde_json::to_string_pretty(&item).unwrap());
            Ok(())
        }

        Commands::Import { file } => {
            let db = get_db(cli.db)?;
            let content = std::fs::read_to_string(&file)
                .map_err(|e| format!("Failed to read file {}: {e}", file.display()))?;
            let items: Vec<NewItem> =
                serde_json::from_str(&content).map_err(|e| format!("Invalid JSON: {e}"))?;
            let count = items.len();
            let imported = db.import_items(items)?;
            println!("Successfully imported {count} items");
            println!("{}", serde_json::to_string_pretty(&imported).unwrap());
            Ok(())
        }

        Commands::Export { output } => {
            let db = get_db(cli.db)?;
            let items = db.export_items()?;
            let json = serde_json::to_string_pretty(&items).unwrap();

            if let Some(path) = output {
                std::fs::write(&path, &json)
                    .map_err(|e| format!("Failed to write to {}: {e}", path.display()))?;
                println!("Exported {} items to {}", items.len(), path.display());
            } else {
                println!("{json}");
            }
            Ok(())
        }

        Commands::DbPath => {
            match cli.db {
                Some(path) => println!("{}", path.display()),
                None => println!("{}", Database::db_path()?.display()),
            }
            Ok(())
        }
    }
}
