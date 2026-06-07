use tray_icon::Icon;

/// Load a simple programmatic icon for the tray.
/// In production, replace this with an actual icon file.
pub fn load_icon() -> Icon {
    let width = 32u32;
    let height = 32u32;
    let mut rgba = vec![0u8; (width * height * 4) as usize];

    // Draw a simple filled circle (teal color)
    let cx = width as f32 / 2.0;
    let cy = height as f32 / 2.0;
    let radius = 14.0f32;

    for y in 0..height {
        for x in 0..width {
            let dx = x as f32 - cx;
            let dy = y as f32 - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            let idx = ((y * width + x) * 4) as usize;

            if dist <= radius {
                // Teal color: #2dd4bf
                rgba[idx] = 45;      // R
                rgba[idx + 1] = 212; // G
                rgba[idx + 2] = 191; // B
                rgba[idx + 3] = 255; // A
            }
        }
    }

    Icon::from_rgba(rgba, width, height).expect("failed to create icon")
}
