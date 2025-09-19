import { useState, useEffect } from 'react';
import { MapData } from '../../types/robot';
import { parsePgmFile, parseYamlMetadata } from '../../services/mapParser';
import { Folder, FileImage, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface MapFile {
  name: string;
  hasPgm: boolean;
  hasYaml: boolean;
  isValid: boolean;
}

interface MapSelectorProps {
  onMapLoad: (mapData: MapData) => void;
  selectedMap: string | null;
  onMapSelect: (mapName: string | null) => void;
}

export function MapSelector({ onMapLoad, selectedMap, onMapSelect }: MapSelectorProps) {
  const [mapFiles, setMapFiles] = useState<MapFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMap, setLoadingMap] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const MAP_DIRECTORY = '/hover_board/src/nav2_hover/nav2_hoveramr/map';
  

  // Scan thư mục maps THẬT từ server
  const scanMapDirectory = async () => {
    setLoading(true);
    setError(null);

    try {
      // console.log(`📂 Scanning REAL map directory via server: ${MAP_DIRECTORY}`);
      
      // Gọi API thật để scan directory
      const response = await fetch('http://localhost:3001/api/scan-maps');
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const files = await response.json();
      // console.log('✅ REAL files found from server:', files);
      
      // Group files theo tên base
      const fileGroups: { [key: string]: MapFile } = {};
      
      files.forEach((filename: string) => {
        const baseName = filename.replace(/\.(pgm|yaml)$/, '');
        const extension = filename.split('.').pop()?.toLowerCase();

        if (!fileGroups[baseName]) {
          fileGroups[baseName] = {
            name: baseName,
            hasPgm: false,
            hasYaml: false,
            isValid: false
          };
        }

        if (extension === 'pgm') {
          fileGroups[baseName].hasPgm = true;
        } else if (extension === 'yaml') {
          fileGroups[baseName].hasYaml = true;
        }
      });

      // Chỉ giữ các map có cả pgm và yaml
      const validMaps = Object.values(fileGroups)
        .map(map => ({
          ...map,
          isValid: map.hasPgm && map.hasYaml
        }))
        .filter(map => map.isValid)
        .sort((a, b) => a.name.localeCompare(b.name));

      // console.log('✅ Valid REAL map pairs found:', validMaps.map(m => `${m.name} (${m.hasPgm ? 'PGM' : ''} ${m.hasYaml ? 'YAML' : ''})`));
      setMapFiles(validMaps);
      
    } catch (err) {
      console.error('❌ Error scanning REAL map directory:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Cannot connect to map server: ${errorMessage}. Make sure to run: node mapServer.cjs`);
    } finally {
      setLoading(false);
    }
  };

  // Load map THẬT từ server - CHỈ sử dụng file thực, KHÔNG có mock data
  const loadMap = async (mapName: string) => {
    setLoadingMap(mapName);
    setError(null);

    try {
      // console.log(`📂 Loading REAL map: ${mapName} from ${MAP_DIRECTORY}`);
      
      const [pgmResponse, yamlResponse] = await Promise.all([
        fetch(`http://localhost:3001/api/maps/${mapName}.pgm`),
        fetch(`http://localhost:3001/api/maps/${mapName}.yaml`)
      ]);

      if (!pgmResponse.ok) {
        throw new Error(`Failed to load PGM: ${pgmResponse.status} ${pgmResponse.statusText}`);
      }
      
      if (!yamlResponse.ok) {
        throw new Error(`Failed to load YAML: ${yamlResponse.status} ${yamlResponse.statusText}`);
      }

      const pgmArrayBuffer = await pgmResponse.arrayBuffer();
      const yamlText = await yamlResponse.text();

      // console.log('✅ REAL files loaded:', {
      //   pgmSize: pgmArrayBuffer.byteLength,
      //   yamlSize: yamlText.length,
      //   source: `Real files from ${MAP_DIRECTORY}`
      // });

      // Create File objects for mapParser
      const pgmFile = new File([pgmArrayBuffer], `${mapName}.pgm`, { 
        type: 'image/x-portable-graymap'
      });
      const yamlFile = new File([yamlText], `${mapName}.yaml`, { 
        type: 'text/yaml'
      });

      // console.log('🔄 Processing REAL files with mapParser...');
      
      const mapData = await parsePgmFile(pgmFile);
      const yamlMetadata = await parseYamlMetadata(yamlFile);
      
      const finalMapData: MapData = {
        ...mapData,
        resolution: yamlMetadata.resolution || mapData.resolution,
        origin: yamlMetadata.origin || mapData.origin,
        metadata: {
          image: `${mapName}.pgm`,
          resolution: yamlMetadata.resolution || mapData.resolution || 0.05,
          origin: yamlMetadata.origin || mapData.origin || [0, 0, 0],
          negate: (yamlMetadata.metadata?.negate) || 0,
          occupied_thresh: (yamlMetadata.metadata?.occupied_thresh) || 0.65,
          free_thresh: (yamlMetadata.metadata?.free_thresh) || 0.196
        }
      };

      // console.log('🎉 REAL map processed:', {
      //   name: mapName,
      //   size: `${finalMapData.width}x${finalMapData.height}`,
      //   resolution: finalMapData.resolution,
      //   origin: finalMapData.origin
      // });

      onMapLoad(finalMapData);
      onMapSelect(mapName);
      
    } catch (err) {
      console.error('❌ Error loading REAL map:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      
      if (errorMsg.includes('fetch')) {
        setError(`Map server not running. Please run: node mapServer.cjs\n\nError: ${errorMsg}`);
      } else {
        setError(`Failed to load map: ${errorMsg}`);
      }
    } finally {
      setLoadingMap(null);
    }
  };

  // Load maps khi component mount
  useEffect(() => {
    scanMapDirectory();
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <Folder className="mr-2" size={20} />
          System Maps
        </h2>
        <button
          onClick={scanMapDirectory}
          disabled={loading}
          className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center text-sm"
        >
          {loading ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
          Refresh
        </button>
      </div>

      {/* Directory Path */}
      <div className="bg-gray-100 p-3 rounded-lg">
        <p className="text-sm text-gray-600 font-mono">{MAP_DIRECTORY}</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center">
          <AlertCircle className="text-red-500 mr-2" size={16} />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Maps List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin mr-2" size={20} />
            <span className="text-gray-600">Scanning maps...</span>
          </div>
        ) : mapFiles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileImage size={48} className="mx-auto mb-2 opacity-50" />
            <p>No valid maps found</p>
            <p className="text-sm">Maps require both .pgm and .yaml files</p>
          </div>
        ) : (
          mapFiles.map((map) => (
            <div
              key={map.name}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedMap === map.name
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => loadMap(map.name)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileImage className="text-blue-500 mr-3" size={20} />
                  <div>
                    <h3 className="font-medium text-gray-800">{map.name}</h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span className="flex items-center">
                        <CheckCircle className="text-green-500 mr-1" size={12} />
                        PGM + YAML
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  {loadingMap === map.name && (
                    <Loader2 className="animate-spin text-blue-500 mr-2" size={16} />
                  )}
                  {selectedMap === map.name && (
                    <CheckCircle className="text-blue-500" size={20} />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Selected Map Info */}
      {selectedMap && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center">
            <CheckCircle className="text-green-500 mr-2" size={16} />
            <span className="text-green-700 font-medium">Active Map: {selectedMap}</span>
          </div>
        </div>
      )}
    </div>
  );
}