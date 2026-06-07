use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Arc;

use muda::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use ourboros::tray::icon;
use ourboros::tray::server::{self, ServerHandle};
use ourboros::web;
use tao::event::{Event, StartCause};
use tao::event_loop::{ControlFlow, EventLoopBuilder};
use tray_icon::TrayIconBuilder;

use super::AppArgs;

pub fn run(args: AppArgs) {
    let web_dir = web::resolve_web_dir(args.web_dir);
    if let Some(path) = &web_dir {
        tracing::info!(web_dir = %path.display(), "Serving web UI");
    } else {
        tracing::info!(
            "No web UI directory found. Place dist files next to the binary or set OURBOROS_WEB_DIR."
        );
    }

    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::{ActivationPolicy, EventLoopExtMacOS};
        let mut event_loop = EventLoopBuilder::new().build();
        event_loop.set_activation_policy(ActivationPolicy::Accessory);
        run_tray(event_loop, web_dir);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let event_loop = EventLoopBuilder::new().build();
        run_tray(event_loop, web_dir);
    }
}

fn run_tray(event_loop: tao::event_loop::EventLoop<()>, web_dir: Option<std::path::PathBuf>) {
    let server_running = Arc::new(AtomicBool::new(false));
    let server_port = Arc::new(AtomicU16::new(8080));

    let menu = Menu::new();
    let open_item = MenuItem::new("Open Interface", true, None);
    let start_item = MenuItem::new("Start Server", true, None);
    let stop_item = MenuItem::new("Stop Server", false, None);
    let quit_item = MenuItem::new("Quit", true, None);

    menu.append(&open_item).unwrap();
    menu.append(&PredefinedMenuItem::separator()).unwrap();
    menu.append(&start_item).unwrap();
    menu.append(&stop_item).unwrap();
    menu.append(&PredefinedMenuItem::separator()).unwrap();
    menu.append(&quit_item).unwrap();

    let tray_icon = TrayIconBuilder::new()
        .with_menu(Box::new(menu))
        .with_tooltip("Ourboros")
        .with_icon(icon::load_icon())
        .build()
        .expect("failed to build tray icon");

    let open_id = open_item.id().clone();
    let start_id = start_item.id().clone();
    let stop_id = stop_item.id().clone();
    let quit_id = quit_item.id().clone();

    let server_handle = Arc::new(std::sync::Mutex::new(None::<ServerHandle>));

    {
        let handle = server::start_server(server_port.clone(), web_dir.clone());
        server_running.store(true, Ordering::SeqCst);
        start_item.set_enabled(false);
        stop_item.set_enabled(true);
        *server_handle.lock().unwrap() = Some(handle);
        let port = server_port.load(Ordering::SeqCst);
        tracing::info!("Server started on port {}", port);
        let url = format!("http://127.0.0.1:{}", port);
        if let Err(e) = open::that(&url) {
            tracing::warn!("Failed to open browser: {}", e);
        }
    }

    let menu_channel = MenuEvent::receiver();

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        if let Event::NewEvents(StartCause::Init) = event {
            let _ = &tray_icon;
        }

        if let Ok(event) = menu_channel.try_recv() {
            if event.id == open_id {
                let port = server_port.load(Ordering::SeqCst);
                let url = format!("http://127.0.0.1:{}", port);
                if let Err(e) = open::that(&url) {
                    tracing::error!("Failed to open browser: {}", e);
                }
            } else if event.id == start_id {
                if !server_running.load(Ordering::SeqCst) {
                    let handle = server::start_server(server_port.clone(), web_dir.clone());
                    server_running.store(true, Ordering::SeqCst);
                    start_item.set_enabled(false);
                    stop_item.set_enabled(true);
                    *server_handle.lock().unwrap() = Some(handle);
                    tracing::info!(
                        "Server started on port {}",
                        server_port.load(Ordering::SeqCst)
                    );
                }
            } else if event.id == stop_id {
                if server_running.load(Ordering::SeqCst) {
                    if let Some(handle) = server_handle.lock().unwrap().take() {
                        server::stop_server(handle);
                    }
                    server_running.store(false, Ordering::SeqCst);
                    start_item.set_enabled(true);
                    stop_item.set_enabled(false);
                    tracing::info!("Server stopped");
                }
            } else if event.id == quit_id {
                if let Some(handle) = server_handle.lock().unwrap().take() {
                    server::stop_server(handle);
                }
                *control_flow = ControlFlow::Exit;
            }
        }
    });
}
