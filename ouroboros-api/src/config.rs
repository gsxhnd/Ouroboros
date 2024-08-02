use serde::Deserialize;

#[derive(Deserialize, Clone)]
pub struct Config {
    pub common: Common,
}

#[derive(Deserialize, Clone)]
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
