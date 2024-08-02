use ouroboros_core::{node, tree};

fn main() {
    let mut t = tree::Tree::new();
    t.walk_dir("./testing".to_string());

    let d = node::Dirs::new();
    println!("test example,{:?}", d);
    println!("test example")
}
