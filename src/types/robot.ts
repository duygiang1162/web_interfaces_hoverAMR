// Định nghĩa các kiểu dữ liệu cho robot và map
export interface RobotPose {
  position: {
    x: number;
    y: number;
    z: number;
  };
  orientation: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
}

export interface AMCLPose {
  header: {
    stamp: {
      sec: number;
      nanosec: number;
    };
    frame_id: string;
  };
  pose: {
    pose: {
      position: {
        x: number;
        y: number;
        z: number;
      };
      orientation: {
        x: number;
        y: number;
        z: number;
        w: number;
      };
    };
    covariance: number[];
  };
}

export interface MapData {
  width: number;
  height: number;
  resolution: number;
  origin: [number, number, number];
  data: number[];
  metadata?: {
    image: string;
    resolution: number;
    origin: [number, number, number];
    negate: number;
    occupied_thresh: number;
    free_thresh: number;
  };
}

export interface GoalPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface TwistMessage {
  linear: {
    x: number;
    y: number;
    z: number;
  };
  angular: {
    x: number;
    y: number;
    z: number;
  };
}

export interface ROSMessage {
  op: string;
  topic: string;
  msg?: any;
  type?: string;
}