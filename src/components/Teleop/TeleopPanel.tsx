import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VirtualJoystick } from './VirtualJoystick';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Square } from 'lucide-react';

interface TeleopPanelProps {
  onVelocityChange: (linear: number, angular: number) => void;
  maxLinear?: number;
  maxAngular?: number;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  publishRate?: number; // Hz - tần suất publish liên tục
}

export function TeleopPanel({ 
  onVelocityChange, 
  maxLinear = 0.5, 
  maxAngular = 0.5, 
  isVisible = true,
  onToggleVisibility,
  publishRate = 20 // Hz - tần suất publish liên tục
}: TeleopPanelProps) {
  const [useKeyboard, setUseKeyboard] = useState(false);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [currentVelocity, setCurrentVelocity] = useState({ linear: 0, angular: 0 });
  const [isActive, setIsActive] = useState(false); // Trạng thái đang di chuyển
  const publishIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Continuous publishing effect for keyboard mode
  useEffect(() => {
    if (isActive && useKeyboard) {
      publishIntervalRef.current = setInterval(() => {
        onVelocityChange(currentVelocity.linear, currentVelocity.angular);
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
  }, [isActive, useKeyboard, currentVelocity, onVelocityChange, publishRate]);
  
  // Update velocity and start/stop continuous publishing
  const updateVelocity = (linear: number, angular: number) => {
    setCurrentVelocity({ linear, angular });
    setIsActive(linear !== 0 || angular !== 0);
    // Immediate publish for responsive control
    onVelocityChange(linear, angular);
  };
  
  // Stop all movement
  const stopMovement = () => {
    updateVelocity(0, 0);
  };
  
  // Handle keyboard input with continuous publishing
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!useKeyboard || !isVisible) return;
    
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', ' '].includes(key)) {
      event.preventDefault();
      
      if (!pressedKeys.has(key)) {
        setPressedKeys(prev => new Set(prev).add(key));
        
        let linear = 0;
        let angular = 0;
        
        // Calculate velocity based on pressed keys
        const newPressedKeys = new Set(pressedKeys).add(key);
        
        if (newPressedKeys.has('w')) linear += maxLinear;
        if (newPressedKeys.has('s')) linear -= maxLinear;
        if (newPressedKeys.has('a')) angular += maxAngular;
        if (newPressedKeys.has('d')) angular -= maxAngular;
        if (newPressedKeys.has(' ')) {
          linear = 0;
          angular = 0;
        }
        
        updateVelocity(linear, angular);
      }
    }
  }, [useKeyboard, isVisible, maxLinear, maxAngular, pressedKeys]);
  
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!useKeyboard || !isVisible) return;
    
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', ' '].includes(key)) {
      event.preventDefault();
      
      setPressedKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        
        // Calculate new velocity based on remaining pressed keys
        let linear = 0;
        let angular = 0;
        
        if (newSet.has('w')) linear += maxLinear;
        if (newSet.has('s')) linear -= maxLinear;
        if (newSet.has('a')) angular += maxAngular;
        if (newSet.has('d')) angular -= maxAngular;
        
        updateVelocity(linear, angular);
        
        return newSet;
      });
    }
  }, [useKeyboard, isVisible, maxLinear, maxAngular]);
  
  // Setup keyboard event listeners
  useEffect(() => {
    if (useKeyboard && isVisible) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [useKeyboard, isVisible, handleKeyDown, handleKeyUp]);
  
  // Handle mouse button press for continuous movement
  const handleMouseDown = (linear: number, angular: number) => {
    updateVelocity(linear, angular);
  };
  
  const handleMouseUp = () => {
    stopMovement();
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4">
        <button
          onClick={onToggleVisibility}
          className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg"
          title="Hiển thị panel điều khiển"
        >
          <ChevronUp size={24} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-3xl shadow-2xl border border-gray-200 p-6 w-80 min-h-[500px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Remote Control</h3>
        <button
          onClick={onToggleVisibility}
          className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
          title="Ẩn panel"
        >
          <ChevronDown size={20} />
        </button>
      </div>

      {/* Mode selector */}
      <div className="absolute top-16 left-6 right-6">
        <div className="flex bg-gray-100 rounded-full p-1">
          <button
            className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
              !useKeyboard 
                ? 'bg-white text-blue-600 shadow-lg scale-105' 
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
            }`}
            onClick={() => {
              setUseKeyboard(false);
              stopMovement();
            }}
          >
            Joystick
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
              useKeyboard 
                ? 'bg-white text-blue-600 shadow-lg scale-105' 
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
            }`}
            onClick={() => {
              setUseKeyboard(true);
              stopMovement();
            }}
          >
            Bàn phím
          </button>
        </div>
      </div>

      {/* Control interface */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {!useKeyboard ? (
          // Virtual Joystick Mode
          <div className="flex flex-col items-center justify-center">
            <VirtualJoystick
              onMove={updateVelocity}
              maxLinear={maxLinear}
              maxAngular={maxAngular}
              size={180}
              publishRate={publishRate}
            />
          </div>
        ) : (
          // Keyboard Mode - Circular layout with smooth buttons
          <div className="flex flex-col items-center justify-center">
            <p className="text-xs text-gray-600 mb-4 text-center"></p>
            
            {/* Circular button layout */}
            <div className="relative w-52 h-52 mb-4">
              {/* Forward Button */}
              <button
                onMouseDown={() => handleMouseDown(maxLinear, 0)}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-full shadow-lg transition-all duration-200 ${
                  currentVelocity.linear > 0 
                    ? 'bg-blue-500 text-white scale-110 shadow-xl' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700 hover:scale-105'
                }`}
                title="Tiến (W) - Giữ để di chuyển liên tục"
              >
                <ChevronUp size={28} className="mx-auto" />
              </button>
              
              {/* Left Button */}
              <button
                onMouseDown={() => handleMouseDown(0, maxAngular)}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-16 h-16 rounded-full shadow-lg transition-all duration-200 ${
                  currentVelocity.angular > 0 
                    ? 'bg-blue-500 text-white scale-110 shadow-xl' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700 hover:scale-105'
                }`}
                title="Rẽ trái (A) - Giữ để quay liên tục"
              >
                <ChevronLeft size={28} className="mx-auto" />
              </button>
              
              {/* Center Stop Button */}
              <button
                onClick={stopMovement}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg active:scale-95 transition-all duration-200"
                title="Dừng ngay (Space)"
              >
                <Square size={24} className="mx-auto" />
              </button>
              
              {/* Right Button */}
              <button
                onMouseDown={() => handleMouseDown(0, -maxAngular)}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`absolute right-0 top-1/2 transform -translate-y-1/2 w-16 h-16 rounded-full shadow-lg transition-all duration-200 ${
                  currentVelocity.angular < 0 
                    ? 'bg-blue-500 text-white scale-110 shadow-xl' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700 hover:scale-105'
                }`}
                title="Rẽ phải (D) - Giữ để quay liên tục"
              >
                <ChevronRight size={28} className="mx-auto" />
              </button>
              
              {/* Backward Button */}
              <button
                onMouseDown={() => handleMouseDown(-maxLinear, 0)}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-full shadow-lg transition-all duration-200 ${
                  currentVelocity.linear < 0 
                    ? 'bg-blue-500 text-white scale-110 shadow-xl' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700 hover:scale-105'
                }`}
                title="Lùi (S) - Giữ để di chuyển liên tục"
              >
                <ChevronDown size={28} className="mx-auto" />
              </button>
            </div>
            
            {/* Status indicator */}
            {/* <div className="text-xs text-center">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}></div>
                {isActive ? 'Di chuyển' : 'Dừng'}
              </div>
              {isActive && (
                <div className="text-gray-500 mt-1 font-mono text-xs">
                  L: {currentVelocity.linear.toFixed(2)} | A: {currentVelocity.angular.toFixed(2)}
                </div>
              )}
            </div> */}
          </div>
        )}
      </div>

      {/* Emergency stop */}
      <div className="mt-6">
        <button
          onClick={stopMovement}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
        >
          Stop Emergency
        </button>
      </div>
    </div>
  );
}