use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct Config {
    pub common: Common,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            common: Common::default(),
        }
    }
}

impl Config {
    pub async fn rewrite(&self, config_path: &str) {
        let toml_str = toml::to_string(self).unwrap();
        tokio::fs::write(config_path, toml_str).await.unwrap();
    }
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(default)]
pub struct Common {
    pub data_path: String,
    pub server_listen: String,
}

impl Default for Common {
    fn default() -> Self {
        Self {
            data_path: "./data".to_string(),
            server_listen: "0.0.0.0:8080".to_string(),
        }
    }
}
