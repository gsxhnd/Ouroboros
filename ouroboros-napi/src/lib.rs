#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

mod assets;
mod database;
mod file;
mod tree;

#[napi]
#[allow(dead_code)]
fn sum(a: i32, b: i32) -> i32 {
    a + b
}
