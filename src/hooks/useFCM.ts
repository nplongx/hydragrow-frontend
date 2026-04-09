import { useEffect } from 'react';
import { messaging } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';
import toast from 'react-hot-toast';

export function useFCM() {
  useEffect(() => {
    const setupFCM = async () => {
      try {
        // 1. Xin quyền hiển thị thông báo
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('✅ Đã được cấp quyền Notification');

          // 2. Lấy FCM Token (Thay VAPID_KEY bằng key trong Firebase Console của bạn)
          const currentToken = await getToken(messaging, {
            vapidKey: 'BDHacUd3ZPRTo5QfnaErWYyXIgxW2sjOR22A9HrIyLzuPrJ62cylLTgaooS3PhscRnZ6jggodBFmd3hJ3izr33I '
          });

          if (currentToken) {
            console.log('📱 FCM Token của máy này:', currentToken);

            // 3. 🟢 GỬI TOKEN LÊN BACKEND RUST CỦA BẠN
            await fetch('https://hydragrow-backend.onrender.com/api/notifications/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fcm_token: currentToken })
            });

          } else {
            console.log('Không lấy được Token, hãy kiểm tra lại cấu hình.');
          }
        }
      } catch (error) {
        console.error('Lỗi khởi tạo FCM:', error);
      }
    };

    setupFCM();

    // 4. Xử lý Notification khi App ĐANG MỞ (Foreground)
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Nhận được thông báo khi đang mở App:', payload);
      toast.error(`${payload.notification?.title}\n${payload.notification?.body}`, {
        duration: 10000,
        style: { background: '#7f1d1d', color: '#fff' }
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);
}
