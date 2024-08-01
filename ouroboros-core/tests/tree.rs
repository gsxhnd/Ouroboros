use ouroboros_core::tree::Tree;

#[test]
fn test_walk_dir() {
    let mut tree = Tree::new();
    tree.walk_dir("../testing".to_string());
    println!("{:?}", tree.root)
}
