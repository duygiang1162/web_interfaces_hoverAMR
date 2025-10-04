import React, { useState, useEffect } from 'react';
import { SLAMMapCanvas } from '../Map/SLAMMapCanvas';
import { TeleopPanel } from '../Teleop/TeleopPanel';
import { useWebSocket } from '../../hooks/useWebSocket';
import { getApiUrl } from '../../config/endpoints';

interface SLAMMappingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SLAMControlState {
  isActive: boolean;
  mode: 'cartographer' | 'slam_toolbox' | 'gmapping';
  status: 'idle' | 'starting' | 'mapping' | 'stopping' | 'saving';
  mapName: string;
  currentStats: MappingStats | null;
}

interface MappingStats {
  mapSize: { width: number; height: number };
  resolution: number;
  exploredCells: number;
  totalCells: number;
  knownCells: number;
  unknownCells: number;
  freeCells: number;
  occupiedCells: number;
  explorationPercentage: number;
}

export function SLAMMappingPanel({ isOpen, onClose }: SLAMMappingPanelProps) {
  const { connected, sendVelocityCommand, odomPose } = useWebSocket(); // Will use config automatically
  
  const [slamControl, setSlamControl] = useState<SLAMControlState>({
    isActive: false,
    mode: 'cartographer',
    status: 'idle',
    mapName: `map_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}`,
    currentStats: null
  });
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mappingDuration, setMappingDuration] = useState(0);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [isTeleopVisible, setIsTeleopVisible] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    nav2: { running: false, available: false, pids: [] },
    slam: { running: false, pids: [] },
    recommendations: {
      can_start_nav2: true,
      can_stop_nav2: false,
      can_start_slam: false,
      can_stop_slam: false
    }
  });
  const [nav2Status, setNav2Status] = useState('idle'); // idle, starting, running, stopping

  // Start mapping timer when active
  useEffect(() => {
    if (slamControl.isActive && slamControl.status === 'mapping') {
      const id = setInterval(() => {
        setMappingDuration(prev => prev + 1);
      }, 1000);
      setIntervalId(id);
      
      return () => {
        if (id) clearInterval(id);
      };
    } else {
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
      if (!slamControl.isActive) {
        setMappingDuration(0);
      }
    }
  }, [slamControl.isActive, slamControl.status]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle SLAM mode change
  const handleModeChange = (mode: SLAMControlState['mode']) => {
    if (slamControl.isActive) return; // Can't change mode while active
    setSlamControl(prev => ({ ...prev, mode }));
  };

  // Start SLAM mapping
  const handleStartMapping = async () => {
    try {
      setSlamControl(prev => ({ ...prev, status: 'starting' }));
      
      
      try {
        const stopNav2Response = await fetch(getApiUrl('/stop_nav2'), {

          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        
        const stopResult = await stopNav2Response.json();
        console.log('🔴 Nav2 Stop Response:', stopResult);
        
        // Wait a bit for Nav2 to fully stop
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (stopError) {
        console.warn('⚠️ Failed to stop Nav2 (continuing anyway):', stopError);
      }
      
      // Step 2: Start SLAM mapping
      console.log('🚀 Starting SLAM mapping...');
      const response = await fetch(getApiUrl('/start_slam'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ algorithm: slamControl.mode })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to start SLAM mapping');
      }
      
      console.log('\u2705 SLAM API Response:', result);
      
      setSlamControl(prev => ({ 
        ...prev, 
        isActive: true, 
        status: 'mapping' 
      }));
      
      console.log('🎯 Nav2 stopped and SLAM mapping started:', slamControl.mode);
      
    } catch (error) {
      console.error('❌ Failed to stop Nav2 & start SLAM mapping:', error);
      setSlamControl(prev => ({ ...prev, status: 'idle' }));
      alert('Failed to stop Nav2 & start SLAM mapping. Check console for details.');
    }
  };



  // Stop and save map
  const handleStopAndSave = async () => {
    try {
      setSlamControl(prev => ({ ...prev, status: 'saving' }));
      
      // Call backend API to stop SLAM and save map
      const response = await fetch(getApiUrl('/stop_slam'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          save_map: true, 
          map_name: slamControl.mapName,
          map_path: '/hover_board/src/nav2_hover/nav2_hoveramr/map' 
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.warn('Stop SLAM API failed:', result.error);
      } else {
        console.log('✅ SLAM Stop API Response:', result);
      }
      
      // Always reset to idle state and show success message regardless of backend response
      setSlamControl(prev => ({ 
        ...prev, 
        isActive: false, 
        status: 'idle' 
      }));
      
      // Update system status immediately for UI responsiveness
      setSystemStatus(prev => ({
        ...prev,
        slam: { ...prev.slam, running: false }
      }));
      
      console.log('💾 Stop & Save command sent:', slamControl.mapName);
      alert(`Stop & Save command executed for map: ${slamControl.mapName}`);
      
    } catch (error) {
      console.error('❌ Failed to send stop command:', error);
      // Still reset state even if network error
      setSlamControl(prev => ({ 
        ...prev, 
        isActive: false, 
        status: 'idle' 
      }));
      alert('Stop & Save command sent (network error occurred)');
    }
  };

  // Emergency stop
  const handleEmergencyStop = async () => {
    try {
      setSlamControl(prev => ({ ...prev, status: 'stopping' }));
      
      // Call backend API for emergency stop
      const response = await fetch(getApiUrl('/stop_slam'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ save_map: false })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.warn('Emergency stop API failed:', result.error);
      } else {
        console.log('⚠️ Emergency Stop API Response:', result);
      }
      
      // Always reset to idle state regardless of backend response
      setSlamControl(prev => ({ 
        ...prev, 
        isActive: false, 
        status: 'idle' 
      }));
      
      console.log('⚠️ Emergency stop command sent');
      
    } catch (error) {
      console.error('❌ Emergency stop network error:', error);
      // Still reset state even if network error
      setSlamControl(prev => ({ 
        ...prev, 
        isActive: false, 
        status: 'idle' 
      }));
    }
  };

  // Handle mapping stats update
  const handleMappingStatsUpdate = (stats: MappingStats) => {
    setSlamControl(prev => ({ ...prev, currentStats: stats }));
  };

  // Handle velocity commands from remote control
  const handleVelocityChange = (linear: number, angular: number) => {
    console.log(`🎮 Velocity command from TeleopPanel: linear=${linear.toFixed(2)}, angular=${angular.toFixed(2)}`);
    if (connected) {
      sendVelocityCommand(linear, angular);
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send velocity command');
    }
  };

  // Fetch system status
  const fetchSystemStatus = async () => {
    try {
      const response = await fetch(getApiUrl('/system_status'));
      const result = await response.json();
      
      if (response.ok && result.success) {
        setSystemStatus(result.data);
        
        // Sync nav2Status with system status
        if (result.data.nav2.running && nav2Status !== 'running') {
          setNav2Status('running');
        } else if (!result.data.nav2.running && nav2Status === 'running') {
          setNav2Status('idle');
        }
        
        // console.log('📊 System Status:', result.data);
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch system status:', error);
    }
  };

  // Fetch system status on mount and periodically
  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Start Nav2 navigation stack
  const handleStartNav2 = async () => {
    try {
      setNav2Status('starting');
      console.log('🚀 Starting Nav2 navigation stack...');
      
      const response = await fetch(getApiUrl('/start_nav2'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to start Nav2');
      }
      
      console.log('✅ Nav2 started successfully:', result);
      setNav2Status('running');
      
      // Update system status immediately for UI responsiveness
      setSystemStatus(prev => ({
        ...prev,
        nav2: { ...prev.nav2, running: true }
      }));
      
      alert('Nav2 navigation stack started successfully!');
      
      // Refresh system status
      setTimeout(fetchSystemStatus, 1000);
      
    } catch (error) {
      console.error('❌ Failed to start Nav2:', error);
      setNav2Status('idle');
      alert('Failed to start Nav2. Check console for details.');
    }
  };

  // Stop Nav2 stack only
  const handleStopNav2 = async () => {
    try {
      setNav2Status('stopping');
      console.log('🛑 Stopping Nav2 stack...');
      
      const response = await fetch(getApiUrl('/stop_nav2'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const result = await response.json();
      console.log('🔴 Nav2 Stop Response:', result);
      
      if (result.success) {
        alert('Nav2 stack stopped successfully!');
      } else {
        alert('Nav2 stop command executed (check logs)');
      }
      
      setNav2Status('idle');
      
      // Update system status immediately for UI responsiveness
      setSystemStatus(prev => ({
        ...prev,
        nav2: { ...prev.nav2, running: false }
      }));
      
      // Refresh system status
      setTimeout(fetchSystemStatus, 1000);
      
    } catch (error) {
      console.error('❌ Failed to stop Nav2:', error);
      setNav2Status('idle');
      alert('Failed to stop Nav2. Check console for details.');
    }
  };



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">Build Map Online - SLAM Mapping</h2>
            <p className="text-sm text-gray-600">Real-time Simultaneous Localization and Mapping</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <span className="text-xl">&times;</span>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Control Panel */}
          <div className="w-80 bg-gray-50 border-r p-4 overflow-y-auto">
            {/* SLAM Mode Selection */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">SLAM Algorithm</h3>
              <div className="space-y-2">
                {(['cartographer', 'slam_toolbox', 'gmapping'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                    disabled={slamControl.isActive}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      slamControl.mode === mode
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white hover:bg-gray-50 border-gray-200'
                    } ${slamControl.isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="font-medium">
                      {mode === 'cartographer' && 'Google Cartographer'}
                      {mode === 'slam_toolbox' && 'SLAM Toolbox'}
                      {mode === 'gmapping' && 'GMapping'}
                    </div>
                    <div className="text-xs opacity-75 mt-1">
                      {mode === 'cartographer' && 'Real-time 2D SLAM with loop closure'}
                      {mode === 'slam_toolbox' && 'Flexible SLAM with localization modes'}
                      {mode === 'gmapping' && 'Classic particle filter SLAM'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">System Control</h3>
              
              <div className="space-y-2">
                {/* Nav2 Controls */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleStartNav2}
                    disabled={nav2Status === 'starting' || systemStatus.nav2.running || systemStatus.slam.running}
                    className={`p-2 rounded-lg text-sm transition-colors ${
                      nav2Status !== 'starting' && !systemStatus.nav2.running && !systemStatus.slam.running
                        ? 'bg-blue-500 hover:bg-blue-600 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {nav2Status === 'starting' ? 'Starting...' : 'Start Nav2'}
                  </button>
                  
                  <button
                    onClick={handleStopNav2}
                    disabled={nav2Status === 'stopping' || !systemStatus.nav2.running}
                    className={`p-2 rounded-lg text-sm transition-colors ${
                      nav2Status !== 'stopping' && systemStatus.nav2.running
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {nav2Status === 'stopping' ? 'Stopping...' : 'Stop Nav2'}
                  </button>
                </div>

                {/* SLAM Controls */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleStartMapping}
                    disabled={slamControl.status === 'starting' || systemStatus.slam.running || systemStatus.nav2.running}
                    className={`p-2 rounded-lg text-sm transition-colors ${
                      slamControl.status !== 'starting' && !systemStatus.slam.running && !systemStatus.nav2.running
                        ? 'bg-blue-500 hover:bg-blue-600 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {slamControl.status === 'starting' ? 'Starting...' : 'Start Mapping'}
                  </button>
                  
                  <button
                    onClick={handleStopAndSave}
                    disabled={slamControl.status === 'saving' || !systemStatus.slam.running}
                    className={`p-2 rounded-lg text-sm transition-colors ${
                      slamControl.status !== 'saving' && systemStatus.slam.running
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {slamControl.status === 'saving' ? 'Saving...' : 'Stop & Save Map'}
                  </button>
                </div>
                
                {/* Emergency Stop */}
                <button
                  onClick={handleEmergencyStop}
                  disabled={slamControl.status === 'stopping'}
                  className="w-full p-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-lg text-sm transition-colors"
                >
                  {slamControl.status === 'stopping' ? 'Stopping...' : 'Emergency Stop'}
                </button>
              </div>
            </div>

            {/* System Status Information */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">System Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Nav2:</span>
                  <span className={`font-medium ${
                    nav2Status === 'starting' || nav2Status === 'stopping' ? 'text-red-600' :
                    systemStatus.nav2.running ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                    {nav2Status === 'starting' ? 'Starting...' :
                     nav2Status === 'stopping' ? 'Stopping...' :
                     systemStatus.nav2.running ? 'Running' : 'Stopped'}
                    {systemStatus.nav2.pids.length > 0 && ` (${systemStatus.nav2.pids.length} processes)`}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span>SLAM:</span>
                  <span className={`font-medium ${
                    systemStatus.slam.running ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                    {systemStatus.slam.running ? 'Running' : 'Stopped'}
                    {systemStatus.slam.pids.length > 0 && ` (${systemStatus.slam.pids.length} processes)`}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span>Mapping:</span>
                  <span className={`font-medium ${
                    slamControl.status === 'mapping' ? 'text-blue-600' :
                    slamControl.status === 'idle' ? 'text-gray-600' :
                    'text-red-600'
                  }`}>
                    {slamControl.status.charAt(0).toUpperCase() + slamControl.status.slice(1)}
                  </span>
                </div>
                
                {slamControl.isActive && (
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-mono">{formatDuration(mappingDuration)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span>Algorithm:</span>
                  <span className="font-medium">{slamControl.mode}</span>
                </div>
              </div>
            </div>

            {/* Mapping Statistics */}
            {slamControl.currentStats && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Mapping Progress</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Map Size:</span>
                    <span>{slamControl.currentStats.mapSize.width}×{slamControl.currentStats.mapSize.height}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Resolution:</span>
                    <span>{slamControl.currentStats.resolution.toFixed(3)}m/px</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Explored:</span>
                    <span className="font-medium text-blue-600">
                      {slamControl.currentStats.explorationPercentage.toFixed(1)}%
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, slamControl.currentStats.explorationPercentage)}%` 
                      }}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="font-medium">{slamControl.currentStats.freeCells.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Free</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="font-medium">{slamControl.currentStats.occupiedCells.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Occupied</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Map Name Input */}
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Map Name</h3>
              <input
                type="text"
                value={slamControl.mapName}
                onChange={(e) => setSlamControl(prev => ({ ...prev, mapName: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg"
                placeholder="Enter map name"
              />
            </div>

            {/* Advanced Settings */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full p-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg"
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
              </button>
              
              {showAdvanced && (
                <div className="mt-2 p-3 bg-white rounded border text-xs space-y-2">
                  <div>
                    <label className="block text-gray-600 mb-1">Update Rate (Hz)</label>
                    <input type="number" defaultValue="10" min="1" max="50" 
                           className="w-full p-1 border rounded" />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">Max Range (m)</label>
                    <input type="number" defaultValue="12.0" min="1" max="50" step="0.1"
                           className="w-full p-1 border rounded" />
                  </div>
                  <div>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span>Loop Closure Detection</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SLAM Map Visualization + Remote Control */}
          <div className="flex-1 relative">
            <SLAMMapCanvas
              className="w-full h-full"
              showRobotTrajectory={true}
              showLaserScan={true}
              showCoordinateFrames={false}
              robotPose={odomPose}
              onMappingStatsUpdate={handleMappingStatsUpdate}
            />

            {/* Remote control panel - always show bottom right */}
            <div className="absolute bottom-4 right-4 z-50">
              <TeleopPanel
                onVelocityChange={handleVelocityChange}
                maxLinear={0.5}
                maxAngular={0.5}
                isVisible={isTeleopVisible}
                onToggleVisibility={() => setIsTeleopVisible(!isTeleopVisible)}
                publishRate={20}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}