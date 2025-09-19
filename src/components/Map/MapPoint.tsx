import { useState } from 'react';
import { MapPin, X, Edit3, Trash2, Navigation } from 'lucide-react';
import { GoalPoint } from '../../types/robot';

interface MapPointProps {
  point: GoalPoint;
  isSelected: boolean;
  onSelect: (point: GoalPoint) => void;
  onEdit: (point: GoalPoint) => void;
  onDelete: (point: GoalPoint) => void;
  onNavigate: (point: GoalPoint) => void;
  scale: number;
  mapCanvasX: number;
  mapCanvasY: number;
  mapData: any;
}

export function MapPoint({ 
  point, 
  isSelected, 
  onSelect, 
  onEdit, 
  onDelete, 
  onNavigate, 
  scale, 
  mapCanvasX, 
  mapCanvasY, 
  mapData 
}: MapPointProps) {
  const [showMenu, setShowMenu] = useState(false);

  // Convert world coordinates to canvas coordinates
  const pointMapX = (point.x - mapData.origin[0]) / mapData.resolution;
  const pointMapY = (point.y - mapData.origin[1]) / mapData.resolution;
  const pointPixelY = mapData.height - 1 - pointMapY;
  
  const canvasX = mapCanvasX + pointMapX;
  const canvasY = mapCanvasY + pointPixelY;

  return (
    <>
      {/* Map Point */}
      <div
        className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 ${
          isSelected ? 'scale-125' : 'hover:scale-110'
        }`}
        style={{
          left: `${canvasX}px`,
          top: `${canvasY}px`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(point);
          setShowMenu(true);
        }}
      >
        <div className={`relative ${isSelected ? 'animate-pulse' : ''}`}>
          <MapPin 
            size={24 / scale} 
            className={`${
              isSelected 
                ? 'text-blue-600 fill-blue-200' 
                : 'text-blue-500 fill-blue-100 hover:text-blue-600'
            } drop-shadow-lg`}
          />
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-blue-700 bg-white/90 px-1 rounded whitespace-nowrap">
            {point.name}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {showMenu && isSelected && (
        <div
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
          style={{
            left: `${Math.min(canvasX + 20, window.innerWidth - 200)}px`,
            top: `${Math.max(canvasY - 50, 50)}px`,
          }}
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="font-medium text-gray-900">{point.name}</div>
            <div className="text-xs text-gray-500">
              ({point.x.toFixed(2)}, {point.y.toFixed(2)})
            </div>
          </div>
          
          <button
            onClick={() => {
              onNavigate(point);
              setShowMenu(false);
            }}
            className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center text-blue-600"
          >
            <Navigation size={16} className="mr-2" />
            Navigate Here
          </button>
          
          <button
            onClick={() => {
              onEdit(point);
              setShowMenu(false);
            }}
            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center text-gray-700"
          >
            <Edit3 size={16} className="mr-2" />
            Edit Point
          </button>
          
          <button
            onClick={() => {
              onDelete(point);
              setShowMenu(false);
            }}
            className="w-full px-3 py-2 text-left hover:bg-red-50 flex items-center text-red-600"
          >
            <Trash2 size={16} className="mr-2" />
            Delete Point
          </button>
          
          <button
            onClick={() => setShowMenu(false)}
            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center text-gray-500 border-t border-gray-100"
          >
            <X size={16} className="mr-2" />
            Close
          </button>
        </div>
      )}
    </>
  );
}