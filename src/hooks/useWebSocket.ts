import { useState, useEffect, useRef } from 'react';
import { ROSWebSocketService } from '../services/websocket';
import { RobotPose, AMCLPose, TwistMessage } from '../types/robot';

// Hook quản lý kết nối WebSocket với ROS
export function useWebSocket(wsUrl: string = 'ws://localhost:9090') {
  const [connected, setConnected] = useState(false);
  const [robotPose, setRobotPose] = useState<RobotPose | null>(null);
  const serviceRef = useRef<ROSWebSocketService | null>(null);

  useEffect(() => {
    // Khởi tạo service
    serviceRef.current = new ROSWebSocketService(wsUrl);
    
    // Setup callbacks
    serviceRef.current.onConnection(() => {
      setConnected(true);
      console.log('WebSocket connected to ROS bridge');
      
      // Subscribe to AMCL pose (preferred for localized robot)
      serviceRef.current?.subscribe('/amcl_pose', 'geometry_msgs/PoseWithCovarianceStamped', (data: AMCLPose) => {
        setRobotPose(data.pose.pose);
      });

      // Subscribe to odometry as fallback
      serviceRef.current?.subscribe('/odom', 'nav_msgs/Odometry', (data) => {
        // Use odom for pose data
        setRobotPose(data.pose.pose);
      });

      // Advertise topics để publish
      serviceRef.current?.advertise('/cmd_vel', 'geometry_msgs/Twist');
      serviceRef.current?.advertise('/move_base_simple/goal', 'geometry_msgs/PoseStamped');
    });

    serviceRef.current.onDisconnection(() => {
      setConnected(false);
      console.log('WebSocket disconnected from ROS bridge');
    });

    // Kết nối
    serviceRef.current.connect().catch(error => {
      console.error('Không thể kết nối WebSocket:', error);
    });

    // Cleanup
    return () => {
      serviceRef.current?.disconnect();
    };
  }, [wsUrl]);

  // Gửi lệnh điều khiển velocity
  const sendVelocityCommand = (linear: number, angular: number) => {
    if (!serviceRef.current?.isConnected()) {
      console.warn('WebSocket not connected, cannot send velocity command');
      return;
    }

    const twist: TwistMessage = {
      linear: { x: linear, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: angular }
    };

    serviceRef.current.publish('/cmd_vel', 'geometry_msgs/Twist', twist);
    // console.log(`Sent velocity command: linear=${linear.toFixed(2)}, angular=${angular.toFixed(2)}`);
  };

  // Gửi goal đến navigation stack
  const sendGoal = (x: number, y: number, theta: number = 0) => {
    if (!serviceRef.current?.isConnected()) return;

    const goal = {
      header: {
        stamp: { sec: Math.floor(Date.now() / 1000), nanosec: 0 },
        frame_id: 'map'
      },
      pose: {
        position: { x, y, z: 0 },
        orientation: {
          x: 0,
          y: 0,
          z: Math.sin(theta / 2),
          w: Math.cos(theta / 2)
        }
      }
    };

    serviceRef.current.publish('/move_base_simple/goal', 'geometry_msgs/PoseStamped', goal);
  };

  // Subscribe topic tùy chỉnh
  const subscribeToTopic = (topic: string, messageType: string, callback: (data: any) => void) => {
    serviceRef.current?.subscribe(topic, messageType, callback);
  };

  return {
    connected,
    robotPose,
    sendVelocityCommand,
    sendGoal,
    subscribeToTopic,
    service: serviceRef.current
  };
}