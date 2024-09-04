use walkdir::WalkDir;

use crate::tree::{self, Tree};

pub struct AssetsLib {
    tree: tree::Tree,
}

impl AssetsLib {
    pub fn new(path: String) -> Self {
        for entry in WalkDir::new(path) {
            let entry = entry.unwrap();

            println!("file_name: {}", entry.path().display());
        }

        AssetsLib {
            tree: Tree::new("".to_string()),
        }
    }

    pub fn change_root(mut self, path: String) {
        self.tree = Tree::new(path);
    }
}
