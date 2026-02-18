use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub icon: Option<String>,
    pub action_type: String,
    pub action_value: String,
    pub category: String,
    pub tags: String,
    pub frequency: i64,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewItem {
    pub title: String,
    pub subtitle: Option<String>,
    pub icon: Option<String>,
    pub action_type: String,
    pub action_value: String,
    pub category: Option<String>,
    pub tags: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateItem {
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub icon: Option<String>,
    pub action_type: Option<String>,
    pub action_value: Option<String>,
    pub category: Option<String>,
    pub tags: Option<String>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
}
