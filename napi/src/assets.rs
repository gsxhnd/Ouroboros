use walkdir::WalkDir;

use crate::tree;

pub struct AssetsLib {
    tree: tree::Tree,
}

impl AssetsLib {
    pub fn new(path: String) {
        for entry in WalkDir::new(path) {
            let entry = entry.unwrap();

            println!("file_name: {}", entry.path().display());
        }
    }

    pub fn change_root(path: String) {}
}

#[cfg(test)]
#[test]
fn test_lib() {
    use std::env;
    let cp = env::current_dir().unwrap();
    let path = cp.into_os_string().into_string().unwrap();

    let a = AssetsLib::new(path);
}
