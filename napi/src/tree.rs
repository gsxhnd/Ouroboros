#[derive(Debug)]
enum Node {
    Dir(NodeDir),
    File(String),
}

impl Node {
    fn new_dir(s: String) -> Self {
        Node::Dir(NodeDir::new(s))
    }
    fn new_file(s: String) -> Self {
        Node::File(s)
    }
}

#[derive(Debug)]
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

    fn add_child(&mut self, child: Node) {
        self.children.push(child)
    }
}

#[derive(Debug)]
struct NodeFile {
    name: String,
}

impl NodeFile {
    fn new(name: String) -> Self {
        NodeFile { name }
    }
}

#[derive(Debug)]
struct Tree {
    root: NodeDir,
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
    println!("{:?}", root)
}
