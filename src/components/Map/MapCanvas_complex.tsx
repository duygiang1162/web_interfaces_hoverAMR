import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapData, RobotPose, GoalPoint } from '../../types/robot';

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
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });
  const [showMouseCoords, setShowMouseCoords] = useState(false);

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

  // ROS standard map rendering - preserve pixel accuracy with resolution scaling
  useEffect(() => {
    if (mapData && canvasSize.width > 0 && canvasSize.height > 0) {
      // Calculate appropriate scale to fit map on canvas while preserving pixel accuracy
      const canvasScale = Math.min(
        (canvasSize.width * 0.8) / mapData.width,   // 80% of canvas width
        (canvasSize.height * 0.8) / mapData.height  // 80% of canvas height
      );
      
      // Position world coordinate (0,0) at canvas center
      const worldOriginCanvasX = canvasSize.width / 2;
      const worldOriginCanvasY = canvasSize.height / 2;
      
      // Map origin from YAML (bottom-left corner coordinates)
      const x0 = mapData.origin[0];  // x₀ = -1.83
      const y0 = mapData.origin[1];  // y₀ = -1.77
      const resolution = mapData.resolution; // 0.05 meters per pixel
      
      // Calculate where to place the map image so that:
      // - Pixel (0, height-1) corresponds to world (x₀, y₀)
      // - World (0, 0) appears at canvas center
      
      // First, find where world (0,0) should be in map pixel coordinates
      const worldOriginInMapPixelX = (0 - x0) / resolution;  // (0 - (-1.83)) / 0.05 = 36.6
      const worldOriginInMapPixelY = (0 - y0) / resolution;  // (0 - (-1.77)) / 0.05 = 35.4
      
      // Now calculate canvas offset so that this pixel point appears at canvas center
      // But remember: map image will be drawn starting at (0,0), so we need to account for that
      setScale(canvasScale);
      setOffset({
        x: worldOriginCanvasX - (worldOriginInMapPixelX * canvasScale),
        y: worldOriginCanvasY - ((mapData.height - worldOriginInMapPixelY) * canvasScale)
      });
      
      console.log('🗺️ Fixed Map Positioning:', {
        mapOrigin: [x0, y0],
        worldOriginInMapPixels: [worldOriginInMapPixelX.toFixed(1), worldOriginInMapPixelY.toFixed(1)],
        canvasCenter: [worldOriginCanvasX, worldOriginCanvasY],
        calculatedOffset: {
          x: worldOriginCanvasX - (worldOriginInMapPixelX * canvasScale),
          y: worldOriginCanvasY - ((mapData.height - worldOriginInMapPixelY) * canvasScale)
        },
        scale: canvasScale
      });
    }
  }, [mapData?.width, mapData?.height, mapData?.origin?.[0], mapData?.origin?.[1], mapData?.resolution, canvasSize.width, canvasSize.height]);

  // Render grid with ROS coordinates
  const renderGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!mapData || !showGrid) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1 / scale;

    // Grid spacing in world coordinates (meters)
    const gridSpacing = 1.0; // 1 meter
    const pixelSpacing = gridSpacing / mapData.resolution;

    // Calculate visible area
    const startX = Math.floor(-offset.x / scale / pixelSpacing) * pixelSpacing;
    const startY = Math.floor(-offset.y / scale / pixelSpacing) * pixelSpacing;
    const endX = startX + (canvasSize.width / scale / pixelSpacing + 2) * pixelSpacing;
    const endY = startY + (canvasSize.height / scale / pixelSpacing + 2) * pixelSpacing;

    // Draw grid lines
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

  // Render coordinate axes at world origin (0,0)
  const renderAxes = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!mapData) return;

    ctx.save();
    
    // Render axes at world coordinate (0,0) - our reference point
    const worldOriginX = 0;
    const worldOriginY = 0;
    
    // Convert world (0,0) to pixel coordinates using ROS formula
    const originPixelI = (worldOriginX - mapData.origin[0]) / mapData.resolution;
    const originPixelJ = mapData.height - (worldOriginY - mapData.origin[1]) / mapData.resolution;
    
    // X axis (red) - points in positive X direction
    ctx.strokeStyle = '#EF4444';
    ctx.fillStyle = '#EF4444';
    ctx.lineWidth = 2 / scale;
    ctx.beginPath();
    ctx.moveTo(originPixelI, originPixelJ);
    ctx.lineTo(originPixelI + 50 / scale, originPixelJ);
    ctx.stroke();
    
    // X axis arrow
    ctx.beginPath();
    ctx.moveTo(originPixelI + 50 / scale, originPixelJ);
    ctx.lineTo(originPixelI + 45 / scale, originPixelJ - 5 / scale);
    ctx.lineTo(originPixelI + 45 / scale, originPixelJ + 5 / scale);
    ctx.closePath();
    ctx.fill();
    
    // Y axis (green) - points in positive Y direction
    ctx.strokeStyle = '#10B981';
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.moveTo(originPixelI, originPixelJ);
    ctx.lineTo(originPixelI, originPixelJ - 50 / scale);
    ctx.stroke();
    
    // Y axis arrow
    ctx.beginPath();
    ctx.moveTo(originPixelI, originPixelJ - 50 / scale);
    ctx.lineTo(originPixelI - 5 / scale, originPixelJ - 45 / scale);
    ctx.lineTo(originPixelI + 5 / scale, originPixelJ - 45 / scale);
    ctx.closePath();
    ctx.fill();
    
    // Labels showing world coordinate origin (0,0)
    ctx.fillStyle = '#000';
    ctx.font = `${12 / scale}px Arial`;
    ctx.fillText('X', originPixelI + 55 / scale, originPixelJ + 5 / scale);
    ctx.fillText('Y', originPixelI + 5 / scale, originPixelJ - 55 / scale);
    ctx.fillText('World (0.00, 0.00)', originPixelI + 10 / scale, originPixelJ + 20 / scale);
    
    ctx.restore();
  }, [mapData, scale]);

  // Render map với pixel accuracy và ROS coordinate system
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

    // ROS Standard: Preserve original pixel data and position correctly
    // Create ImageData from original PGM pixels (keep pixel accuracy)
    const imageData = ctx.createImageData(mapData.width, mapData.height);
    
    // Fill pixel data directly from PGM (preserve original pixel structure)
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

    // Render PGM image at pixel position (0,0) - preserve original pixel structure
    // The transform matrix will handle positioning relative to world coordinates
    const mapCanvasX = -mapData.origin[0] / mapData.resolution; 
const mapCanvasY = -mapData.origin[1] / mapData.resolution;

ctx.putImageData(imageData, mapCanvasX, mapCanvasY);

    // 📍 ROS STANDARD PIXEL/RESOLUTION MAPPING
    const x0 = mapData.origin[0];
    const y0 = mapData.origin[1];
    const resolution = mapData.resolution;
    const mapWorldWidth = mapData.width * resolution;
    const mapWorldHeight = mapData.height * resolution;
    
    console.log('🎯 ROS Standard Pixel/Resolution System:', {
      // Pixel preservation
      pixelData: {
        originalSize: `${mapData.width}x${mapData.height} pixels`,
        preserved: 'PGM pixel structure kept intact',
        canvasRendering: 'Direct putImageData at (0,0)'
      },
      
      // Resolution scaling
      resolution: `${resolution}m/pixel`,
      physicalSize: `${mapWorldWidth.toFixed(3)}m × ${mapWorldHeight.toFixed(3)}m`,
      
      // Origin positioning (ROS standard)
      origin: {
        yaml: [x0, y0],
        meaning: 'Bottom-left corner of PGM in world coordinates',
        pixelCorrespondence: `Pixel(0,${mapData.height-1}) ↔ World(${x0},${y0})`
      },
      
      // Coordinate mapping examples
      coordinateMapping: {
        bottomLeft: {
          pixel: [0, mapData.height-1],
          world: [x0, y0]
        },
        topRight: {
          pixel: [mapData.width-1, 0],
          world: [(x0 + mapWorldWidth).toFixed(3), (y0 + mapWorldHeight).toFixed(3)]
        },
        worldOrigin: {
          world: [0, 0],
          pixel: [((0 - x0) / resolution).toFixed(1), (mapData.height - (0 - y0) / resolution).toFixed(1)]
        }
      },
      
      // Y-axis handling
      yAxisFlip: {
        reason: 'PGM uses top-left origin, ROS uses bottom-left',
        formula: 'j = height - (y_ros - y₀) / resolution'
      }
    });

    // Render coordinate axes
    renderAxes(ctx);

    // Render robot pose using ROS standard coordinate conversion
    if (robotPose) {
      // ROS standard conversion: i = (x_ros - x₀) / res, j = height - (y_ros - y₀) / res  
      const robotWorldX = robotPose.position.x;
      const robotWorldY = robotPose.position.y;
      const px = (robotWorldX - mapData.origin[0]) / mapData.resolution;
      const py = mapData.height - (robotWorldY - mapData.origin[1]) / mapData.resolution;

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

    // Render goal points using ROS standard coordinate conversion
    goals.forEach((goal, index) => {
      // ROS standard conversion: i = (x_ros - x₀) / res, j = height - (y_ros - y₀) / res
      const px = (goal.x - mapData.origin[0]) / mapData.resolution;
      const py = mapData.height - (goal.y - mapData.origin[1]) / mapData.resolution;

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

  // Re-render when changes occur
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

    // Zoom to mouse position
    const scaleRatio = newScale / scale;
    setOffset(prev => ({
      x: mouseX - (mouseX - prev.x) * scaleRatio,
      y: mouseY - (mouseY - prev.y) * scaleRatio
    }));
    
    setScale(newScale);
  };

  // Handle mouse events for pan
  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button === 0) { // Left click
      setIsDragging(true);
      setLastMousePos({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    // Update mouse coordinates for display
    if (mapData) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;

        // Convert to world coordinates
        const mapPixelX = (canvasX - offset.x) / scale;
        const mapPixelY = (canvasY - offset.y) / scale;
        
        if (mapPixelX >= 0 && mapPixelX < mapData.width && mapPixelY >= 0 && mapPixelY < mapData.height) {
          const worldX = mapData.origin[0] + (mapPixelX * mapData.resolution);
          const worldY = mapData.origin[1] + ((mapData.height - mapPixelY) * mapData.resolution);
          setMouseCoords({ x: worldX, y: worldY });
          setShowMouseCoords(true);
        } else {
          setShowMouseCoords(false);
        }
      }
    }

    // Handle dragging
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

  const handleMouseLeave = () => {
    setIsDragging(false);
    setShowMouseCoords(false);
  };

  // Handle click to set goal - using ROS coordinate conversion
  const handleCanvasClick = (event: React.MouseEvent) => {
    if (!mapData || !onMapClick || isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    // Convert canvas coordinates to map pixel coordinates
    const mapPixelX = (canvasX - offset.x) / scale;
    const mapPixelY = (canvasY - offset.y) / scale;

    // Check if click is within map bounds
    if (mapPixelX < 0 || mapPixelX >= mapData.width || mapPixelY < 0 || mapPixelY >= mapData.height) {
      return;
    }

    // Convert to world coordinates using ROS formula
    const worldX = mapData.origin[0] + (mapPixelX * mapData.resolution);
    const worldY = mapData.origin[1] + ((mapData.height - mapPixelY) * mapData.resolution);

    console.log('Click position (ROS standard):', {
      canvas: { x: canvasX, y: canvasY },
      mapPixel: { x: mapPixelX.toFixed(1), y: mapPixelY.toFixed(1) },
      world: { x: worldX.toFixed(3), y: worldY.toFixed(3) },
      scale,
      offset
    });

    onMapClick(worldX, worldY);
  };

  // Reset view to world coordinate (0,0) reference with pixel-accurate scaling
  const resetView = () => {
    if (mapData && canvasSize.width > 0 && canvasSize.height > 0) {
      // Calculate scale to fit map while preserving pixel accuracy
      const fitScale = Math.min(
        (canvasSize.width * 0.8) / mapData.width,
        (canvasSize.height * 0.8) / mapData.height
      );
      
      // Position world (0,0) at canvas center
      const worldOriginCanvasX = canvasSize.width / 2;
      const worldOriginCanvasY = canvasSize.height / 2;
      
      // ROS standard: Calculate correct positioning
      const x0 = mapData.origin[0];
      const y0 = mapData.origin[1];
      const worldOriginInMapPixelX = (0 - x0) / mapData.resolution;
      const worldOriginInMapPixelY = (0 - y0) / mapData.resolution;
      
      // Set view with pixel-accurate positioning
      setScale(fitScale);
      // setOffset({
      //   x: worldOriginCanvasX - (worldOriginInMapPixelX * fitScale),
      //   y: worldOriginCanvasY - ((mapData.height - worldOriginInMapPixelY) * fitScale)
      // });
      setOffset({
        x: -300.0,
        y: 300.0
      });
      
      console.log('🔄 Reset with corrected positioning:', {
        worldReference: [0, 0],
        mapOrigin: [x0, y0],
        worldOriginInMapPixels: [worldOriginInMapPixelX.toFixed(1), worldOriginInMapPixelY.toFixed(1)],
        scale: fitScale
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
        onMouseLeave={handleMouseLeave}
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

      {/* Mouse coordinates display */}
      {showMouseCoords && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-80 text-white px-3 py-2 rounded text-sm">
          <div className="text-green-400 text-xs mb-1">Mouse Position</div>
          <div>X: {mouseCoords.x.toFixed(3)}m</div>
          <div>Y: {mouseCoords.y.toFixed(3)}m</div>
        </div>
      )}
    </div>
  );
}