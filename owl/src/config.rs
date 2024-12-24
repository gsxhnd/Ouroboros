use serde::Deserialize;

#[derive(Deserialize, Clone, Debug)]
pub struct Config {
    pub data_path: String,
    pub server: Server,
    pub log: Log,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            data_path: "data".to_string(),
            server: Server::default(),
            log: Log::default(),
        }
    }
}

#[derive(Deserialize, Clone, Debug)]
pub struct Server {
    pub listen: String,
}

impl Default for Server {
    fn default() -> Self {
        Server {
            listen: "0.0.0.0:8080".to_string(),
        }
    }
}

#[derive(Deserialize, Clone, Debug)]
pub struct Log {
    pub level: String,
    //pub path: String,
}

impl Default for Log {
    fn default() -> Self {
        Log {
            level: "info".to_string(),
            //path: "logs".to_string(),
        }
    }
}
