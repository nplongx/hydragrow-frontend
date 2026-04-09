// src/hooks/useFCM.ts
import { useEffect } from 'react';

export function useFCM() {
  useEffect(() => {
    // Hàm gửi Token lên Actix Backend
    const sendTokenToBackend = async (token: string) => {
      console.log('📱 Nhận được FCM Token TỪ KOTLIN:', token);
      try {
        await fetch('https://hydragrow-backend.onrender.com/api/notifications/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcm_token: token })
        });
        console.log('✅ Đã đăng ký Token lên Backend thành công!');
      } catch (e) {
        console.error('❌ Lỗi gửi token lên Backend:', e);
      }
    };

    // 1. Bắt trường hợp Kotlin chạy chậm hơn React (Bắt qua Event)
    const handleNativeToken = (e: any) => {
      sendTokenToBackend(e.detail);
    };
    window.addEventListener('on_fcm_token', handleNativeToken);

    // 2. Bắt trường hợp Kotlin chạy nhanh hơn React (Token đã nằm sẵn trong window)
    if ((window as any).NATIVE_FCM_TOKEN) {
      sendTokenToBackend((window as any).NATIVE_FCM_TOKEN);
    }

    // Xin quyền hiển thị thông báo (Android 13+)
    if (Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    return () => {
      window.removeEventListener('on_fcm_token', handleNativeToken);
    };
  }, []);
}
