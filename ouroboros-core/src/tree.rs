use crate::node::Node;

use std::{cell::RefCell, rc::Rc};
use walkdir::WalkDir;

#[derive(Debug, Clone)]
pub struct Tree {
    pub root: Option<Rc<RefCell<Node>>>,
}

impl Tree {
    pub fn new() -> Self {
        Tree { root: None }
    }

    pub fn walk_dir(&mut self, root: String) {
        self.root = Some(Rc::new(RefCell::new(Node::new(root.clone()))));

        let mut stack = vec![(root.clone(), self.root.clone())];

        while let Some((path, node)) = stack.pop() {
            for entry in WalkDir::new(path).min_depth(1).max_depth(1) {
                let entry = entry.unwrap();
                let entry_path = entry.path();
                let entry_name = entry_path
                    .file_name()
                    .unwrap()
                    .to_str()
                    .unwrap()
                    .to_string();

                let child_node = Rc::new(RefCell::new(Node::new(entry_name.clone())));

                if entry_path.is_dir() {
                    stack.push((
                        entry_path.to_str().unwrap().to_string(),
                        Some(child_node.clone()),
                    ));
                }

                node.clone().unwrap().borrow_mut().add_child(child_node);

                println!(
                    "file name: {}, file type: {:?}",
                    entry_name,
                    entry.file_type()
                );
            }
        }
        println!("node: {:?}", self.root)
    }
}
