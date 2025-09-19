// Service quản lý kết nối WebSocket với ROS bridge
export class ROSWebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private subscribers: Map<string, (data: any) => void> = new Map();
  private connectionCallbacks: (() => void)[] = [];
  private disconnectionCallbacks: (() => void)[] = [];

  constructor(url: string = 'ws://localhost:9090') {
    this.url = url;
  }

  // Kết nối đến ROS bridge
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          console.log('Đã kết nối đến ROS WebSocket bridge');
          this.reconnectAttempts = 0;
          this.connectionCallbacks.forEach(callback => callback());
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.topic && this.subscribers.has(data.topic)) {
              this.subscribers.get(data.topic)!(data.msg);
            }
          } catch (error) {
            console.error('Lỗi parse message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('Mất kết nối ROS WebSocket');
          this.disconnectionCallbacks.forEach(callback => callback());
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('Lỗi WebSocket:', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  // Tự động kết nối lại
  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Thử kết nối lại lần ${this.reconnectAttempts}...`);
      setTimeout(() => {
        this.connect().catch(() => {});
      }, this.reconnectInterval);
    }
  }

  // Subscribe topic ROS
  subscribe(topic: string, messageType: string, callback: (data: any) => void) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket chưa kết nối');
      return;
    }

    this.subscribers.set(topic, callback);
    
    const subscribeMsg = {
      op: 'subscribe',
      topic: topic,
      type: messageType
    };

    this.ws.send(JSON.stringify(subscribeMsg));
    // console.log(`Đã subscribe topic: ${topic}`);
  }

  // Publish message đến ROS topic
  publish(topic: string, messageType: string, message: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket chưa kết nối');
      return;
    }

    const publishMsg = {
      op: 'publish',
      topic: topic,
      msg: message,
      type: messageType
    };

    this.ws.send(JSON.stringify(publishMsg));
  }

  // Advertise topic để publish
  advertise(topic: string, messageType: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket chưa kết nối');
      return;
    }

    const advertiseMsg = {
      op: 'advertise',
      topic: topic,
      type: messageType
    };

    this.ws.send(JSON.stringify(advertiseMsg));
  }

  // Callback khi kết nối thành công
  onConnection(callback: () => void) {
    this.connectionCallbacks.push(callback);
  }

  // Callback khi mất kết nối
  onDisconnection(callback: () => void) {
    this.disconnectionCallbacks.push(callback);
  }

  // Ngắt kết nối
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Kiểm tra trạng thái kết nối
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}