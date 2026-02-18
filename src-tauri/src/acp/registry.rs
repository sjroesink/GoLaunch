use super::types::RegistryAgent;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct RawRegistryEntry {
    id: Option<String>,
    name: Option<String>,
    version: Option<String>,
    description: Option<String>,
    icon: Option<String>,
    distributions: Option<Vec<RawDistribution>>,
}

#[derive(Debug, Deserialize)]
struct RawDistribution {
    #[serde(rename = "type")]
    dist_type: Option<String>,
    platform: Option<String>,
    url: Option<String>,
    command: Option<String>,
}

pub async fn fetch_registry() -> Result<Vec<RegistryAgent>, String> {
    let url = "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";

    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Failed to fetch registry: {e}"))?;

    let entries: Vec<RawRegistryEntry> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse registry JSON: {e}"))?;

    let current_platform = detect_platform();

    let agents: Vec<RegistryAgent> = entries
        .into_iter()
        .filter_map(|entry| {
            let id = entry.id?;
            let name = entry.name.unwrap_or_else(|| id.clone());
            let version = entry.version.unwrap_or_default();
            let description = entry.description.unwrap_or_default();
            let icon = entry.icon;

            // Find a distribution matching the current platform, or any
            let dist = entry.distributions.as_ref().and_then(|dists| {
                dists
                    .iter()
                    .find(|d| {
                        d.platform
                            .as_deref()
                            .map(|p| p == current_platform || p == "any")
                            .unwrap_or(true)
                    })
                    .or_else(|| dists.first())
            });

            let (distribution_type, distribution_detail) = match dist {
                Some(d) => (
                    d.dist_type.clone().unwrap_or_else(|| "unknown".to_string()),
                    d.command
                        .clone()
                        .or_else(|| d.url.clone())
                        .unwrap_or_default(),
                ),
                None => ("unknown".to_string(), String::new()),
            };

            Some(RegistryAgent {
                id,
                name,
                version,
                description,
                icon,
                distribution_type,
                distribution_detail,
            })
        })
        .collect();

    Ok(agents)
}

fn detect_platform() -> &'static str {
    if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "macos-arm64"
        } else {
            "macos-x64"
        }
    } else if cfg!(target_os = "windows") {
        "windows-x64"
    } else {
        if cfg!(target_arch = "aarch64") {
            "linux-arm64"
        } else {
            "linux-x64"
        }
    }
}
