use std::path::PathBuf;

use ouroboros_core::tree::Tree;

#[test]
fn test_walk_dir() {
    let mut tree = Tree::new();
    tree.walk_dir("../testing".to_string());
    println!("{:?}", tree.root)
}

#[test]
fn test_trave_dir() {
    let mut tree = Tree::new();
    tree.walk_dir("../testing/".to_string());

    let dirs = tree.root.unwrap().borrow().post_order_dirs();

    // dirs.traverse(&mut |path, dir| {
    //     println!("Path: {}, Dir: {:?}", path, dir);
    //     let pb = PathBuf::from(path);

    //     PathBuf::from(path)
    //         .iter()
    //         .for_each(|p| println!("iter {:?}", p));
    // })
}
