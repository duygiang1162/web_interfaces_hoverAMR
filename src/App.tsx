import { useState, useEffect, useRef } from 'react';
import { MapCanvas, MapCanvasRef } from './components/Map/MapCanvas';
import { MapSelector } from './components/Map/MapSelector';
import { SLAMMappingPanel } from './components/Building/SLAMMappingPanel';
import { TeleopPanel } from './components/Teleop/TeleopPanel';
import { GoalManager } from './components/Goals/GoalManager';
import { useWebSocket } from './hooks/useWebSocket';
import { getWebSocketUrl, getMapServerUrl } from './config/endpoints';
import { GoalPoint, MapData } from './types/robot';
import { StorageService } from './utils/storage';
import { PointDataService } from './services/pointDataService';
import { Nav2APIService } from './services/nav2ApiService';
import { MapParser } from './services/mapParser';
import { extractOrientationFromPose } from './utils/orientation';
import { ContextMenu } from './components/UI/ContextMenu';
import { EditPoseModal } from './components/UI/EditPoseModal';
import { PropertiesModal } from './components/UI/PropertiesModal';
import { Wifi, WifiOff, Activity, MapPin, Settings, Monitor, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, AlertTriangle, X } from 'lucide-react';

function App() {
  // State management
  const [goals, setGoals] = useState<GoalPoint[]>([]);
  const [showTeleop, setShowTeleop] = useState(false); // Mặc định đóng Remote Control
  const [activeTab, setActiveTab] = useState<'monitor' | 'operation' | 'building' | 'settings'>('monitor');
  const [maxLinear, setMaxLinear] = useState(0.5);
  const [maxAngular, setMaxAngular] = useState(0.5);
  const [wsUrl, setWsUrl] = useState(getWebSocketUrl());
  const [localMapData, setLocalMapData] = useState<MapData | null>(null);
  const [selectedMap, setSelectedMap] = useState<string | null>(null); // Track selected map
  const [mapError, setMapError] = useState<string | null>(null); // Track map loading errors
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [mouseWorldCoords, setMouseWorldCoords] = useState<{x: number, y: number} | null>(null);
  const [isAddPointMode, setIsAddPointMode] = useState(false); // Toggle mode for adding points by clicking
  
  // Context Menu and Modal states
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    goalId: string;
  }>({ isOpen: false, x: 0, y: 0, goalId: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPropertiesModal, setShowPropertiesModal] = useState(false);
  const [selectedGoalForAction, setSelectedGoalForAction] = useState<GoalPoint | null>(null);
  
  // Mapping state
  const [isMappingActive, setIsMappingActive] = useState(false);
  const [mappingProgress, setMappingProgress] = useState(0);
  
  // Navigation state
  const [isMoving, setIsMoving] = useState(false);
  const [currentTarget, setCurrentTarget] = useState<GoalPoint | null>(null);
  
  // Nav2 API Service
  const nav2API = new Nav2APIService(); // Will use config automatically
  
  // Reference to MapCanvas for triggering fit
  const mapCanvasRef = useRef<MapCanvasRef>(null);
  
  // Track which tab was last auto-fitted to avoid duplicate auto-fits
  const lastAutoFittedTab = useRef<string | null>(null);
  const autoFitTimeoutRef = useRef<number | null>(null);
  
  // SLAM mapping state
  const [showSLAMPanel, setShowSLAMPanel] = useState(false);
  const [isSLAMActive, setIsSLAMActive] = useState(false);
  
  // Sidebar state for Operation tab
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    editMaps: true,
    taskManagement: false,
    robotSetting: false,
    mapAvailable: true,
    buildMapOnline: false
  });

  // Sidebar helper functions
  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    // Close context menu when toggling sections
    closeContextMenuOnAction();
    
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // Auto-fit function - execute with debounce
  const tryAutoFit = (targetTab: string) => {
    // Clear any pending auto-fit
    if (autoFitTimeoutRef.current) {
      clearTimeout(autoFitTimeoutRef.current);
      autoFitTimeoutRef.current = null;
    }
    
    if (!localMapData) {
      console.log('⏭️ Auto-fit skipped: No map data');
      return;
    }
    
    console.log('🎯 Auto-fit scheduled for tab:', targetTab);
    
    // Debounce the auto-fit execution
    autoFitTimeoutRef.current = setTimeout(() => {
      if (mapCanvasRef.current && mapCanvasRef.current.fitToScreen) {
        console.log('✅ Auto-fit executing for tab:', targetTab);
        mapCanvasRef.current.fitToScreen();
        lastAutoFittedTab.current = targetTab; // Mark as done
      } else {
        console.log('⏳ Auto-fit failed: MapCanvas ref not ready');
      }
      autoFitTimeoutRef.current = null;
    }, 300); // Single 300ms delay
  };
  
  // Auto-fit when map data is loaded or tab changes (only once per tab)
  useEffect(() => {
    if (localMapData && (activeTab === 'monitor' || activeTab === 'operation')) {
      if (lastAutoFittedTab.current === activeTab) {
        console.log('⏭️ Auto-fit skipped: Already done for tab', activeTab);
        return;
      }
      console.log('� Requesting auto-fit for tab:', activeTab);
      tryAutoFit(activeTab);
    }
  }, [localMapData, activeTab]);
  
  // Handle tab change with auto-fit for Monitor and Operation
  const handleTabChange = (tab: 'monitor' | 'operation' | 'building' | 'settings') => {
    console.log('🔄 Tab changed to:', tab);
    
    // Close context menu when switching tabs
    closeContextMenuOnAction();
    
    // Auto-disable add point mode when switching tabs
    if (isAddPointMode) {
      console.log('🚫 Auto-disabling add point mode on tab switch');
      setIsAddPointMode(false);
    }
    
    setActiveTab(tab);
    
    // Auto-fit when switching to Monitor or Operation (debounced)
    if (tab === 'monitor' || tab === 'operation') {
      console.log('🎯 Tab switch - requesting auto-fit for tab:', tab);
      // Don't call immediately, let the useEffect handle it with debounce
    }
  };

  // Goal editing handlers
  const handleGoalClick = (goalId: string, event?: MouseEvent) => {

    
    const goal = goals.find(g => g.id === goalId);
    if (!goal) {

      return;
    }

    if (event) {
      console.log('📱 Event details:', { button: event.button, clientX: event.clientX, clientY: event.clientY });
      
      if (event.button === 2) {
        // Right-click: open context menu
        event.preventDefault();

        const newContextMenu = {
          isOpen: true,
          x: event.clientX,
          y: event.clientY,
          goalId: goalId
        };
        setContextMenu(newContextMenu);
        setSelectedGoalForAction(goal);


      } else if (event.button === 0) {
        // Left-click: select goal

        setSelectedGoalId(goalId);
        setContextMenu({ isOpen: false, x: 0, y: 0, goalId: '' });
        setSelectedGoalForAction(goal);

      }
    } else {
      // Fallback: select goal
      // console.log('🖱️ No event - fallback selection');
      setSelectedGoalId(goalId);
      setContextMenu({ isOpen: false, x: 0, y: 0, goalId: '' });
      setSelectedGoalForAction(goal);
      // console.log('Goal selected:', goalId);
    }
  };

  // Context Menu handlers - support both context menu and direct goal param
  const handleMoveToHere = async (goalParam?: GoalPoint) => {
    const goal = goalParam || selectedGoalForAction;
    if (!goal) return;
    
    // console.log(`🚀 Moving robot to: ${goal.name} (${goal.x}, ${goal.y})`);
    // console.log(`🧭 Goal orientation: ${goal.theta || 0} radians`);
    
    // Auto-disable add point mode when starting robot movement
    if (isAddPointMode) {
      console.log('🚫 Auto-disabling add point mode on robot move start');
      setIsAddPointMode(false);
    }
    
    // Set moving state
    setIsMoving(true);
    setCurrentTarget(goal);
    
    try {
      const result = await nav2API.sendGoal({
        x: goal.x,
        y: goal.y,
        theta: goal.theta || 0.0, // Use goal's theta value
        frame_id: 'map'
      });

      if (result.success) {
        // console.log('✅ Goal sent to Nav2 successfully:', result.message);
        // Keep moving state true until goal completed or cancelled
      } else {
        console.error('❌ Failed to send goal to Nav2:', result.error);
        alert(`Failed to send goal: ${result.error}`);
        // Reset moving state on error
        setIsMoving(false);
        setCurrentTarget(null);
      }
    } catch (error) {
      console.error('❌ Error sending goal:', error);
      alert('❌ Failed to send goal to Nav2: Network error or server unavailable');
      // Reset moving state on error
      setIsMoving(false);
      setCurrentTarget(null);
    }
  };

  const handleEditPose = () => {
    if (selectedGoalForAction) {
      // Auto-disable add point mode when opening edit modal
      if (isAddPointMode) {
        console.log('🚫 Auto-disabling add point mode on edit modal open');
        setIsAddPointMode(false);
      }
      setShowEditModal(true);
    }
  };

  const handleDeletePose = async (goalParam?: GoalPoint) => {
    const goal = goalParam || selectedGoalForAction;
    if (!goal || !selectedMap) return;
    
    if (window.confirm(`Are you sure you want to delete "${goal.name}"?`)) {
      // Remove from local state
      const updatedGoals = goals.filter(g => g.id !== goal.id);
      setGoals(updatedGoals);
      
      // Remove from map-specific file
      try {
        const success = await PointDataService.removePoint(goal.id);
        if (success) {
          // console.log('✅ Point deleted successfully');
        } else {
          console.error('❌ Failed to delete point from file');
        }
      } catch (error) {
        console.error('❌ Error deleting point:', error);
      }

      // Clear selection
      if (selectedGoalId === goal.id) {
        setSelectedGoalId(null);
      }
    }
  };

  const handleCancelMove = async () => {
    if (!isMoving || !currentTarget) return;
    
    // console.log(`🚫 Cancelling move to: ${currentTarget.name}`);
    
    try {
      const result = await nav2API.cancelGoal();
      
      if (result.success) {
        // console.log('✅ Goal cancelled successfully:', result.message);
        setIsMoving(false);
        setCurrentTarget(null);
      } else {
        console.error('❌ Failed to cancel goal:', result.error);
        alert(`Failed to cancel goal: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error cancelling goal:', error);
      alert('❌ Failed to cancel goal: Network error or server unavailable');
    }
  };

  const handleShowProperties = () => {
    if (selectedGoalForAction) {
      setShowPropertiesModal(true);
    }
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ isOpen: false, x: 0, y: 0, goalId: '' });
  };

  // Close context menu when clicking outside map area or on other controls
  const closeContextMenuOnAction = () => {
    if (contextMenu.isOpen) {
      handleCloseContextMenu();
    }
  };

  const handleSaveEditedPose = async (updatedPose: GoalPoint) => {
    if (!selectedMap) return;

    // Update local state
    const updatedGoals = goals.map(g => 
      g.id === updatedPose.id ? updatedPose : g
    );
    setGoals(updatedGoals);

    // Update in map-specific file
    try {
      const success = await PointDataService.updatePoint(updatedPose.id, updatedPose);
      if (success) {
        // console.log('✅ Point updated successfully');
      } else {
        console.error('❌ Failed to update point in file');
      }
    } catch (error) {
      console.error('❌ Error updating point:', error);
    }

    setSelectedGoalForAction(updatedPose);
  };

  const handleEditSelectedGoal = () => {
    if (selectedGoalId) {
      const goal = goals.find(g => g.id === selectedGoalId);
      if (goal) {
        const newName = prompt('Enter new goal name:', goal.name);
        if (newName && newName !== goal.name) {
          const updatedGoals = goals.map(g => 
            g.id === selectedGoalId ? { ...g, name: newName } : g
          );
          setGoals(updatedGoals);
          StorageService.saveGoals(updatedGoals);
        }
      }
    }
  };

  const handleDeleteSelectedGoal = () => {
    if (selectedGoalId && window.confirm('Are you sure you want to delete this goal?')) {
      const updatedGoals = goals.filter(g => g.id !== selectedGoalId);
      setGoals(updatedGoals);
      StorageService.saveGoals(updatedGoals);
      setSelectedGoalId(null);
    }
  };

  // WebSocket connection - không sử dụng mapData từ WebSocket nữa
  const { connected, robotPose, amclPose, sendVelocityCommand, sendGoal } = useWebSocket(wsUrl);
  
  // Pose states are managed by useWebSocket hook and passed to MapCanvas
  
  // Debug: Track pose changes from useWebSocket
  useEffect(() => {
    if (robotPose) {
      // console.log('🤖 App.tsx robotPose updated:', {
      //   x: robotPose.position.x.toFixed(3),
      //   y: robotPose.position.y.toFixed(3),
      //   timestamp: Date.now()
      // });
    }
  }, [robotPose]);
  
  useEffect(() => {
    if (amclPose) {
      console.log('🎯 App.tsx amclPose updated:', {
        x: amclPose.position.x.toFixed(3),
        y: amclPose.position.y.toFixed(3),
        timestamp: Date.now()
      });
    }
  }, [amclPose]);

  // Handle map loading from files
  const handleMapLoad = (mapData: MapData) => {
    setLocalMapData(mapData);
    // console.log('Map loaded into app:', {
    //   size: `${mapData.width}x${mapData.height}`,
    //   resolution: mapData.resolution,
    //   origin: mapData.origin
    // });
  };

  // Close context menu on clicks outside map area
  useEffect(() => {
    const handleGlobalClick = (event: Event) => {
      if (contextMenu.isOpen) {
        // Check if click is outside map canvas area
        const target = event.target as HTMLElement;
        const mapCanvas = document.querySelector('canvas');
        
        if (mapCanvas && !mapCanvas.contains(target)) {
          // Click is outside map canvas, close context menu
          handleCloseContextMenu();
        }
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [contextMenu.isOpen]);

  // Load saved goals và current map khi app khởi động
  useEffect(() => {
    const initializeApp = async () => {
      // Load saved goals
      const savedGoals = StorageService.loadGoals();
      setGoals(savedGoals);
      
      // Load current map và auto-load nó
      try {
        const currentMap = await PointDataService.getCurrentMap();
        if (currentMap) {
          // console.log('🚀 Auto-loading current map on app startup:', currentMap);
          setSelectedMap(currentMap);
          
          // Load map cho cả Nav2 và frontend visualization đồng thời
          const mapResult = await loadMapForBothSystems(currentMap);
          if (!mapResult.success) {
            // Show error to user but don't block app initialization
            console.warn('⚠️ Map loading failed:', mapResult.error);
            setMapError(mapResult.error || 'Failed to load map');
            // App UI will still load, user can select different map
          } else {
            setMapError(null); // Clear any previous errors
          }
        } else {
          // console.log('� No current map found in data');
        }
      } catch (error) {
        console.error('❌ Failed to load current map:', error);
      }
    };
    
    initializeApp();
  }, []);

  // Function to load map for both Nav2 và frontend visualization
  const loadMapForBothSystems = async (mapName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // console.log('🔄 Loading map for both Nav2 and frontend:', mapName);
      
      // 1. Load map into Nav2 system
      const nav2Result = await nav2API.loadMap(`/hover_board/src/nav2_hover/nav2_hoveramr/map/${mapName}.yaml`);
      
      if (nav2Result.success) {
        // console.log('✅ Map loaded successfully into Navigation2:', nav2Result.message);
      } else {
        console.warn('⚠️ Failed to load map into Navigation2:', nav2Result.error);
      }
      
      // 2. Load map data for frontend visualization
      // console.log('🔄 Loading map visualization data:', mapName);
      
      // Fetch YAML metadata from Map Server
      const yamlResponse = await fetch(`${getMapServerUrl()}/api/maps/${mapName}.yaml`);
      if (!yamlResponse.ok) {
        if (yamlResponse.status === 404) {
          console.warn(`⚠️ Map file not found: ${mapName}.yaml`);
          return { success: false, error: `Map '${mapName}' not found on server. Please check if the map file exists or select a different map.` };
        }
        throw new Error(`Failed to fetch YAML: ${yamlResponse.status}`);
      }
      const yamlText = await yamlResponse.text();
      
      // Parse YAML manually (simple parsing for map metadata)
      const lines = yamlText.split('\n');
      const yamlData: any = {};
      
      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key === 'image') {
            yamlData.image = value;
          } else if (key === 'resolution') {
            yamlData.resolution = parseFloat(value);
          } else if (key === 'origin') {
            // Parse origin array [x, y, theta]
            const originMatch = value.match(/\[(.*?)\]/);
            if (originMatch) {
              yamlData.origin = originMatch[1].split(',').map(v => parseFloat(v.trim()));
            }
          } else if (key === 'negate') {
            yamlData.negate = parseInt(value);
          } else if (key === 'occupied_thresh') {
            yamlData.occupied_thresh = parseFloat(value);
          } else if (key === 'free_thresh') {
            yamlData.free_thresh = parseFloat(value);
          }
        }
      }
      
      // Fetch PGM image data from Map Server
      const pgmResponse = await fetch(`${getMapServerUrl()}/api/maps/${mapName}.pgm`);
      if (!pgmResponse.ok) {
        throw new Error(`Failed to fetch PGM: ${pgmResponse.status}`);
      }
      const pgmArrayBuffer = await pgmResponse.arrayBuffer();
      const pgmData = new Uint8Array(pgmArrayBuffer);
      
      // Parse PGM header manually
      let offset = 0;
      const decoder = new TextDecoder();
      let header = '';
      
      // Read header until we find two newlines or reach data
      for (let i = 0; i < Math.min(1000, pgmData.length); i++) {
        if (pgmData[i] === 10) { // newline
          const line = decoder.decode(pgmData.slice(offset, i));
          header += line + '\n';
          offset = i + 1;
          
          if (line.includes('255') || (line.match(/^\d+\s+\d+$/) && header.includes('P5'))) {
            break;
          }
        }
      }
      
      // Extract dimensions from header
      const lines_header = header.split('\n').filter(line => line && !line.startsWith('#'));
      const dimensions = lines_header[1].split(' ');
      const width = parseInt(dimensions[0]);
      const height = parseInt(dimensions[1]);
      
      // Create map data object
      const mapData = {
        width,
        height,
        data: Array.from(pgmData.slice(offset)), // Convert Uint8Array to number array
        resolution: yamlData.resolution,
        origin: yamlData.origin,
        negate: yamlData.negate,
        occupied_thresh: yamlData.occupied_thresh,
        free_thresh: yamlData.free_thresh
      };
      
      // console.log('✅ Map visualization data loaded:', {
      //   name: mapName,
      //   size: `${width}x${height}`,
      //   resolution: yamlData.resolution,
      //   origin: yamlData.origin
      // });
      
      // Update frontend map display
      setLocalMapData(mapData);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Failed to load map for both systems:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: `Failed to load map '${mapName}': ${errorMessage}` };
    }
  };

  // Load map-specific points when selectedMap changes
  useEffect(() => {
    const loadMapPoints = async () => {
      if (selectedMap) {
        try {
          // Clear any previous map errors when changing maps
          setMapError(null);
          // console.log(`🔄 Loading points for map: ${selectedMap}`);
          const mapPoints = await PointDataService.getPointsForMap(selectedMap);
          
          // Always set goals, whether empty or not
          setGoals(mapPoints);
          
          if (mapPoints.length > 0) {
            // console.log(`✅ Loaded ${mapPoints.length} points for map: ${selectedMap}`);
          } else {
            // console.log(`📝 No points found for map: ${selectedMap}`);
          }
        } catch (error) {
          console.error('❌ Failed to load points for map:', selectedMap, error);
          // Clear goals on error
          setGoals([]);
        }
      } else {
        // No map selected, clear goals
        setGoals([]);
        // console.log('🔄 No map selected, cleared goals');
      }
    };
    
    loadMapPoints();
  }, [selectedMap]);

  // Refresh points data when switching to Monitor or Operation tabs
  useEffect(() => {
    if ((activeTab === 'monitor' || activeTab === 'operation') && selectedMap) {
      const refreshPoints = async () => {
        try {
          // console.log(`🔄 Refreshing points for tab: ${activeTab}, map: ${selectedMap}`);
          const mapPoints = await PointDataService.getPointsForMap(selectedMap);
          setGoals(mapPoints);
          
          if (mapPoints.length > 0) {
            // console.log(`✅ Refreshed ${mapPoints.length} points for ${activeTab} tab`);
          } else {
            // console.log(`📝 No points found for ${activeTab} tab`);
          }
        } catch (error) {
          console.error('❌ Failed to refresh points:', error);
        }
      };
      
      refreshPoints();
    }
  }, [activeTab, selectedMap]);

  // Auto-disable add point mode on Escape key or when losing window focus
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isAddPointMode) {
        console.log('🚫 Auto-disabling add point mode on Escape key');
        setIsAddPointMode(false);
      }
    };

    const handleWindowBlur = () => {
      if (isAddPointMode) {
        console.log('🚫 Auto-disabling add point mode on window blur');
        setIsAddPointMode(false);
      }
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isAddPointMode]);

  // Handle adding point from current mouse position
  // Toggle add point mode (click to enable/disable point adding)
  const handleToggleAddPointMode = () => {
    // Close context menu when toggling add point mode
    closeContextMenuOnAction();
    
    const newMode = !isAddPointMode;
    setIsAddPointMode(newMode);
    // console.log(newMode ? '🎯 Entered add point mode - click on map to add points' : '🚫 Exited add point mode');
    // console.log('📊 Add point mode state:', newMode);
  };

  // Handle adding point from current robot pose
  const handleAddPointFromRobot = async () => {
    // Close context menu when adding point from robot
    closeContextMenuOnAction();
    
    if (robotPose && selectedMap) {
      // console.log('🤖 Adding point from robot pose:');
      // console.log('  Robot pose (world coords):', robotPose.position);
      // console.log('  Robot orientation data:', robotPose.orientation || robotPose);
      // console.log('  Map data available:', !!localMapData);
      
      if (localMapData) {
        // console.log('  Map origin:', localMapData.origin);
        // console.log('  Map resolution:', localMapData.resolution);
        // console.log('  Map size:', localMapData.width, 'x', localMapData.height);
        
        // Convert robot world coordinates to pixel coordinates for validation
        const [pixelX, pixelY] = MapParser.worldToPixel(robotPose.position.x, robotPose.position.y, localMapData);
        // console.log('  Robot pixel coords:', pixelX, pixelY);
        // console.log('  Pixel coords valid:', pixelX >= 0 && pixelX < localMapData.width && pixelY >= 0 && pixelY < localMapData.height);
        
        // Convert back to world to verify conversion
        const [verifyWorldX, verifyWorldY] = MapParser.pixelToWorld(pixelX, pixelY, localMapData);
        // console.log('  Verify world coords:', verifyWorldX, verifyWorldY);
      }
      
      // Extract the robot's actual orientation
      const robotTheta = extractOrientationFromPose(robotPose);
      // console.log('  Extracted robot orientation (theta):', robotTheta, 'radians');
      
      const newPoint: GoalPoint = {
        id: `point-robot-${Date.now()}`,
        name: `Robot Point ${goals.length + 1}`,
        x: robotPose.position.x,
        y: robotPose.position.y,
        theta: robotTheta, // Use actual robot orientation
        timestamp: Date.now(),
        source: 'robot'
      };
      
      // console.log('  New point to add:', newPoint);
      
      // Save to backend using the correct API
      const success = await PointDataService.addPointToMap(selectedMap, newPoint);
      if (success) {
        // console.log('✅ Point from robot pose added successfully');
        // Refresh points for current map
        try {
          const mapPoints = await PointDataService.getPointsForMap(selectedMap);
          setGoals(mapPoints);
          // console.log('  Points refreshed for map:', selectedMap);
        } catch (error) {
          console.error('Failed to refresh points:', error);
        }
      } else {
        console.error('❌ Failed to save point from robot pose');
      }
    } else {
      alert('No robot pose available or map selected');
    }
  };

  // Handle mouse move trên map
  const handleMouseMove = (worldX: number, worldY: number) => {
    setMouseWorldCoords({ x: worldX, y: worldY });
    // console.log('🖱️ Mouse world coords updated:', { x: worldX, y: worldY });
  };

  // Handle map click để tạo goal
  const handleMapClick = async (worldX: number, worldY: number) => {
    // Update mouse world coordinates for tracking
    setMouseWorldCoords({ x: worldX, y: worldY });
    
    // Only add point if in add point mode
    if (isAddPointMode && selectedMap) {
      console.log('🎯 Adding point at:', { x: worldX.toFixed(2), y: worldY.toFixed(2) });
      
      const newPoint: GoalPoint = {
        id: `point-click-${Date.now()}`,
        name: `Click Point ${goals.length + 1}`,
        x: worldX,
        y: worldY,
        theta: 0, // Default orientation
        timestamp: Date.now(),
        source: 'manual'
      };

      // Add to local state
      setGoals(prev => [...prev, newPoint]);
      
      // Save to map-specific file
      const success = await PointDataService.addPointToMap(selectedMap, newPoint);
      if (success) {
        console.log('✅ Point added successfully:', newPoint.name);
      } else {
        console.error('❌ Failed to save point to file');
      }
    }
  };

  // Handle velocity control
  const handleVelocityChange = (linear: number, angular: number) => {
    sendVelocityCommand(linear, angular);
  };

  // Handle send goal
  const handleSendGoal = (x: number, y: number, theta: number = 0) => {
    sendGoal(x, y, theta);
  };

  // SLAM Mapping handlers
  const handleStartMapping = async () => {
    try {
      setIsMappingActive(true);
      setMappingProgress(0);
      console.log('🗺️ Starting SLAM mapping...');
      
      // TODO: Call backend API to start SLAM
      // Example: await nav2ApiService.startSlam();
      
      // Simulate progress for now
      const progressInterval = setInterval(() => {
        setMappingProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 2;
        });
      }, 500);
      
    } catch (error) {
      console.error('Failed to start mapping:', error);
      setIsMappingActive(false);
    }
  };

  // SLAM mapping handlers
  const handleStartSLAMMapping = () => {
    console.log('🚀 Opening SLAM Mapping Panel');
    // Auto-disable add point mode when starting SLAM
    if (isAddPointMode) {
      console.log('🚫 Auto-disabling add point mode on SLAM start');
      setIsAddPointMode(false);
    }
    setShowSLAMPanel(true);
  };
  
  const handleCloseSLAMPanel = () => {
    console.log('❌ Closing SLAM Mapping Panel');
    setShowSLAMPanel(false);
  };

  const handleStopMapping = async () => {
    try {
      console.log('🛑 Stopping SLAM mapping...');
      setIsMappingActive(false);
      setMappingProgress(0);
      
      // TODO: Call backend API to stop SLAM
      // Example: await nav2ApiService.stopSlam();
      
    } catch (error) {
      console.error('Failed to stop mapping:', error);
    }
  };

  const handleSaveMap = async () => {
    try {
      const mapName = prompt('Enter map name:', `map_${new Date().toISOString().slice(0, 10)}`);
      if (!mapName) return;
      
      console.log(`💾 Saving map as: ${mapName}`);
      
      // TODO: Call backend API to save map
      // Example: await nav2ApiService.saveMap(mapName);
      
      alert(`Map saved as: ${mapName}`);
      
    } catch (error) {
      console.error('Failed to save map:', error);
      alert('Failed to save map');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Navigation */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold">R</span>
              </div>
              <h1 className="text-xl font-bold text-gray-800 mr-8">Robot System</h1>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex space-x-1">
              <button
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors flex items-center ${
                  activeTab === 'monitor'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
                onClick={() => handleTabChange('monitor')}
              >
                <Activity className="inline mr-2" size={16} />
                Monitor
              </button>
              <button
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors flex items-center ${
                  activeTab === 'operation'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
                onClick={() => handleTabChange('operation')}
              >
                <MapPin className="inline mr-2" size={16} />
                Operation
              </button>
              <button
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors flex items-center ${
                  activeTab === 'building'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
                onClick={() => handleTabChange('building')}
              >
                <MapPin className="inline mr-2" size={16} />
                Building
              </button>
              <button
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors flex items-center ${
                  activeTab === 'settings'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
                onClick={() => handleTabChange('settings')}
              >
                <Settings className="inline mr-2" size={16} />
                Settings
              </button>
            </nav>
            
            {/* Connection status */}
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
              connected 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
              {connected ? (
                <>
                  <Wifi size={16} />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <WifiOff size={16} />
                  <span>Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Error Notification Banner */}
      {mapError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-4 rounded-r-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  <span className="font-medium">Map Loading Error:</span> {mapError}
                </p>
              </div>
            </div>
            <button
              onClick={() => setMapError(null)}
              className="flex-shrink-0 ml-4 text-red-400 hover:text-red-600 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="h-[calc(100vh-80px)]">
        {/* Monitor Tab - Map View with Floating Panels */}
        {activeTab === 'monitor' && (
          <div className="h-full relative">
            {/* Map Canvas Container */}
            <div className="h-full p-6">
              {!localMapData && (
                <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Monitor className="mx-auto mb-4 text-gray-400" size={64} />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No Map Selected</h3>
                    <p className="text-gray-600 mb-4">Please select a map from the Building tab to start monitoring</p>
                    <button
                      onClick={() => handleTabChange('building')}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      Go to Building
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Floating Panels */}
            <div className="absolute top-6 left-6 space-y-4 pointer-events-none">
              {/* Map Status Panel */}
              {localMapData && (
                <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-3 pointer-events-auto min-w-44">
                  <h3 className="font-semibold text-gray-400 mb-2 flex items-center">
                    {/* <MapPin className="mr-2" size={16} />
                    Map Status */}
                  </h3>
                  <div className="space-y-1 text-sm">
                    {/* <p><strong>Map:</strong> {selectedMap || 'Unknown'}</p> */}
                    {/* <p><strong>Size:</strong> {localMapData.width} x {localMapData.height} px</p>
                    <p><strong>Resolution:</strong> {localMapData.resolution} m/px</p> */}
                  </div>
                </div>
              )}

              {/* Robot Position Panel */}
              {/* {robotPose && (
                <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 pointer-events-auto min-w-64"> */}
                  {/* <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                    <Activity className="mr-2" size={16} />
                    Robot Position
                  </h3> */}
                  {/* <div className="space-y-1 text-sm">
                    <p><strong>X:</strong> {robotPose.position.x.toFixed(2)} m</p>
                    <p><strong>Y:</strong> {robotPose.position.y.toFixed(2)} m</p>
                    <p><strong>Heading:</strong> {(2 * Math.atan2(robotPose.orientation.z, robotPose.orientation.w) * 180 / Math.PI).toFixed(1)}°</p>
                  </div> */}
                {/* </div>
              )} */}
            </div>

            {/* Remote Control Toggle - Top Right */}
            {/* <div className="absolute top-6 right-6">
              <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center mr-3">
                    <Gamepad2 className="mr-2" size={16} />
                    <span className="text-sm font-medium">Remote Control</span>
                  </div>
                  <button
                    onClick={() => {
                      closeContextMenuOnAction();
                      setShowTeleop(!showTeleop);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showTeleop ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        showTeleop ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {showTeleop && (
                  <p className="text-xs text-green-600 mt-1">Joystick control is active</p>
                )}
              </div>
            </div> */}
          </div>
        )}

        {/* Operation Tab - Map Editor & Robot Operations */}
        {activeTab === 'operation' && (
          <div className="h-full relative">
            {/* Map Canvas Container */}
            <div className="h-full p-6">
              {!localMapData && (
                <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="mx-auto mb-4 text-gray-400" size={64} />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No Map Selected</h3>
                    <p className="text-gray-600 mb-4">Please select a map from the Building tab to start operations</p>
                    <button
                      onClick={() => handleTabChange('building')}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      Go to Building
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Floating Operation Panel */}
            <div className={`fixed top-24 left-6 bg-white/95 backdrop-blur-sm shadow-xl rounded-xl border border-gray-200 transition-all duration-300 z-50 ${
              sidebarCollapsed ? 'w-14' : 'w-80'
            } max-h-[calc(100vh-120px)] overflow-hidden`}>
              {/* Panel Header */}
              <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50/80">
                {!sidebarCollapsed && (
                  <h2 className="font-semibold text-gray-800 text-sm flex items-center">
                    <Settings className="mr-2 text-blue-600" size={16} />
                    Operation Panel
                  </h2>
                )}
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-800"
                >
                  {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
              </div>

              {/* Panel Content */}
              {!sidebarCollapsed ? (
                <div className="overflow-y-auto max-h-[calc(100vh-180px)] p-3 space-y-3">
                  {/* Edit Maps Section */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <button
                      onClick={() => toggleSection('editMaps')}
                      className="w-full p-2.5 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
                    >
                      <div className="flex items-center">
                        <MapPin className="mr-2 text-blue-600" size={14} />
                        <span className="font-medium text-gray-800 text-xs">Edit Maps</span>
                      </div>
                      {expandedSections.editMaps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    {expandedSections.editMaps && (
                      <div className="p-3 space-y-3 bg-white border-t border-gray-100">
                        {/* Point Addition Methods */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={handleAddPointFromRobot}
                            disabled={!robotPose}
                            className={`px-2 py-2 rounded-md text-xs font-medium transition-colors flex flex-col items-center ${
                              robotPose 
                                ? 'bg-purple-600 text-white hover:bg-purple-700' 
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                            title={robotPose ? `Add point at robot: (${robotPose.position.x.toFixed(2)}, ${robotPose.position.y.toFixed(2)})` : 'Robot position not available'}
                          >
                            <span className="font-medium">Add Current Pose</span>
                            {robotPose && (
                              <span className="text-xs opacity-90 mt-0.5">({robotPose.position.x.toFixed(2)}, {robotPose.position.y.toFixed(2)})</span>
                            )}
                          </button>
                          <button
                            onClick={handleToggleAddPointMode}
                            className={`px-2 py-2 rounded-md text-xs font-medium transition-colors flex flex-col items-center ${
                              isAddPointMode 
                                ? 'bg-red-600 text-white hover:bg-red-700' 
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                            title={isAddPointMode ? 'Click to exit add point mode' : 'Click to enter add point mode, then click on map to add points'}
                          >
                            <span className="font-medium">{isAddPointMode ? 'Exit Add Mode' : 'Add by Point'}</span>
                            {isAddPointMode && (
                              <span className="text-xs opacity-90 mt-0.5">Click map to add</span>
                            )}
                            {mouseWorldCoords && (
                              <span className="text-xs opacity-90 mt-0.5">({mouseWorldCoords.x.toFixed(2)}, {mouseWorldCoords.y.toFixed(2)})</span>
                            )}
                          </button>
                        </div>
                        
                        {/* Danh sách goals/points trên map */}
                        <div className="mt-4">
                          <h4 className="font-semibold text-xs text-gray-700 mb-2">Points on Map</h4>
                          {goals.length === 0 ? (
                            <div className="text-xs text-gray-400 italic">No points on this map.</div>
                          ) : (
                            <ul className="space-y-2">
                              {goals.map((goal) => (
                                <li key={goal.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1 border border-gray-100">
                                  <div>
                                    <div className="font-medium text-gray-800 text-xs">{goal.name}</div>
                                    <div className="text-[10px] text-gray-500 font-mono">({goal.x.toFixed(2)}, {goal.y.toFixed(2)})</div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      className="px-2 py-0.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded"
                                      title="Move to here"
                                      onClick={async () => {
                                        setSelectedGoalForAction(goal);
                                        await handleMoveToHere(goal);
                                      }}
                                    >Move</button>
                                    <button
                                      className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded"
                                      title="Edit"
                                      onClick={() => {
                                        setSelectedGoalForAction(goal);
                                        setShowEditModal(true);
                                      }}
                                    >Edit</button>
                                    <button
                                      className="px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded"
                                      title="Delete"
                                      onClick={async () => {
                                        setSelectedGoalForAction(goal);
                                        await handleDeletePose(goal);
                                      }}
                                    >Delete</button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        
                        {/* Cancel Move nút khi đang move */}
                        {isMoving && currentTarget && (
                          <div className="mt-3 p-2 bg-orange-50 rounded border border-orange-200">
                            <div className="text-xs text-orange-800 mb-1">
                              🚀 Moving to: <strong>{currentTarget.name}</strong>
                            </div>
                            <button
                              className="w-full px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded"
                              onClick={handleCancelMove}
                            >
                              Cancel Move
                            </button>
                          </div>
                        )}
                        
                        {/* Quick Info */}
                        <div className="text-center text-xs text-gray-500 mt-2">
                          {isAddPointMode ? (
                            <div className="bg-orange-50 border border-orange-200 rounded p-2">
                              <p className="text-orange-800 font-medium">🎯 ADD POINT MODE ACTIVE</p>
                              <p className="text-orange-600">Click on map to add new points</p>
                              <p className="text-orange-600">Press ESC to exit</p>
                            </div>
                          ) : (
                            <p>Click any point on map to select and edit</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Task Management Section */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <button
                      onClick={() => toggleSection('taskManagement')}
                      className="w-full p-2.5 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
                    >
                      <div className="flex items-center">
                        <Activity className="mr-2 text-blue-600" size={14} />
                        <span className="font-medium text-gray-800 text-xs">Task Management</span>
                      </div>
                      {expandedSections.taskManagement ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    {expandedSections.taskManagement && (
                      <div className="p-3 space-y-2 bg-white border-t border-gray-100">
                        <button className="w-full px-2.5 py-1.5 bg-gray-800 text-white rounded-md hover:bg-gray-900 text-xs font-medium transition-colors">
                          Multi-Point Task
                        </button>
                        <button className="w-full px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium transition-colors">
                          Schedule Task
                        </button>
                        <button className="w-full px-2.5 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-medium transition-colors">
                          Task History
                        </button>
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-md border border-gray-100">
                          🚧 Coming soon
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Robot Settings Section */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <button
                      onClick={() => toggleSection('robotSetting')}
                      className="w-full p-2.5 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
                    >
                      <div className="flex items-center">
                        <Settings className="mr-2 text-blue-600" size={14} />
                        <span className="font-medium text-gray-800 text-xs">Robot Settings</span>
                      </div>
                      {expandedSections.robotSetting ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    {expandedSections.robotSetting && (
                      <div className="p-3 space-y-3 bg-white border-t border-gray-100">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Linear: {maxLinear.toFixed(1)} m/s
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="2.0"
                            step="0.1"
                            value={maxLinear}
                            onChange={(e) => setMaxLinear(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Angular: {maxAngular.toFixed(1)} rad/s
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="3.0"
                            step="0.1"
                            value={maxAngular}
                            onChange={(e) => setMaxAngular(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                          />
                        </div>

                        <button className="w-full px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium transition-colors">
                          Apply Settings
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Current Map Info */}
                  {selectedMap && (
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                      <h3 className="font-medium text-gray-800 mb-1 text-xs">Active Map</h3>
                      <p className="text-xs text-gray-600 font-mono">{selectedMap}</p>
                      <div className="mt-1 text-xs text-gray-500">
                        Goals: {goals.length} | Mode: Edit
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Collapsed Panel - Icon Only */
                <div className="p-2 space-y-2">
                  <button
                    onClick={() => {
                      closeContextMenuOnAction();
                      setSidebarCollapsed(false);
                      setExpandedSections(prev => ({ ...prev, editMaps: true }));
                    }}
                    className="w-full p-2 rounded-lg hover:bg-gray-100 transition-colors text-blue-600"
                    title="Edit Maps"
                  >
                    <MapPin size={16} />
                  </button>
                  <button
                    onClick={() => {
                      closeContextMenuOnAction();
                      setSidebarCollapsed(false);
                      setExpandedSections(prev => ({ ...prev, taskManagement: true }));
                    }}
                    className="w-full p-2 rounded-lg hover:bg-gray-100 transition-colors text-blue-600"
                    title="Task Management"
                  >
                    <Activity size={16} />
                  </button>
                  <button
                    onClick={() => {
                      closeContextMenuOnAction();
                      setSidebarCollapsed(false);
                      setExpandedSections(prev => ({ ...prev, robotSetting: true }));
                    }}
                    className="w-full p-2 rounded-lg hover:bg-gray-100 transition-colors text-blue-600"
                    title="Robot Settings"
                  >
                    <Settings size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Building Tab - Map Management */}
        {activeTab === 'building' && (
          <div className="h-full relative">
            {/* Main Content Area - Empty for now, can add map preview later */}
            <div className="h-full p-6">
              {!localMapData ? (
                <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="mx-auto mb-4 text-gray-400" size={64} />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Map Management</h3>
                    <p className="text-gray-600 mb-4">Select a map or build a new one online</p>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="mx-auto mb-4 text-green-600" size={64} />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Map Loaded: {selectedMap}</h3>
                    <p className="text-gray-600 mb-4">Switch to Monitor or Operation tab to use this map</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleTabChange('monitor')}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                      >
                        Go to Monitor
                      </button>
                      <button
                        onClick={() => handleTabChange('operation')}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        Go to Operation
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Building Panel - Floating */}
            <div className={`fixed top-24 left-6 bg-white/95 backdrop-blur-sm shadow-xl rounded-xl border border-gray-200 transition-all duration-300 z-50 ${
              sidebarCollapsed ? 'w-14' : 'w-80'
            } max-h-[calc(100vh-120px)] overflow-hidden`}>
              {/* Panel Header */}
              <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50/80">
                {!sidebarCollapsed && (
                  <h2 className="font-semibold text-gray-800 text-sm flex items-center">
                    <MapPin className="mr-2 text-blue-600" size={16} />
                    Building Panel
                  </h2>
                )}
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-800"
                >
                  {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
              </div>

              {/* Panel Content */}
              {!sidebarCollapsed ? (
                <div className="overflow-y-auto max-h-[calc(100vh-180px)] p-3 space-y-3">
                  {/* Map Available Section */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <button
                      onClick={() => toggleSection('mapAvailable')}
                      className="w-full p-2.5 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
                    >
                      <div className="flex items-center">
                        <MapPin className="mr-2 text-blue-600" size={14} />
                        <span className="font-medium text-gray-800 text-xs">Map Available</span>
                      </div>
                      {expandedSections.mapAvailable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    {expandedSections.mapAvailable && (
                      <div className="p-3 space-y-3 bg-white border-t border-gray-100">
                        {/* Map Selection Component */}
                        <div className="space-y-2">
                          <MapSelector 
                            onMapLoad={handleMapLoad}
                            selectedMap={selectedMap}
                            onMapSelect={setSelectedMap}
                          />
                        </div>
                        
                        {/* Current Map Info */}
                        {selectedMap && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <h4 className="font-medium text-blue-800 text-xs mb-1">Current Map</h4>
                            <p className="text-blue-700 text-xs font-medium">{selectedMap}</p>
                            <p className="text-blue-600 text-xs mt-1">
                              Ready for navigation operations
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Build Map Online Section */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <button
                      onClick={() => toggleSection('buildMapOnline')}
                      className="w-full p-2.5 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
                    >
                      <div className="flex items-center">
                        <Activity className="mr-2 text-green-600" size={14} />
                        <span className="font-medium text-gray-800 text-xs">Build Map Online</span>
                      </div>
                      {expandedSections.buildMapOnline ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    {expandedSections.buildMapOnline && (
                      <div className="p-3 space-y-3 bg-white border-t border-gray-100">
                        {/* SLAM Mapping Button */}
                        {!isSLAMActive ? (
                          <button
                            onClick={handleStartSLAMMapping}
                            className="w-full px-3 py-2 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 transition-colors flex items-center justify-center"
                            title="Open SLAM mapping interface"
                          >
                            <Activity className="mr-2" size={14} />
                            Open SLAM Mapping
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <div className="px-3 py-2 bg-green-100 text-green-800 rounded-md text-xs font-medium text-center">
                              SLAM Mapping Active
                            </div>
                            <button
                              onClick={handleStopMapping}
                              className="w-full px-3 py-2 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 transition-colors flex items-center justify-center"
                              title="Stop SLAM mapping"
                            >
                              <Activity className="mr-2" size={14} />
                              Stop Mapping
                            </button>
                          </div>
                        )}
                        
                        {/* SLAM Information */}
                        <div className="p-2 bg-gray-50 rounded-md">
                          <h4 className="font-medium text-gray-800 text-xs mb-1">SLAM Mapping</h4>
                          <p className="text-gray-600 text-xs">
                            Real-time Simultaneous Localization and Mapping
                          </p>
                          <p className="text-blue-600 text-xs mt-1 font-medium">
                            • Real-time map building
                          </p>
                          <p className="text-blue-600 text-xs font-medium">
                            • Robot trajectory tracking  
                          </p>
                          <p className="text-blue-600 text-xs font-medium">
                            • Laser scan visualization
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Collapsed Icons */
                <div className="p-2 space-y-2">
                  <button
                    onClick={() => {
                      setSidebarCollapsed(false);
                      setExpandedSections(prev => ({ ...prev, mapAvailable: true }));
                    }}
                    className="w-full p-2 rounded-lg hover:bg-gray-100 transition-colors text-blue-600"
                    title="Map Available"
                  >
                    <MapPin size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setSidebarCollapsed(false);
                      setExpandedSections(prev => ({ ...prev, buildMapOnline: true }));
                    }}
                    className="w-full p-2 rounded-lg hover:bg-gray-100 transition-colors text-green-600"
                    title="Build Map Online"
                  >
                    <Activity size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="h-full p-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-6">System Settings</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      WebSocket URL
                    </label>
                    <input
                      type="text"
                      value={wsUrl}
                      onChange={(e) => setWsUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={getWebSocketUrl()}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Linear Speed: {maxLinear.toFixed(1)} m/s
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.1"
                      value={maxLinear}
                      onChange={(e) => setMaxLinear(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Angular Speed: {maxAngular.toFixed(1)} rad/s
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.1"
                      value={maxAngular}
                      onChange={(e) => setMaxAngular(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shared MapCanvas - rendered outside tabs to prevent remount */}
      {localMapData && (activeTab === 'monitor' || activeTab === 'operation') && (
        <div className="absolute inset-0 top-[80px] pointer-events-none">
          <div className="h-full p-6 pointer-events-auto">
            <MapCanvas
              ref={mapCanvasRef}
              mapData={localMapData}
              goals={goals}
              robotPose={amclPose || robotPose}
              onMapClick={handleMapClick}
              onGoalClick={handleGoalClick}
              onMouseMove={activeTab === 'operation' ? handleMouseMove : undefined}
              selectedGoalId={selectedGoalId}
              isAddPointMode={isAddPointMode}
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* Teleop Panel */}
      <TeleopPanel
        onVelocityChange={handleVelocityChange}
        maxLinear={maxLinear}
        maxAngular={maxAngular}

        isVisible={showTeleop}
        onToggleVisibility={() => setShowTeleop(!showTeleop)}
      />

      {/* Context Menu */}
      {contextMenu.isOpen && selectedGoalForAction && (
        <>

          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={handleCloseContextMenu}
            onMoveToHere={handleMoveToHere}
            onEditPose={handleEditPose}
            onDeletePose={handleDeletePose}
            onShowProperties={handleShowProperties}
            goalName={selectedGoalForAction.name}
          />
        </>
      )}

      {/* Edit Pose Modal */}
      {showEditModal && selectedGoalForAction && (
        <EditPoseModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          pose={selectedGoalForAction}
          onSave={handleSaveEditedPose}
        />
      )}

      {/* SLAM Mapping Panel Modal */}
      <SLAMMappingPanel 
        isOpen={showSLAMPanel}
        onClose={handleCloseSLAMPanel}
      />
      
      {/* Properties Modal */}
      {showPropertiesModal && selectedGoalForAction && (
        <PropertiesModal
          isOpen={showPropertiesModal}
          onClose={() => setShowPropertiesModal(false)}
          pose={selectedGoalForAction}
        />
      )}
    </div>
  );
}

export default App;