use notify::{recommended_watcher, Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use tokio::sync::mpsc;
// use tokio::stream::StreamExt;
// use tokio::stre
use tokio_stream::StreamExt;

async fn async_watch(path: PathBuf) -> notify::Result<()> {
    println!("==========path: {:?}", path);
    let (tx, mut rx) = mpsc::channel(100);

    let mut watcher = RecommendedWatcher::new(
        move |res| {
            println!("watch change");
            tx.blocking_send(res).expect("error");
        },
        Config::default(),
    )?;

    // Add a path to be watched. All files and directories at that path and
    // below will be monitored for changes.
    watcher
        .watch(path.as_ref(), RecursiveMode::Recursive)
        .expect("err");

    while let Some(res) = rx.recv().await {
        match res {
            Ok(event) => println!("changed: {:?}", event),
            Err(e) => println!("watch error: {:?}", e),
        }
    }

    Ok(())
}

#[cfg(test)]
#[tokio::test]
async fn test_watch() {
    use std::env;
    let mut path = env::current_dir().unwrap();
    path.push("../");
    path.push("testdata");
    println!("==========path: {:?}", path);
    tokio::spawn(async {
        println!("test");
    });

    async_watch(path).await.unwrap();
}
