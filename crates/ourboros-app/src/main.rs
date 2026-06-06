// Prevent console window on Windows
#![windows_subsystem = "windows"]

use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Arc;

use muda::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tao::event::{Event, StartCause};
use tao::event_loop::{ControlFlow, EventLoopBuilder};
use tray_icon::TrayIconBuilder;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

mod icon;
mod server;

fn main() {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // macOS: hide from Dock, only show tray icon
    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::{ActivationPolicy, EventLoopExtMacOS};
        let mut event_loop = EventLoopBuilder::new().build();
        event_loop.set_activation_policy(ActivationPolicy::Accessory);
        run_app(event_loop);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let event_loop = EventLoopBuilder::new().build();
        run_app(event_loop);
    }
}

fn run_app(event_loop: tao::event_loop::EventLoop<()>) {
    let server_running = Arc::new(AtomicBool::new(false));
    let server_port = Arc::new(AtomicU16::new(8080));

    // Build menu
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

    // Load tray icon
    let icon = icon::load_icon();

    let _tray_icon = TrayIconBuilder::new()
        .with_menu(Box::new(menu))
        .with_tooltip("Ourboros")
        .with_icon(icon)
        .build()
        .expect("failed to build tray icon");

    // Store menu item IDs for event matching
    let open_id = open_item.id().clone();
    let start_id = start_item.id().clone();
    let stop_id = stop_item.id().clone();
    let quit_id = quit_item.id().clone();

    // Server management
    let server_handle = Arc::new(std::sync::Mutex::new(None::<server::ServerHandle>));

    // Start server automatically on launch
    {
        let handle = server::start_server(server_port.clone());
        server_running.store(true, Ordering::SeqCst);
        start_item.set_enabled(false);
        stop_item.set_enabled(true);
        *server_handle.lock().unwrap() = Some(handle);
        tracing::info!(
            "Server started on port {}",
            server_port.load(Ordering::SeqCst)
        );
    }

    let menu_channel = MenuEvent::receiver();

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        if let Event::NewEvents(StartCause::Init) = event {
            // Keep tray icon alive
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
                    let handle = server::start_server(server_port.clone());
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
