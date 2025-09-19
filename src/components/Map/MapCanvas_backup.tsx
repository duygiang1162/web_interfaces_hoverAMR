import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapData, RobotPose, GoalPoint } from '../../types/robot';
import { MapParser } from '../../services/mapParser';

interface MapCanvasProps {
  mapData: MapData | null;
  robotPose: RobotPose | null;
  goals: GoalPoint[];
  onMapClick?: (worldX: number, worldY: number) => void;
  className?: string;
}

export function MapCanvas({ mapData, robotPose, goals, onMapClick, className }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

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

  // Simple origin-aware map loading - no complex zoom
  useEffect(() => {
    if (mapData && canvasSize.width > 0 && canvasSize.height > 0) {
      // Simple fixed scale
      const fixedScale = 5.0;
      
      // Calculate where origin should be on canvas (center of canvas)
      const originCanvasX = canvasSize.width / 2;
      const originCanvasY = canvasSize.height / 2;
      
      // Map origin in world coordinates
      const originWorldX = mapData.origin[0];
      const originWorldY = mapData.origin[1];

      // Convert world origin to pixel coordinates
      const originPixelX = originWorldX / mapData.resolution;
      const originPixelY = -originWorldY / mapData.resolution; // Flip Y
      
      // Calculate offset so origin appears at canvas center
      setScale(fixedScale);
      setOffset({
        x: originCanvasX - originPixelX * fixedScale,
        y: originCanvasY - originPixelY * fixedScale
      });
      
      console.log('🎯 Simple origin view:', {
        origin: mapData.origin,
        originPixel: { x: originPixelX, y: originPixelY },
        canvasCenter: { x: originCanvasX, y: originCanvasY },
        scale: fixedScale,
        offset: {
          x: originCanvasX - originPixelX * fixedScale,
          y: originCanvasY - originPixelY * fixedScale
        }
      });
    }
  }, [mapData?.width, mapData?.height, mapData?.origin?.[0], mapData?.origin?.[1], canvasSize.width, canvasSize.height]);

  // Render grid
  const renderGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!mapData || !showGrid) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1 / scale;

    // Grid spacing trong world coordinates (mét)
    const gridSpacing = 1.0; // 1 mét
    const pixelSpacing = gridSpacing / mapData.resolution;

    // Tính toán vùng hiển thị
    const startX = Math.floor(-offset.x / scale / pixelSpacing) * pixelSpacing;
    const startY = Math.floor(-offset.y / scale / pixelSpacing) * pixelSpacing;
    const endX = startX + (canvasSize.width / scale / pixelSpacing + 2) * pixelSpacing;
    const endY = startY + (canvasSize.height / scale / pixelSpacing + 2) * pixelSpacing;

    // Vẽ grid lines
    ctx.beginPath();
    
    // Vertical lines
    for (let x = startX; x <= endX; x += pixelSpacing) {
      if (x >= 0 && x <= mapData.width) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mapData.height);
      }
    }
    
    // Horizontal lines
    for (let y = startY; y <= endY; y += pixelSpacing) {
      if (y >= 0 && y <= mapData.height) {
        ctx.moveTo(0, y);
        ctx.lineTo(mapData.width, y);
      }
    }
    
    ctx.stroke();
    ctx.restore();
  }, [mapData, showGrid, scale, offset, canvasSize]);

  // Render coordinate axes
  const renderAxes = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!mapData) return;

    ctx.save();
    
    // ROS standard: render axes at world coordinate (0,0) which may not be at origin
    // Find where world coordinate (0,0) appears on the PGM
    const [originPixelX, originPixelY] = MapParser.worldToPixel(0, 0, mapData);
    
    // X axis (red) - points in positive X direction
    ctx.strokeStyle = '#EF4444';
    ctx.fillStyle = '#EF4444';
    ctx.lineWidth = 2 / scale;
    ctx.beginPath();
    ctx.moveTo(originPixelX, originPixelY);
    ctx.lineTo(originPixelX + 50 / scale, originPixelY);
    ctx.stroke();
    
    // X axis arrow
    ctx.beginPath();
    ctx.moveTo(originPixelX + 50 / scale, originPixelY);
    ctx.lineTo(originPixelX + 45 / scale, originPixelY - 5 / scale);
    ctx.lineTo(originPixelX + 45 / scale, originPixelY + 5 / scale);
    ctx.closePath();
    ctx.fill();
    
    // Y axis (green) - points in positive Y direction
    ctx.strokeStyle = '#10B981';
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.moveTo(originPixelX, originPixelY);
    ctx.lineTo(originPixelX, originPixelY - 50 / scale);
    ctx.stroke();
    
    // Y axis arrow
    ctx.beginPath();
    ctx.moveTo(originPixelX, originPixelY - 50 / scale);
    ctx.lineTo(originPixelX - 5 / scale, originPixelY - 45 / scale);
    ctx.lineTo(originPixelX + 5 / scale, originPixelY - 45 / scale);
    ctx.closePath();
    ctx.fill();
    
    // Labels showing this is world coordinate (0,0)
    ctx.fillStyle = '#000';
    ctx.font = `${12 / scale}px Arial`;
    ctx.fillText('X', originPixelX + 55 / scale, originPixelY + 5 / scale);
    ctx.fillText('Y', originPixelX + 5 / scale, originPixelY - 55 / scale);
    ctx.fillText('(0.00, 0.00)', originPixelX + 10 / scale, originPixelY + 20 / scale);
    
    ctx.restore();
  }, [mapData, scale]);

  // Render map lên canvas
  const renderMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context
    ctx.save();

    // Apply transforms
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Render grid first (behind map)
    renderGrid(ctx);

    // ROS standard: origin defines where bottom-left corner of PGM is placed in world coordinates
    // Convert origin world coordinates to pixel coordinates for canvas positioning
    const originWorldX = mapData.origin[0];  // e.g. -1.83
    const originWorldY = mapData.origin[1];  // e.g. -1.77
    
    // In ROS coordinate system, origin is the bottom-left corner of the PGM
    // But PGM is stored with (0,0) at top-left, so we need to account for this
    // The PGM should be positioned so that its bottom-left maps to the origin
    const mapPixelOffsetX = originWorldX / mapData.resolution;
    const mapPixelOffsetY = (originWorldY / mapData.resolution) - mapData.height;

    // Create ImageData cho map
    const imageData = ctx.createImageData(mapData.width, mapData.height);
    
    // Fill pixel data
    for (let i = 0; i < mapData.data.length; i++) {
      const value = mapData.data[i];
      const pixelIndex = i * 4;
      
      if (value === -1) {
        // Unknown - màu xám
        imageData.data[pixelIndex] = 128;
        imageData.data[pixelIndex + 1] = 128;
        imageData.data[pixelIndex + 2] = 128;
        imageData.data[pixelIndex + 3] = 180; // Semi-transparent
      } else if (value === 0) {
        // Free space - màu trắng
        imageData.data[pixelIndex] = 255;
        imageData.data[pixelIndex + 1] = 255;
        imageData.data[pixelIndex + 2] = 255;
        imageData.data[pixelIndex + 3] = 200; // Semi-transparent
      } else {
        // Occupied - màu đen
        imageData.data[pixelIndex] = 0;
        imageData.data[pixelIndex + 1] = 0;
        imageData.data[pixelIndex + 2] = 0;
        imageData.data[pixelIndex + 3] = 255; // Opaque
      }
    }

    // Render map at correct world position
    // Instead of putImageData(imageData, 0, 0), position it according to world coordinates
    ctx.putImageData(imageData, mapPixelOffsetX, mapPixelOffsetY);
    
    // 📍 DETAILED PGM COORDINATE LOGGING (ROS Standard Format)
    const mapWorldWidth = mapData.width * mapData.resolution;
    const mapWorldHeight = mapData.height * mapData.resolution;
    
    console.log('🗺️ Map Coverage Analysis (ROS Standard):', {
      // YAML configuration
      yamlOrigin: [originWorldX, originWorldY], // Bottom-left corner position
      resolution: mapData.resolution, // meters per pixel
      
      // Map dimensions
      pgmSize: { width: mapData.width, height: mapData.height }, // pixels
      worldSize: { width: mapWorldWidth, height: mapWorldHeight }, // meters
      
      // Map coverage in world coordinates (the area this map covers)
      mapCoverage: {
        xRange: [originWorldX, originWorldX + mapWorldWidth], // [start, end] on X axis
        yRange: [originWorldY, originWorldY + mapWorldHeight], // [start, end] on Y axis
        totalArea: `${mapWorldWidth.toFixed(1)}m × ${mapWorldHeight.toFixed(1)}m`
      },
      
      // Where PGM is positioned on canvas for rendering
      pgmCanvasPosition: [mapPixelOffsetX, mapPixelOffsetY],
      
      // Corner coordinates (for reference)
      cornerCoordinates: {
        bottomLeft: [originWorldX, originWorldY], // YAML origin
        bottomRight: [originWorldX + mapWorldWidth, originWorldY],
        topLeft: [originWorldX, originWorldY + mapWorldHeight],
        topRight: [originWorldX + mapWorldWidth, originWorldY + mapWorldHeight]
      },
      
      // Summary
      summary: `Map covers X:[${originWorldX.toFixed(1)}, ${(originWorldX + mapWorldWidth).toFixed(1)}] Y:[${originWorldY.toFixed(1)}, ${(originWorldY + mapWorldHeight).toFixed(1)}] in ROS coordinates`
    });

    // Render coordinate axes
    renderAxes(ctx);

    // Render robot pose
    if (robotPose) {
      const [px, py] = MapParser.worldToPixel(
        robotPose.position.x,
        robotPose.position.y,
        mapData
      );

      // Robot body
      ctx.fillStyle = '#3B82F6';
      ctx.strokeStyle = '#1D4ED8';
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      ctx.arc(px, py, 8 / scale, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Robot orientation arrow
      const angle = 2 * Math.atan2(robotPose.orientation.z, robotPose.orientation.w);
      ctx.strokeStyle = '#1D4ED8';
      ctx.lineWidth = 3 / scale;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(angle) * 20 / scale, py + Math.sin(angle) * 20 / scale);
      ctx.stroke();

      // Robot direction indicator
      ctx.fillStyle = '#1D4ED8';
      ctx.beginPath();
      const arrowX = px + Math.cos(angle) * 20 / scale;
      const arrowY = py + Math.sin(angle) * 20 / scale;
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - Math.cos(angle - 0.5) * 8 / scale, arrowY - Math.sin(angle - 0.5) * 8 / scale);
      ctx.lineTo(arrowX - Math.cos(angle + 0.5) * 8 / scale, arrowY - Math.sin(angle + 0.5) * 8 / scale);
      ctx.closePath();
      ctx.fill();
    }

    // Render goal points
    goals.forEach((goal, index) => {
      const [px, py] = MapParser.worldToPixel(goal.x, goal.y, mapData);

      // Goal marker
      ctx.fillStyle = '#EF4444';
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      ctx.arc(px, py, 8 / scale, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Goal cross
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      ctx.moveTo(px - 5 / scale, py);
      ctx.lineTo(px + 5 / scale, py);
      ctx.moveTo(px, py - 5 / scale);
      ctx.lineTo(px, py + 5 / scale);
      ctx.stroke();

      // Label với background
      const labelText = goal.name || `Goal ${index + 1}`;
      ctx.font = `${12 / scale}px Arial`;
      const textMetrics = ctx.measureText(labelText);
      const textWidth = textMetrics.width;
      const textHeight = 12 / scale;
      
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(px + 12 / scale, py - textHeight, textWidth + 4 / scale, textHeight + 4 / scale);
      
      // Text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(labelText, px + 14 / scale, py - 2 / scale);
    });

    ctx.restore();
  }, [mapData, robotPose, goals, scale, offset, renderGrid, renderAxes]);

  // Re-render khi có thay đổi
  useEffect(() => {
    renderMap();
  }, [renderMap]);

  // Handle wheel zoom
  const handleWheel = (event: React.WheelEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, scale * delta));

    // Zoom về điểm chuột
    const scaleRatio = newScale / scale;
    setOffset(prev => ({
      x: mouseX - (mouseX - prev.x) * scaleRatio,
      y: mouseY - (mouseY - prev.y) * scaleRatio
    }));
    
    setScale(newScale);
  };

  // Handle mouse events cho pan
  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button === 0) { // Left click
      setIsDragging(true);
      setLastMousePos({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (isDragging) {
      const dx = event.clientX - lastMousePos.x;
      const dy = event.clientY - lastMousePos.y;
      
      setOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      
      setLastMousePos({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle click để đặt goal - FIX: Tính toán chính xác tọa độ
  const handleCanvasClick = (event: React.MouseEvent) => {
    if (!mapData || !onMapClick || isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    // Convert canvas coordinates to map pixel coordinates
    // Áp dụng inverse transform
    const mapPixelX = (canvasX - offset.x) / scale;
    const mapPixelY = (canvasY - offset.y) / scale;

    // Kiểm tra xem click có trong bounds của map không
    if (mapPixelX < 0 || mapPixelX >= mapData.width || mapPixelY < 0 || mapPixelY >= mapData.height) {
      return;
    }

    // Convert to world coordinates
    const [worldX, worldY] = MapParser.pixelToWorld(mapPixelX, mapPixelY, mapData);

    console.log('Click position:', {
      canvas: { x: canvasX, y: canvasY },
      mapPixel: { x: mapPixelX, y: mapPixelY },
      world: { x: worldX, y: worldY },
      scale,
      offset
    });

    onMapClick(worldX, worldY);
  };

  // Reset view về center của map với origin coordinates
  // Simple reset view function
  const resetView = () => {
    if (mapData && canvasSize.width > 0 && canvasSize.height > 0) {
      // Simple fixed scale
      const fixedScale = 5.0;
      
      // Calculate where origin should be on canvas (center of canvas)
      const originCanvasX = canvasSize.width / 2;
      const originCanvasY = canvasSize.height / 2;
      
      // Map origin in world coordinates
      const originWorldX = mapData.origin[0];
      const originWorldY = mapData.origin[1];
      
      // Convert world origin to pixel coordinates
      const originPixelX = originWorldX / mapData.resolution;
      const originPixelY = -originWorldY / mapData.resolution; // Flip Y
      
      // Calculate offset so origin appears at canvas center
      setScale(fixedScale);
      setOffset({
        x: originCanvasX - originPixelX * fixedScale,
        y: originCanvasY - originPixelY * fixedScale
      });
      
      console.log('🔄 Reset to simple origin view:', {
        origin: mapData.origin,
        scale: fixedScale
      });
    }
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
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      />
      
      {/* Map controls */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2">
        <button
          onClick={() => setScale(prev => Math.min(10, prev * 1.2))}
          className="bg-white hover:bg-gray-50 border border-gray-300 rounded p-2 shadow-sm"
          title="Zoom in"
        >
          <span className="text-lg font-bold">+</span>
        </button>
        
        <button
          onClick={() => setScale(prev => Math.max(0.1, prev / 1.2))}
          className="bg-white hover:bg-gray-50 border border-gray-300 rounded p-2 shadow-sm"
          title="Zoom out"
        >
          <span className="text-lg font-bold">-</span>
        </button>
        
        <button
          onClick={resetView}
          className="bg-white hover:bg-gray-50 border border-gray-300 rounded px-2 py-1 shadow-sm text-xs"
          title="Reset view"
        >
          Fit
        </button>

        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`border border-gray-300 rounded px-2 py-1 shadow-sm text-xs ${
            showGrid 
              ? 'bg-blue-500 text-white hover:bg-blue-600' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
          title="Toggle grid"
        >
          Grid
        </button>
      </div>

      {/* Info panel */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded text-sm space-y-1">
        <div>Scale: {scale.toFixed(2)}x</div>
        {mapData && (
          <>
            <div>Resolution: {mapData.resolution}m/px</div>
            <div>Size: {mapData.width}×{mapData.height}</div>
          </>
        )}
      </div>

      {/* Coordinate display */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded text-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="w-3 h-0.5 bg-red-500 mr-1"></div>
            <span>X</span>
          </div>
          <div className="flex items-center">
            <div className="w-0.5 h-3 bg-green-500 mr-1"></div>
            <span>Y</span>
          </div>
        </div>
      </div>
    </div>
  );
}