use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
enum Node {
    Dir(NodeDir),
    File(String),
}

impl Node {
    #[allow(dead_code)]
    fn new_dir(s: String) -> Self {
        Node::Dir(NodeDir::new(s))
    }
    #[allow(dead_code)]
    fn new_file(s: String) -> Self {
        Node::File(s)
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct NodeDir {
    name: String,
    children: Vec<Node>,
}

impl NodeDir {
    fn new(name: String) -> Self {
        NodeDir {
            name,
            children: vec![],
        }
    }

    #[allow(dead_code)]
    fn add_child(&mut self, child: Node) {
        self.children.push(child)
    }
}

#[derive(Debug)]
#[allow(dead_code)]
struct NodeFile {
    name: String,
}

impl NodeFile {
    #[allow(dead_code)]
    fn new(name: String) -> Self {
        NodeFile { name }
    }
}

#[derive(Debug)]
pub struct Tree {
    #[allow(dead_code)]
    root: NodeDir,
}

impl Tree {
    pub fn new(root: String) -> Self {
        Tree {
            root: NodeDir::new(root),
        }
    }
}

#[cfg(test)]
#[test]
fn test1() {
    let mut root = NodeDir::new("/root".to_string());
    let mut fenix = NodeDir::new("fenix".to_string());

    let mut music = NodeDir::new("music".to_string());
    music.add_child(Node::new_file("music1.mp3".to_string()));

    fenix.add_child(Node::Dir(music));
    fenix.add_child(Node::new_dir("game".to_string()));
    root.add_child(Node::new_file("config".to_string()));
    root.add_child(Node::Dir(fenix));

    match serde_json::to_string_pretty(&root) {
        Ok(v) => {
            println!("{}", v);
        }
        Err(err) => panic!("{}", err),
    }
}
