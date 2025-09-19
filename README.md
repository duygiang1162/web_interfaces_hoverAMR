# Robot Monitor - Ứng dụng giám sát và điều khiển robot ROS

Một ứng dụng web hiện đại để giám sát và điều khiển robot ROS thông qua giao diện web trực quan.

## ✨ Tính năng chính

### 🗺️ Hiển thị bản đồ
- **Load map từ file ROS**: Hỗ trợ định dạng .pgm và .yaml của ROS map_server
- **Render bản đồ tương tác**: Canvas-based với khả năng zoom, pan mượt mà
- **Hiển thị vị trí robot**: Real-time robot pose trên bản đồ
- **Responsive design**: Tương thích đầy đủ mobile và desktop

### 🎮 Điều khiển Teleop
- **Virtual joystick**: Joystick ảo với feedback trực quan
- **Điều khiển bàn phím**: Arrow keys và WASD controls
- **Panel có thể ẩn/hiện**: Tiết kiệm không gian màn hình
- **Tùy chỉnh tốc độ**: Điều chỉnh linear và angular velocity

### 🎯 Quản lý điểm đích (Goal Points)
- **Click-to-navigate**: Click bất kỳ đâu trên map để tạo goal
- **Lưu trữ follow points**: Quản lý danh sách các điểm đến thường dùng
- **Tên tùy chỉnh**: Đặt tên cho từng goal point
- **Gửi goal đến robot**: Tích hợp với ROS navigation stack

### 🌐 Giao tiếp WebSocket
- **ROS bridge integration**: Kết nối với rosbridge_server
- **Auto-reconnect**: Tự động kết nối lại khi mất kết nối
- **Multi-topic support**: Subscribe/Publish nhiều topic đồng thời
- **Real-time data**: Cập nhật dữ liệu robot theo thời gian thực

## 🚀 Cài đặt và sử dụng

### Yêu cầu hệ thống
- Node.js 18+ 
- ROS system với rosbridge_server
- Modern web browser với WebSocket support

### Cài đặt
```bash
# Clone repository
git clone https://github.com/your-repo/robot-monitor
cd robot-monitor

# Cài đặt dependencies
npm install

# Chạy development server
npm run dev
```

### Cấu hình ROS bridge
```bash
# Cài đặt rosbridge_server (nếu chưa có)
sudo apt-get install ros-noetic-rosbridge-suite

# Chạy rosbridge_server
roslaunch rosbridge_server rosbridge_websocket.launch
```

### Sử dụng

1. **Load bản đồ**:
   - Click nút "Upload Map" 
   - Chọn file .pgm và .yaml của map
   - Bản đồ sẽ hiển thị trên canvas

2. **Kết nối robot**:
   - Đảm bảo rosbridge_server đang chạy
   - Kiểm tra connection status (màu xanh = đã kết nối)
   - Cấu hình WebSocket URL nếu cần (mặc định: ws://localhost:9090)

3. **Điều khiển robot**:
   - Sử dụng virtual joystick hoặc keyboard controls
   - Điều chỉnh tốc độ tối đa trong Settings
   - Sử dụng nút "DỪNG KHẨN CẤP" để dừng ngay lập tức

4. **Đặt goal points**:
   - Click vào bất kỳ vị trí nào trên bản đồ
   - Goal sẽ được lưu tự động
   - Sử dụng tab "Goals" để quản lý và gửi lại các goal đã lưu

## 🛠️ Cấu trúc code

```
src/
├── components/          # React components
│   ├── Map/            # Map rendering và controls
│   ├── Teleop/         # Teleop controls
│   └── Goals/          # Goal management
├── services/           # Business logic services
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## 📡 ROS Topics

### Subscribed Topics
- `/map` - nav_msgs/OccupancyGrid
- `/odom` - nav_msgs/Odometry  
- `/amcl_pose` - geometry_msgs/PoseWithCovarianceStamped

### Published Topics
- `/cmd_vel` - geometry_msgs/Twist
- `/move_base_simple/goal` - geometry_msgs/PoseStamped

## 🎨 Screenshots

### Main Interface
![Main Interface](assets/main-interface.png)

### Virtual Joystick
![Virtual Joystick](assets/joystick.png)

### Goal Management
![Goal Management](assets/goals.png)

## 🔧 Tùy chỉnh

### WebSocket URL
Thay đổi URL của rosbridge server trong Settings tab.

### Velocity Limits
Điều chỉnh tốc độ tối đa cho linear và angular velocity.

### Map Rendering
Tùy chỉnh màu sắc và style rendering trong `MapCanvas.tsx`.

## 🐛 Troubleshooting

### Không kết nối được WebSocket
- Kiểm tra rosbridge_server có đang chạy không
- Verify WebSocket URL đúng
- Check firewall settings

### Map không hiển thị
- Đảm bảo file .pgm và .yaml đúng định dạng
- Check console cho error messages
- Verify file permissions

### Robot không di chuyển
- Check topic `/cmd_vel` có được publish không
- Verify robot node đã subscribe `/cmd_vel`
- Check velocity limits

## 🤝 Đóng góp

Rất hoan nghênh các đóng góp! Vui lòng:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Liên hệ

- **Email**: your-email@example.com
- **GitHub**: [your-username](https://github.com/your-username)

---

Được phát triển với ❤️ cho cộng đồng ROS Việt Nam