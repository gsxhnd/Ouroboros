use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{File, FileType};
use std::{cell::RefCell, rc::Rc};

#[derive(Debug, Clone)]
pub struct Node {
    name: String,
    children: Vec<Rc<RefCell<Node>>>,
}

#[allow(dead_code)]
impl Node {
    pub fn new(name: String) -> Self {
        Node {
            name,
            children: vec![],
        }
    }

    pub fn add_child(&mut self, child: Rc<RefCell<Node>>) {
        self.children.push(child)
    }

    pub fn post_order_traversal(&self) -> Dirs {
        let mut dirs = Dirs::new();
        for child in &self.children {
            let child_dirs = child.borrow().post_order_traversal();
            dirs.children
                .insert(child.borrow().name.clone(), vec![child_dirs]);
        }
        dirs
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Dirs {
    #[serde(flatten)]
    pub children: HashMap<String, Vec<Dirs>>,
}

#[allow(dead_code)]
impl Dirs {
    pub fn new() -> Self {
        Dirs {
            children: HashMap::new(),
        }
    }
}
