use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{File, FileType};
use std::{cell::RefCell, rc::Rc};

#[derive(Debug, Clone)]
pub struct Node {
    name: String,
    file_type: FileType,
    children: Vec<Rc<RefCell<Node>>>,
}

#[allow(dead_code)]
impl Node {
    pub fn new(name: String, file_type: FileType) -> Self {
        Node {
            name,
            file_type,
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

    pub fn post_order_dirs(&self) -> Dirs {
        let mut dirs = Dirs::new();
        for child in &self.children {
            let child_dirs = child.borrow().post_order_dirs();
            // println!(
            //     "{}: is dir: {}",
            //     child.borrow().name,
            //     child.borrow().file_type.is_dir()
            // );
            if child.borrow().file_type.is_dir() {
                dirs.children
                    .insert(child.borrow().name.clone(), vec![child_dirs]);
            }
        }
        dirs
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Dirs {
    #[serde(flatten)]
    pub children: HashMap<String, Vec<Dirs>>,
}

impl Dirs {
    pub fn new() -> Self {
        Dirs {
            children: HashMap::new(),
        }
    }

    pub fn traverse<F>(&self, f: &mut F)
    where
        F: FnMut(&str, &Dirs),
    {
        self.traverse_helper("", f);
    }

    fn traverse_helper<F>(&self, path: &str, f: &mut F)
    where
        F: FnMut(&str, &Dirs),
    {
        f(path, self);
        for (key, value) in &self.children {
            for child in value {
                let new_path = if path.is_empty() {
                    key.clone()
                } else {
                    format!("{}/{}", path, key)
                };
                child.traverse_helper(&new_path, f);
            }
        }
    }
}
