use std::fs;
use std::path::Path;

#[allow(dead_code)]
pub async fn init(data_path: String) -> Result<(), String> {
    let p = Path::new(&data_path);
    let op = p.join(".ouroboros");
    let op_th = op.join("thumbnail");

    if op.exists() && op.is_dir() {
        return Ok(());
    }

    match fs::create_dir_all(op_th.clone()) {
        Ok(_) => (),
        Err(e) => println!(" create_dir_all error: {}", e),
    }

    for i in 0..=255 {
        // 将数字转换为两位十六进制字符串
        let hex_str = format!("{:02x}", i);
        let target = op_th.join(hex_str);

        // 创建目录
        match fs::create_dir(target.clone()) {
            Ok(_) => (),
            Err(e) => println!("error: {}", e),
        }

        match fs::create_dir(target.clone()).err() {
            Some(_e) => {}
            None => {}
        }
    }

    Ok(())
}

#[tokio::test]
async fn test_init() {
    use std::env;
    let binding = env::current_dir().unwrap();
    let p = binding.join("..").join("data1");

    let current_path = p.to_str().unwrap();
    println!("current path: {}", current_path);
    // init(String::from(current_path)).await;
}
