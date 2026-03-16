mod commands;
mod http_client;
mod models;
mod notification;
mod valve_guard;
mod water_sequence;
mod ws_client;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 1. Khởi tạo các Plugin cần thiết (Lưu trữ file và Thông báo OS)
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        // 3. Đăng ký TOÀN BỘ các hàm đã expose ở file commands.rs và notification.rs
        .invoke_handler(tauri::generate_handler![
            commands::save_settings,
            commands::load_settings,
            commands::start_ws_listener,
            commands::get_device_config,
            commands::update_device_config,
            commands::get_water_config,
            commands::update_water_config,
            commands::get_safety_config,
            commands::update_safety_config,
            commands::get_sensor_calibration,
            commands::update_sensor_calibration,
            commands::get_dosing_calibration,
            commands::update_dosing_calibration,
            commands::get_esp32_aggregated_config,
            commands::control_pump,
            commands::get_latest_sensor_data,
            commands::get_sensor_history,
            commands::manual_pump,
            // Tiện ích (Thông báo)
            notification::trigger_os_notification,
        ])
        .setup(|app| {
            println!("🚀 Core Backend Rust đã khởi động thành công!");
            // Nếu bạn muốn tự động kết nối WS ngay khi mở app, có thể đọc settings và gọi start_ws_listener tại đây.
            // Nhưng thiết kế hiện tại đang để cho React chủ động gọi lệnh `start_ws_listener` khi component mount.
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Lỗi trong quá trình chạy ứng dụng Tauri!");
}
