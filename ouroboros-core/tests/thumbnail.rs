use image;
#[test]
fn test_make_thumbnail() {
    let image_path = format!("../data/tray.png");
    let thumbnail_path = format!("../data/tray_thumb.png");
    let image_bytes: Vec<u8> = std::fs::read(image_path).unwrap();

    let image = if let Ok(format) = image::guess_format(&image_bytes) {
        println!("{:?}", format);
        image::load_from_memory_with_format(&image_bytes, format).unwrap()
    } else {
        image::load_from_memory(&image_bytes).unwrap()
    };
    let thumbnail = image.thumbnail(12, 12);
    thumbnail.save(thumbnail_path).unwrap();
}
