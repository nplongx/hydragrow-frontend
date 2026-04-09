package com.hydragrow_frontend

import android.os.Bundle
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : app.tauri.plugin.TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Gọi API Native của Android để lấy FCM Token
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.w("FCM_NATIVE", "Không thể lấy FCM token", task.exception)
                return@addOnCompleteListener
            }

            val token = task.result
            Log.d("FCM_NATIVE", "Đã lấy được Token: $token")

            // 2. Bơm Token này vào React thông qua JavaScript Injection
            Thread {
                Thread.sleep(3000) // Đợi 3 giây cho React render xong giao diện
                runOnUiThread {
                    // Tạo một biến global và phát một Event để React bắt
                    val jsCode = """
                        window.NATIVE_FCM_TOKEN = '$token';
                        window.dispatchEvent(new CustomEvent('on_fcm_token', { detail: '$token' }));
                    """.trimIndent()
                    
                    this.bridge.webView.evaluateJavascript(jsCode, null)
                }
            }.start()
        }
    }
}
