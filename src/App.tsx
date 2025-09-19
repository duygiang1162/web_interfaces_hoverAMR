import { useState, useEffect } from 'react';
import { MapCanvas } from './components/Map/MapCanvas';
import { MapSelector } from './components/Map/MapSelector';
import { TeleopPanel } from './components/Teleop/TeleopPanel';
import { GoalManager } from './components/Goals/GoalManager';
import { useWebSocket } from './hooks/useWebSocket';
import { GoalPoint, MapData } from './types/robot';
import { StorageService } from './utils/storage';
import { Wifi, WifiOff, Activity, MapPin, Settings, Monitor, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

function App() {
  // State management
  const [goals, setGoals] = useState<GoalPoint[]>([]);
  const [showTeleop, setShowTeleop] = useState(false); // Mặc định đóng Remote Control
  const [activeTab, setActiveTab] = useState<'monitor' | 'operation' | 'building' | 'settings'>('monitor');
  const [maxLinear, setMaxLinear] = useState(0.5);
  const [maxAngular, setMaxAngular] = useState(0.5);
  const [wsUrl, setWsUrl] = useState('ws://192.168.51.134:9090');
  const [localMapData, setLocalMapData] = useState<MapData | null>(null);
  const [selectedMap, setSelectedMap] = useState<string | null>(null); // Track selected map
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  
  // Sidebar state for Operation tab
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    editMaps: true,
    taskManagement: false,
    robotSetting: false
  });

  // Sidebar helper functions
  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Goal editing handlers
  const handleGoalClick = (goalId: string) => {
    setSelectedGoalId(goalId);
    console.log('Goal selected:', goalId);
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
  const { connected, robotPose, sendVelocityCommand, sendGoal } = useWebSocket(wsUrl);

  // Handle map loading from files
  const handleMapLoad = (mapData: MapData) => {
    setLocalMapData(mapData);
    console.log('Map loaded into app:', {
      size: `${mapData.width}x${mapData.height}`,
      resolution: mapData.resolution,
      origin: mapData.origin
    });
  };

  // Load saved goals khi app khởi động
  useEffect(() => {
    const savedGoals = StorageService.loadGoals();
    setGoals(savedGoals);
  }, []);

  // Handle map click để tạo goal
  const handleMapClick = (worldX: number, worldY: number) => {
    const goalName = `Goal ${goals.length + 1}`;
    const newGoal: GoalPoint = {
      id: `goal-${Date.now()}`,
      name: goalName,
      x: worldX,
      y: worldY,
      timestamp: Date.now()
    };

    StorageService.addGoal(newGoal);
    setGoals([...goals, newGoal]);
  };

  // Handle velocity control
  const handleVelocityChange = (linear: number, angular: number) => {
    sendVelocityCommand(linear, angular);
  };

  // Handle send goal
  const handleSendGoal = (x: number, y: number) => {
    sendGoal(x, y);
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
                onClick={() => setActiveTab('monitor')}
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
                onClick={() => setActiveTab('operation')}
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
                onClick={() => setActiveTab('building')}
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
                onClick={() => setActiveTab('settings')}
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

      {/* Main Content Area */}
      <div className="h-[calc(100vh-80px)]">
        {/* Monitor Tab - Map View with Floating Panels */}
        {activeTab === 'monitor' && (
          <div className="h-full relative">
            {/* Main Map Canvas */}
            <div className="h-full p-6">
              {localMapData ? (
                <MapCanvas
                  mapData={localMapData}
                  robotPose={robotPose}
                  goals={goals}
                  onMapClick={handleMapClick}
                  onGoalClick={handleGoalClick}
                  selectedGoalId={selectedGoalId}
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Monitor className="mx-auto mb-4 text-gray-400" size={64} />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No Map Selected</h3>
                    <p className="text-gray-600 mb-4">Please select a map from the Building tab to start monitoring</p>
                    <button
                      onClick={() => setActiveTab('building')}
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
                <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 pointer-events-auto min-w-64">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                    <MapPin className="mr-2" size={16} />
                    Map Status
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>Name:</strong> {selectedMap || 'Unknown'}</p>
                    <p><strong>Size:</strong> {localMapData.width} x {localMapData.height} px</p>
                    <p><strong>Resolution:</strong> {localMapData.resolution} m/px</p>
                  </div>
                </div>
              )}

              {/* Robot Position Panel */}
              {robotPose && (
                <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 pointer-events-auto min-w-64">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                    <Activity className="mr-2" size={16} />
                    Robot Position
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>X:</strong> {robotPose.position.x.toFixed(2)} m</p>
                    <p><strong>Y:</strong> {robotPose.position.y.toFixed(2)} m</p>
                    <p><strong>Heading:</strong> {(2 * Math.atan2(robotPose.orientation.z, robotPose.orientation.w) * 180 / Math.PI).toFixed(1)}°</p>
                  </div>
                </div>
              )}
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
                    onClick={() => setShowTeleop(!showTeleop)}
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
            {/* Full Screen Map Canvas */}
            <div className="h-full p-6">
              {localMapData ? (
                <MapCanvas
                  mapData={localMapData}
                  robotPose={robotPose}
                  goals={goals}
                  onMapClick={handleMapClick}
                  onGoalClick={handleGoalClick}
                  selectedGoalId={selectedGoalId}
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="mx-auto mb-4 text-gray-400" size={64} />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No Map Selected</h3>
                    <p className="text-gray-600 mb-4">Please select a map from the Building tab to start operations</p>
                    <button
                      onClick={() => setActiveTab('building')}
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
                      <div className="p-3 space-y-2 bg-white border-t border-gray-100">
                        <button
                          onClick={() => console.log('Add Point mode activated - click on map')}
                          className="w-full px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium transition-colors"
                        >
                          Add Point
                        </button>
                        <button
                          onClick={handleEditSelectedGoal}
                          disabled={!selectedGoalId}
                          className={`w-full px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            selectedGoalId 
                              ? 'bg-gray-800 text-white hover:bg-gray-900' 
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          Edit Selected
                        </button>
                        <button
                          onClick={handleDeleteSelectedGoal}
                          disabled={!selectedGoalId}
                          className={`w-full px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            selectedGoalId 
                              ? 'bg-red-600 text-white hover:bg-red-700' 
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          Delete Selected
                        </button>
                        
                        {/* Selected Goal Info */}
                        {selectedGoalId && (
                          <div className="mt-2 p-2 bg-blue-50 rounded-md text-xs border border-blue-100">
                            <p className="font-medium text-blue-800 mb-1">Selected Goal:</p>
                            {(() => {
                              const goal = goals.find(g => g.id === selectedGoalId);
                              return goal ? (
                                <div className="space-y-0.5 text-blue-700">
                                  <p><span className="font-medium">Name:</span> {goal.name}</p>
                                  <p><span className="font-medium">Position:</span> ({goal.x.toFixed(2)}, {goal.y.toFixed(2)})</p>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}
                        
                        <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded-md border border-blue-100">
                          💡 Click on map to add goals
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

        {/* Building Tab - Map Selection & Goal Management */}
        {activeTab === 'building' && (
          <div className="h-full flex">
            {/* Left Sidebar - Map Selection */}
            <div className="w-96 bg-white border-r shadow-sm overflow-y-auto">
              <div className="p-4">
                <MapSelector 
                  onMapLoad={handleMapLoad}
                  selectedMap={selectedMap}
                  onMapSelect={setSelectedMap}
                />
              </div>
            </div>

            {/* Right Side - Goal Management */}
            <div className="flex-1 p-6">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Goal Management</h2>
                  <GoalManager
                    goals={goals}
                    onGoalsChange={setGoals}
                    onSendGoal={handleSendGoal}
                  />
                  
                  {selectedMap && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-medium text-blue-800 mb-2">Current Map: {selectedMap}</h3>
                      <p className="text-blue-700 text-sm">
                        Goals will be saved for this map. Switch to Monitor tab to see them on the map.
                      </p>
                    </div>
                  )}
                </div>
              </div>
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
                      placeholder="ws://192.168.51.134:9090"
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

      {/* Teleop Panel */}
      <TeleopPanel
        onVelocityChange={handleVelocityChange}
        maxLinear={maxLinear}
        maxAngular={maxAngular}
        isVisible={showTeleop}
        onToggleVisibility={() => setShowTeleop(!showTeleop)}
      />
    </div>
  );
}

export default App;