import React, { useState, useRef, useEffect } from 'react';

interface VirtualJoystickProps {
  onMove: (linear: number, angular: number) => void;
  maxLinear?: number;
  maxAngular?: number;
  size?: number;
  className?: string;
  publishRate?: number; // Hz - tần suất publish liên tục
}

export function VirtualJoystick({ 
  onMove, 
  maxLinear = 0.5, 
  maxAngular = 0.5, 
  size = 150,
  className,
  publishRate = 20 // Hz - tần suất publish liên tục
}: VirtualJoystickProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [knobPosition, setKnobPosition] = useState({ x: 0, y: 0 });
  const [currentVelocity, setCurrentVelocity] = useState({ linear: 0, angular: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const publishIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Continuous publish current velocity when dragging
  useEffect(() => {
    if (isDragging) {
      publishIntervalRef.current = setInterval(() => {
        onMove(currentVelocity.linear, currentVelocity.angular);
      }, 1000 / publishRate);
    } else {
      if (publishIntervalRef.current) {
        clearInterval(publishIntervalRef.current);
        publishIntervalRef.current = null;
      }
    }

    return () => {
      if (publishIntervalRef.current) {
        clearInterval(publishIntervalRef.current);
      }
    };
  }, [isDragging, currentVelocity, onMove, publishRate]);

  // Reset joystick về center
  const resetJoystick = () => {
    setKnobPosition({ x: 0, y: 0 });
    setCurrentVelocity({ linear: 0, angular: 0 });
    onMove(0, 0);
  };

  // Tính toán vị trí knob và gửi command
  const updateJoystick = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Tính khoảng cách từ center
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    
    // Giới hạn trong vùng joystick
    const maxRadius = (size / 2) - 15; // Giảm margin để tăng vùng điều khiển
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    let finalX = deltaX;
    let finalY = deltaY;
    
    if (distance > maxRadius) {
      finalX = (deltaX / distance) * maxRadius;
      finalY = (deltaY / distance) * maxRadius;
    }

    setKnobPosition({ x: finalX, y: finalY });

    // Convert sang linear/angular velocity với độ nhạy cao hơn
    const normalizedY = -finalY / maxRadius; // Y ngược lại (up = forward)
    const normalizedX = -finalX / maxRadius; // X ngược lại (left = positive angular)
    
    const linear = normalizedY * maxLinear;
    const angular = normalizedX * maxAngular;

    // Update current velocity state for continuous publishing
    setCurrentVelocity({ linear, angular });
    
    // Immediate publish for responsive control
    onMove(linear, angular);
  };

  // Mouse events
  const handleMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true);
    updateJoystick(event.clientX, event.clientY);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (isDragging) {
      updateJoystick(event.clientX, event.clientY);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    resetJoystick();
  };

  // Touch events cho mobile
  const handleTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length > 0) {
      setIsDragging(true);
      const touch = event.touches[0];
      updateJoystick(touch.clientX, touch.clientY);
    }
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (isDragging && event.touches.length > 0) {
      event.preventDefault();
      const touch = event.touches[0];
      updateJoystick(touch.clientX, touch.clientY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    resetJoystick();
  };

  // Setup global event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  return (
    <div className={`select-none ${className}`}>
      {/* Joystick container */}
      <div
        ref={containerRef}
        className="relative bg-gray-200 rounded-full border-4 border-gray-300 shadow-inner cursor-pointer"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Crosshairs */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-0.5 bg-gray-400 opacity-50"></div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-full w-0.5 bg-gray-400 opacity-50"></div>
        </div>

        {/* Knob */}
        <div
          className="absolute w-8 h-8 bg-blue-500 rounded-full border-2 border-blue-600 shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-transform"
          style={{
            left: `${50 + (knobPosition.x / (size / 2 - 15)) * 50}%`,
            top: `${50 + (knobPosition.y / (size / 2 - 15)) * 50}%`,
            transform: isDragging ? 'translate(-50%, -50%) scale(1.1)' : 'translate(-50%, -50%)'
          }}
        >
          {/* Inner dot */}
          <div className="absolute inset-2 bg-blue-300 rounded-full"></div>
        </div>
      </div>

      {/* Labels */}
      <div className="mt-2 text-center">
        <div className="text-xs text-gray-600">
          Linear: {((-knobPosition.y / (size / 2 - 15)) * maxLinear).toFixed(2)} m/s
        </div>
        <div className="text-xs text-gray-600">
          Angular: {((-knobPosition.x / (size / 2 - 15)) * maxAngular).toFixed(2)} rad/s
        </div>
      </div>
    </div>
  );
}