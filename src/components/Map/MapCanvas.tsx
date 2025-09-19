import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapData, RobotPose, GoalPoint } from '../../types/robot';

interface MapCanvasProps {
  mapData: MapData | null;
  robotPose: RobotPose | null;
  goals: GoalPoint[];
  onMapClick?: (worldX: number, worldY: number) => void;
  onGoalClick?: (goalId: string) => void;
  selectedGoalId?: string | null;
  className?: string;
}

export function MapCanvas({ mapData, robotPose, goals, onMapClick, onGoalClick, selectedGoalId, className }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });
  const [showMouseCoords, setShowMouseCoords] = useState(false);
  
  // Zoom and Pan states
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0); // Rotation angle in degrees
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [dragButton, setDragButton] = useState<number | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  // Cập nhật kích thước canvas theo container
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Auto focus on Map (0,0) when mapData loads
  useEffect(() => {
    if (mapData && canvasSize.width > 0 && canvasSize.height > 0) {
      // Calculate Map (0,0) position
      const mapCanvasX = -mapData.origin[0] / mapData.resolution;
      const mapCanvasY = -mapData.origin[1] / mapData.resolution;
      const mapCoord0X = (0 - mapData.origin[0]) / mapData.resolution;
      const mapCoord0Y = (0 - mapData.origin[1]) / mapData.resolution;
      const mapCoord0PixelY = mapData.height - 1 - mapCoord0Y;
      
      // Center on Map (0,0)
      const centerX = mapCanvasX + mapCoord0X;
      const centerY = mapCanvasY + mapCoord0PixelY;
      
      setOffset({
        x: canvasSize.width / 2 - centerX,
        y: canvasSize.height / 2 - centerY
      });
    }
  }, [mapData, canvasSize]);

  // Helper function to convert quaternion to yaw angle (rotation around Z-axis)
  const quaternionToYaw = (q: { x: number; y: number; z: number; w: number }) => {
    // Convert quaternion to yaw angle in radians
    const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
    const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
    return Math.atan2(siny_cosp, cosy_cosp);
  };

  // Draw Goals function
  const drawGoals = useCallback((ctx: CanvasRenderingContext2D, goals: GoalPoint[], mapData: MapData) => {
    goals.forEach((goal) => {
      // Convert world coordinates to pixel coordinates
      const goalPixelX = (goal.x - mapData.origin[0]) / mapData.resolution;
      const goalPixelY = (-goal.y - mapData.origin[1]) / mapData.resolution; // Y-flip

      // Draw goal circle
      const isSelected = selectedGoalId === goal.id;
      const goalSize = isSelected ? 8 / scale : 6 / scale;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(goalPixelX, goalPixelY, goalSize, 0, 2 * Math.PI);
      
      // Goal styling
      if (isSelected) {
        ctx.fillStyle = '#FF6B35'; // Orange for selected
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2 / scale;
      } else {
        ctx.fillStyle = '#10B981'; // Green for normal
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5 / scale;
      }
      
      ctx.fill();
      ctx.stroke();

      // Draw goal name/label
      if (isSelected || scale > 1) {
        ctx.fillStyle = '#374151';
        ctx.font = `${10 / scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(goal.name, goalPixelX, goalPixelY - goalSize - 3 / scale);
      }

      // Draw goal coordinates (when selected or zoomed in)
      if (isSelected) {
        ctx.fillStyle = '#6B7280';
        ctx.font = `${8 / scale}px Arial`;
        ctx.textAlign = 'center';
        const coordText = `(${goal.x.toFixed(2)}, ${goal.y.toFixed(2)})`;
        ctx.fillText(coordText, goalPixelX, goalPixelY + goalSize + 12 / scale);
      }

      ctx.restore();
    });
  }, [selectedGoalId, scale]);

  // Function to draw robot as rectangle with black front
  const drawRobot = useCallback((ctx: CanvasRenderingContext2D, robotPose: RobotPose, mapData: MapData) => {
    // Convert robot world coordinates to map pixel coordinates
    const mapCanvasX = -mapData.origin[0] / mapData.resolution;
    const mapCanvasY = -mapData.origin[1] / mapData.resolution;
    
    // Robot position in map pixels
    const robotMapX = (robotPose.position.x - mapData.origin[0]) / mapData.resolution;
    const robotMapY = (robotPose.position.y - mapData.origin[1]) / mapData.resolution;
    const robotPixelY = mapData.height - 1 - robotMapY; // Flip Y for PGM format
    
    const robotCanvasX = mapCanvasX + robotMapX;
    const robotCanvasY = mapCanvasY + robotPixelY;
    
    // Convert quaternion to yaw angle (fix direction by adding PI)
    const yaw = -quaternionToYaw(robotPose.orientation); // Negate to fix direction
    
    // Robot dimensions
    const robotWidth = 20 / scale;  // Width adjusted for scale
    const robotHeight = 12 / scale; // Height adjusted for scale
    const frontWidth = 4 / scale;   // Front section width
    
    ctx.save();
    ctx.translate(robotCanvasX, robotCanvasY);
    ctx.rotate(yaw);
    
    // Draw robot body (rectangle)
    ctx.fillStyle = '#FF4444'; // Red color for robot body
    ctx.strokeStyle = '#CC0000';
    ctx.lineWidth = 1 / scale;
    
    // Main body rectangle (centered)
    ctx.fillRect(-robotWidth/2, -robotHeight/2, robotWidth, robotHeight);
    ctx.strokeRect(-robotWidth/2, -robotHeight/2, robotWidth, robotHeight);
    
    // Draw black front section
    ctx.fillStyle = '#000000'; // Black color for front
    ctx.fillRect(robotWidth/2 - frontWidth, -robotHeight/2, frontWidth, robotHeight);
    
    // Draw center dot to show exact position
    ctx.fillStyle = '#FFFFFF'; // White dot for center
    ctx.beginPath();
    ctx.arc(0, 0, 2 / scale, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.restore();
    
    // Draw robot position label
    ctx.fillStyle = '#FF0000';
    ctx.font = `${10 / scale}px Arial`;
    // const yawDegrees = (yaw * 180 / Math.PI).toFixed(0);
    // ctx.fillText(
    //   `Robot (${robotPose.position.x.toFixed(2)}, ${robotPose.position.y.toFixed(2)}) θ:${yawDegrees}°`,
    //   robotCanvasX + 25 / scale,
    //   robotCanvasY - 10 / scale
    // );
  }, [scale]);

  // Render map với zoom và pan support
  const renderMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context và apply transform
    ctx.save();
    
    // Tính toán vị trí map dựa trên origin
    const mapCanvasX = -mapData.origin[0] / mapData.resolution;
    const mapCanvasY = -mapData.origin[1] / mapData.resolution;
    
    // Tính toán vị trí Map coordinate (0,0)
    const mapCoord0X = (0 - mapData.origin[0]) / mapData.resolution;
    const mapCoord0Y = (0 - mapData.origin[1]) / mapData.resolution;
    const mapCoord0PixelY = mapData.height - 1 - mapCoord0Y;

    // Apply zoom and pan transforms
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    
    // Rotate around Map (0,0) coordinate
    ctx.translate(mapCanvasX + mapCoord0X, mapCanvasY + mapCoord0PixelY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-(mapCanvasX + mapCoord0X), -(mapCanvasY + mapCoord0PixelY));

    // console.log('📍 Map Rendering with Transform:', {
    //   origin: mapData.origin,
    //   resolution: mapData.resolution,
    //   calculatedPosition: [mapCanvasX.toFixed(1), mapCanvasY.toFixed(1)],
    //   transform: { scale, offset },
    //   explanation: {
    //     mapCanvasX: `${mapData.origin[0]} / ${mapData.resolution} = ${mapCanvasX.toFixed(1)}`,
    //     mapCanvasY: `${mapData.origin[1]} / ${mapData.resolution} = ${mapCanvasY.toFixed(1)}`
    //   }
    // });

    // Tạo ImageData từ raw PGM pixel values (0-255) 
    const imageData = ctx.createImageData(mapData.width, mapData.height);
    
    // Debug: Log first 10 values to see what we're getting
    // console.log('🐛 First 10 PGM pixel values:', mapData.data.slice(0, 10));
    
    // Calculate min/max without spread operator to avoid stack overflow
    let min = 255, max = 0, sum = 0;
    const sampleSize = Math.min(1000, mapData.data.length);
    for (let i = 0; i < sampleSize; i++) {
      const val = mapData.data[i];
      if (val < min) min = val;
      if (val > max) max = val;
      sum += val;
    }
    
    // console.log('🐛 PGM pixel value range (sample):', {
    //   min,
    //   max,
    //   average: Math.round(sum / sampleSize),
    //   sampleSize
    // });
    
    for (let i = 0; i < mapData.data.length; i++) {
      const pgmValue = mapData.data[i]; // Raw PGM value (0-255)
      const pixelIndex = i * 4;
      
      // Render raw PGM values as grayscale
      imageData.data[pixelIndex] = pgmValue;     // R
      imageData.data[pixelIndex + 1] = pgmValue; // G  
      imageData.data[pixelIndex + 2] = pgmValue; // B
      imageData.data[pixelIndex + 3] = 255;      // A (fully opaque)
    }

    // Tạo temporary canvas để vẽ ImageData
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mapData.width;
    tempCanvas.height = mapData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    // Vẽ ImageData lên temp canvas
    tempCtx.putImageData(imageData, 0, 0);

    // Vẽ map từ temp canvas lên main canvas với transform (sẽ zoom được)
    ctx.drawImage(tempCanvas, mapCanvasX, mapCanvasY);

    // Vẽ grid lines
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 0.5 / scale;
    const gridSize = 1 / mapData.resolution; // 1 meter grid
    const gridRange = 50; // Draw grid in ±50 meter range
    
    for (let i = -gridRange; i <= gridRange; i++) {
      const gridPos = i * gridSize;
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(gridPos, -gridRange * gridSize);
      ctx.lineTo(gridPos, gridRange * gridSize);
      ctx.stroke();
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(-gridRange * gridSize, gridPos);
      ctx.lineTo(gridRange * gridSize, gridPos);
      ctx.stroke();
    }


    ctx.fillStyle = '#0080FF'; // Blue color for map coordinate (0,0)
    ctx.beginPath();
    ctx.arc(mapCanvasX + mapCoord0X, mapCanvasY + mapCoord0PixelY, 6 / scale, 0, 2 * Math.PI);
    ctx.fill();
    
    // Map coordinate (0,0) label
    ctx.fillStyle = '#0060CC';
    ctx.font = `${15 / scale}px Arial`;
    ctx.fillText('0,0', mapCanvasX + mapCoord0X + 12 / scale, mapCanvasY + mapCoord0PixelY - 8 / scale);
    
    // Vẽ axes tại Map coordinate (0,0)
    ctx.strokeStyle = '#0080FF';
    ctx.lineWidth = 0.5 / scale;
    // X axis
    ctx.beginPath();
    ctx.moveTo(mapCanvasX + mapCoord0X, mapCanvasY + mapCoord0PixelY);
    ctx.lineTo(mapCanvasX + mapCoord0X + 40 / scale, mapCanvasY + mapCoord0PixelY);
    ctx.stroke();
    // Y axis
    ctx.beginPath();
    ctx.moveTo(mapCanvasX + mapCoord0X, mapCanvasY + mapCoord0PixelY);
    ctx.lineTo(mapCanvasX + mapCoord0X, mapCanvasY + mapCoord0PixelY - 40 / scale);
    ctx.stroke();
    
    // Map axes labels
    ctx.fillStyle = '#0060CC';
    ctx.font = `${10 / scale}px Arial`;
    ctx.fillText('X', mapCanvasX + mapCoord0X + 45 / scale, mapCanvasY + mapCoord0PixelY + 3 / scale);
    ctx.fillText('Y', mapCanvasX + mapCoord0X + 3 / scale, mapCanvasY + mapCoord0PixelY - 45 / scale);

    // Draw robot if available
    if (robotPose) {
      drawRobot(ctx, robotPose, mapData);
    }

    // Draw goals if available
    if (goals && goals.length > 0) {
      drawGoals(ctx, goals, mapData);
    }

    // Restore context
    ctx.restore();

  }, [mapData, canvasSize, scale, offset, rotation, robotPose, goals, drawRobot, drawGoals]);

  // Re-render khi có thay đổi
  useEffect(() => {
    renderMap();
  }, [renderMap]);

  // Handle mouse wheel for zoom (giống solid works)
  const handleWheel = (event: React.WheelEvent) => {
    // event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Zoom factor
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(50, scale * zoomFactor));

    // Zoom to mouse position (giống SolidWorks)
    const scaleRatio = newScale / scale;
    setOffset(prev => ({
      x: mouseX - (mouseX - prev.x) * scaleRatio,
      y: mouseY - (mouseY - prev.y) * scaleRatio
    }));
    
    setScale(newScale);
  };

  // Handle mouse down for panning and rotation
  const handleMouseDown = (event: React.MouseEvent) => {
    const button = event.button;
    
    // Left click for rotation (like RViz)
    if (button === 0) {
      event.preventDefault();
      setIsRotating(true);
      setLastMousePos({ x: event.clientX, y: event.clientY });
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grab';
      }
    }
    // Right click or Middle mouse button for pan
    else if (button === 1 || button === 2) {
      event.preventDefault();
      setIsDragging(true);
      setDragButton(button);
      setLastMousePos({ x: event.clientX, y: event.clientY });
      // Thay đổi cursor thành move
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'move';
      }
    }
  };

  // Handle mouse move for panning and coordinates
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    // Update mouse coordinates
    if (mapData) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;

        // Convert canvas coordinates to world coordinates (with transform)
        const transformedX = (canvasX - offset.x) / scale;
        const transformedY = (canvasY - offset.y) / scale;
        
        // Get map position in transformed coordinate system
        const mapCanvasX = -mapData.origin[0] / mapData.resolution;
        const mapCanvasY = -mapData.origin[1] / mapData.resolution;
        
        // Get pixel coordinates relative to the map image
        const mapPixelX = transformedX - mapCanvasX;
        const mapPixelY = transformedY - mapCanvasY;
        
        // Convert to world coordinates using ROS standard:
        // Bottom-left of PGM (pixel 0, height-1) = origin
        // worldX = origin[0] + (pixelX * resolution)
        // worldY = origin[1] + ((height - 1 - pixelY) * resolution)
        const worldX = mapData.origin[0] + (mapPixelX * mapData.resolution);
        const worldY = mapData.origin[1] + ((mapData.height - 1 - mapPixelY) * mapData.
        resolution);
    
        

        
        setMouseCoords({ x: worldX, y: worldY });
        setShowMouseCoords(true);

        // Change cursor based on what's being hovered over
        if (!isDragging && !isRotating) {
          const canvas = canvasRef.current;
          if (canvas) {
            // Check if hovering over any goal
            let hoveringGoal = false;
            const goalHoverRadius = 12; // pixels
            
            goals.forEach((goal) => {
              const goalPixelX = (goal.x - mapData.origin[0]) / mapData.resolution;
              const goalPixelY = (-goal.y - mapData.origin[1]) / mapData.resolution;
              
              const transformedGoalX = (mapCanvasX + goalPixelX) * scale + offset.x;
              const transformedGoalY = (mapCanvasY + goalPixelY) * scale + offset.y;
              
              const distance = Math.sqrt(
                (event.clientX - rect.left - transformedGoalX) ** 2 + 
                (event.clientY - rect.top - transformedGoalY) ** 2
              );
              
              if (distance <= goalHoverRadius) {
                hoveringGoal = true;
              }
            });

            // Check if hovering over map area (within PGM bounds)
            const withinMapBounds = 
              mapPixelX >= 0 && mapPixelX < mapData.width && 
              mapPixelY >= 0 && mapPixelY < mapData.height;

            // Set appropriate cursor
            if (hoveringGoal) {
              canvas.style.cursor = 'pointer';
            } else if (withinMapBounds) {
              canvas.style.cursor = 'crosshair';
            } else {
              canvas.style.cursor = 'default';
            }
          }
        }
      }
    }

    // Handle rotation
    if (isRotating) {
      const dx = event.clientX - lastMousePos.x;
      setRotation(prev => prev + dx * 0.5); // 0.5 degree per pixel
      setLastMousePos({ x: event.clientX, y: event.clientY });
    }
    // Handle panning
    else if (isDragging && (dragButton === 1 || dragButton === 2)) {
      const dx = event.clientX - lastMousePos.x;
      const dy = event.clientY - lastMousePos.y;
      
      setOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      
      setLastMousePos({ x: event.clientX, y: event.clientY });
    }
  }, [mapData, goals, isDragging, isRotating, offset, scale, lastMousePos, dragButton]);

  // Handle mouse up
  const handleMouseUp = (event: React.MouseEvent) => {
    // Only handle clicks if we weren't dragging
    if (!isDragging && !isRotating && mapData) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Transform screen coordinates to canvas coordinates
      const canvasX = (mouseX - offset.x) / scale;
      const canvasY = (mouseY - offset.y) / scale;

      // First check if we clicked on any goal
      let clickedGoal: GoalPoint | null = null;
      const goalClickRadius = 12; // pixels

      goals.forEach((goal) => {
        const goalPixelX = (goal.x - mapData.origin[0]) / mapData.resolution;
        const goalPixelY = (-goal.y - mapData.origin[1]) / mapData.resolution;
        
        const distance = Math.sqrt((canvasX - goalPixelX) ** 2 + (canvasY - goalPixelY) ** 2);
        if (distance <= goalClickRadius / scale) {
          clickedGoal = goal;
        }
      });

      if (clickedGoal && onGoalClick) {
        // Goal was clicked
        onGoalClick(clickedGoal.id);
        console.log('Goal clicked:', clickedGoal);
      } else if (onMapClick && event.button === 0) {
        // Map was clicked (left button only)
        // Convert canvas coordinates to world coordinates
        const worldX = (canvasX * mapData.resolution) + mapData.origin[0];
        const worldY = -(canvasY * mapData.resolution) - mapData.origin[1]; // Y-flip
        onMapClick(worldX, worldY);
        console.log('Map clicked at world coords:', { worldX, worldY });
      }
    }

    setIsDragging(false);
    setIsRotating(false);
    setDragButton(null);
    // Reset cursor
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'crosshair';
    }
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setShowMouseCoords(false);
    setIsDragging(false);
    setIsRotating(false);
    setDragButton(null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'crosshair';
    }
  };

  // Handle context menu (disable right-click menu)
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  // Reset view function - focus on Map (0,0)
  const resetView = () => {
    if (!mapData) return;
    
    // Calculate Map (0,0) position
    const mapCanvasX = -mapData.origin[0] / mapData.resolution;
    const mapCanvasY = -mapData.origin[1] / mapData.resolution;
    const mapCoord0X = (0 - mapData.origin[0]) / mapData.resolution;
    const mapCoord0Y = (0 - mapData.origin[1]) / mapData.resolution;
    const mapCoord0PixelY = mapData.height - 1 - mapCoord0Y;
    
    // Center on Map (0,0)
    const centerX = mapCanvasX + mapCoord0X;
    const centerY = mapCanvasY + mapCoord0PixelY;
    
    setScale(1);
    setOffset({
      x: canvasSize.width / 2 - centerX,
      y: canvasSize.height / 2 - centerY
    });
    setRotation(0);
  };

  // Fit to screen function - center on Map (0,0)
  const fitToScreen = () => {
    if (!mapData) return;
    
    // Calculate fit scale
    const padding = 50;
    const scaleX = (canvasSize.width - padding * 2) / mapData.width;
    const scaleY = (canvasSize.height - padding * 2) / mapData.height;
    const fitScale = Math.min(scaleX, scaleY);
    
    // Calculate Map (0,0) position
    const mapCanvasX = -mapData.origin[0] / mapData.resolution;
    const mapCanvasY = -mapData.origin[1] / mapData.resolution;
    const mapCoord0X = (0 - mapData.origin[0]) / mapData.resolution;
    const mapCoord0Y = (0 - mapData.origin[1]) / mapData.resolution;
    const mapCoord0PixelY = mapData.height - 1 - mapCoord0Y;
    
    // Center on Map (0,0) with fit scale
    const centerX = (mapCanvasX + mapCoord0X) * fitScale;
    const centerY = (mapCanvasY + mapCoord0PixelY) * fitScale;
    
    setScale(fitScale);
    setOffset({
      x: canvasSize.width / 2 - centerX,
      y: canvasSize.height / 2 - centerY
    });
  };

  return (
    <div ref={containerRef} className="relative bg-gray-100 rounded-lg overflow-hidden w-full h-full">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className={`cursor-crosshair ${className}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      />
      
      {/* Zoom and Pan Controls */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2">

        <button
          onClick={fitToScreen}
          className="bg-white hover:bg-gray-50 border border-gray-300 rounded px-2 py-1 shadow-sm text-xs"
          title="Fit to Screen"
        >
          Fit
        </button>

        <button
          onClick={resetView}
          className="bg-white hover:bg-gray-50 border border-gray-300 rounded px-2 py-1 shadow-sm text-xs"
          title="Reset View"
        >
          Reset
        </button>
        
        <div className="border-t border-gray-300 my-2"></div>
        
        
        <div className="bg-white border border-gray-300 rounded px-2 py-1 shadow-sm text-xs text-center">
          {Math.round(rotation % 360)}°
        </div>
      </div>

      {/* Mouse coordinates display */}
      {showMouseCoords && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-80 text-white px-3 py-2 rounded text-sm">
          <div className="text-green-400 text-xs mb-1">Mouse Position</div>
          <div>X: {mouseCoords.x.toFixed(3)}m</div>
          <div>Y: {mouseCoords.y.toFixed(3)}m</div>
          <div className="text-blue-400 text-xs mt-1">Rotation: {Math.round(rotation % 360)}°</div>
        </div>
      )}
      
      
    </div>
  );
}