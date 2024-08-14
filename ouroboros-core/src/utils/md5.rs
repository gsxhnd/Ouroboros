use md5::{Digest, Md5};
use std::fs::File;
use std::io::{self, Read};

pub fn calculate_md5(file_path: &str) -> io::Result<String> {
    let mut file = File::open(file_path)?;
    let mut hash = Md5::new();
    let mut buffer = [0; 1024];

    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }

    let result = hash.finalize();
    Ok(format!("{:x}", result))
}
