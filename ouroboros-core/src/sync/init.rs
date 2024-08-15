use std::fs;
use std::io::{Error, ErrorKind};
use std::path::Path;
use tracing;

#[allow(dead_code)]
pub async fn init(data_path: String) -> Result<(), Error> {
    let p = Path::new(&data_path);
    let op = p.join(".ouroboros");
    let op_th = op.join("thumbnail");
    tracing::info!("init");

    if op.exists() && op.is_dir() {
        return Err(Error::from(ErrorKind::AlreadyExists));
    }

    match fs::create_dir_all(op_th.clone()) {
        Ok(_) => (),
        Err(e) => {
            tracing::error!(" create_dir_all error: {}", e);
            return Err(e);
        }
    }

    for i in 0..=255 {
        let hex_str = format!("{:02x}", i);
        let target = op_th.join(hex_str);

        if target.exists() {
            continue;
        }

        match fs::create_dir(target.clone()) {
            Ok(_) => (),
            Err(e) => {
                tracing::error!("create dir error: {}", e);
                return Err(e);
            }
        }
    }

    Ok(())
}

#[tokio::test]
async fn test_init() {
    use std::env;
    let binding = env::current_dir().unwrap();
    let p = binding.join("..").join("data");

    let current_path = p.to_str().unwrap();
    println!("current path: {}", current_path);
    let i = init(String::from(current_path)).await;
    assert_eq!(i.is_ok(), true);
}
