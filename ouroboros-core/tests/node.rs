use ouroboros_core::node::{Dirs, Node};
use std::{cell::RefCell, rc::Rc};

#[test]
fn test_dirs() {
    let mut dirs = Dirs::new();
    let a: Vec<Dirs> = Vec::new();
    dirs.children.insert("b".to_string(), a);
    let b = serde_json::to_string(&dirs).unwrap();
    println!("{}", b)
}

#[test]
fn test_post_order() {
    let root = Rc::new(RefCell::new(Node::new("Root".to_string())));
    let child1 = Rc::new(RefCell::new(Node::new("Child1".to_string())));
    let child2 = Rc::new(RefCell::new(Node::new("Child2".to_string())));

    root.borrow_mut().add_child(child1.clone());
    root.borrow_mut().add_child(child2.clone());

    child1
        .borrow_mut()
        .add_child(Rc::new(RefCell::new(Node::new("Grandchild11".to_string()))));
    child1
        .borrow_mut()
        .add_child(Rc::new(RefCell::new(Node::new("Grandchild12".to_string()))));
    child1
        .borrow_mut()
        .add_child(Rc::new(RefCell::new(Node::new("Grandchild13".to_string()))));

    let dirs = root.borrow().post_order_traversal();
    let json = serde_json::to_string(&dirs).unwrap();
    println!("{}", json);
}
