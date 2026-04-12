import { Tag } from 'lucide-react';
import React from 'react';

export const FsmStatusBadge: React.FC<{ state?: string }> = ({ state }) => {
  const rawState = state || "Monitoring";

  if (rawState.startsWith("SystemFault:")) {
    const reason = rawState.replace("SystemFault:", "");
    return <Tag color="error">🚨 Lỗi: {reason}</Tag>;
  }

  switch (rawState) {
    case "Monitoring": return <Tag color="success">🟢 Đang Giám Sát</Tag>;
    case "EmergencyStop": return <Tag color="error">🛑 DỪNG KHẨN CẤP</Tag>;
    case "WaterRefilling": return <Tag color="blue">💧 Đang Cấp Nước</Tag>;
    case "WaterDraining": return <Tag color="cyan">🌊 Đang Xả Nước</Tag>;
    case "DosingPumpA": return <Tag color="orange">🧪 Đang Châm Phân A</Tag>;
    case "WaitingBetweenDose": return <Tag color="default">⏳ Chờ Hòa Tan</Tag>;
    case "DosingPumpB": return <Tag color="orange">🧪 Đang Châm Phân B</Tag>;
    case "DosingPH": return <Tag color="purple">⚖️ Đang Chỉnh pH</Tag>;
    case "StartingOsakaPump": return <Tag color="processing">⚙️ Khởi Động Bơm</Tag>;
    case "ActiveMixing": return <Tag color="geekblue">🌪️ Đang Sục Trộn</Tag>;
    case "Stabilizing": return <Tag color="warning">⚖️ Chờ Ổn Định</Tag>;
    default: return <Tag color="default">{rawState}</Tag>;
  }
};
