import React, { useState, useRef } from 'react';
import { Upload, FileText, Image, AlertCircle, CheckCircle, X } from 'lucide-react';
import { MapData } from '../../types/robot';
import { MapParser } from '../../services/mapParser';

interface MapUploaderProps {
  onMapLoad: (mapData: MapData) => void;
  className?: string;
}

interface FileState {
  pgmFile: File | null;
  yamlFile: File | null;
}

export function MapUploader({ onMapLoad, className }: MapUploaderProps) {
  const [files, setFiles] = useState<FileState>({ pgmFile: null, yamlFile: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles = { ...files };
    
    Array.from(selectedFiles).forEach(file => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (extension === 'pgm') {
        newFiles.pgmFile = file;
      } else if (extension === 'yaml' || extension === 'yml') {
        newFiles.yamlFile = file;
      }
    });

    setFiles(newFiles);
    setError(null);
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // Load map from files
  const handleLoadMap = async () => {
    if (!files.pgmFile) {
      setError('Vui lòng chọn file PGM');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Starting map load with files:', {
        pgm: files.pgmFile.name,
        pgmSize: files.pgmFile.size,
        pgmType: files.pgmFile.type,
        yaml: files.yamlFile?.name,
        yamlSize: files.yamlFile?.size
      });

      const mapData = await MapParser.loadMapFromFiles(files.pgmFile, files.yamlFile);
      onMapLoad(mapData);
      console.log('Map loaded successfully:', {
        size: `${mapData.width}x${mapData.height}`,
        resolution: mapData.resolution,
        origin: mapData.origin
      });
    } catch (err) {
      console.error('Map loading failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Lỗi khi load map: ${errorMessage}`);
      
      // Additional debugging info
      console.error('File details:', {
        pgmFile: {
          name: files.pgmFile.name,
          size: files.pgmFile.size,
          type: files.pgmFile.type,
          lastModified: files.pgmFile.lastModified
        },
        yamlFile: files.yamlFile ? {
          name: files.yamlFile.name,
          size: files.yamlFile.size,
          type: files.yamlFile.type
        } : null
      });
    } finally {
      setLoading(false);
    }
  };

  // Remove file
  const removeFile = (type: 'pgmFile' | 'yamlFile') => {
    setFiles(prev => ({ ...prev, [type]: null }));
  };

  // Clear all files
  const clearAll = () => {
    setFiles({ pgmFile: null, yamlFile: null });
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pgm,.yaml,.yml"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        
        <Upload className="mx-auto mb-4 text-gray-400" size={48} />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Upload Map Files
        </h3>
        <p className="text-gray-600 mb-4">
          Kéo thả hoặc click để chọn file PGM và YAML
        </p>
        <p className="text-sm text-gray-500">
          Hỗ trợ: .pgm (required), .yaml/.yml (optional)
        </p>
      </div>

      {/* File list */}
      {(files.pgmFile || files.yamlFile) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-700">Files đã chọn:</h4>
            <button
              onClick={clearAll}
              className="text-gray-400 hover:text-gray-600 p-1"
              title="Clear all files"
            >
              <X size={16} />
            </button>
          </div>

          {files.pgmFile && (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <Image className="text-green-600" size={20} />
                <div>
                  <p className="font-medium text-green-800">{files.pgmFile.name}</p>
                  <p className="text-sm text-green-600">
                    PGM Map • {(files.pgmFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile('pgmFile')}
                className="text-green-400 hover:text-green-600 p-1"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {files.yamlFile && (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className="text-blue-600" size={20} />
                <div>
                  <p className="font-medium text-blue-800">{files.yamlFile.name}</p>
                  <p className="text-sm text-blue-600">
                    YAML Metadata • {(files.yamlFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile('yamlFile')}
                className="text-blue-400 hover:text-blue-600 p-1"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Load button */}
      <button
        onClick={handleLoadMap}
        disabled={!files.pgmFile || loading}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          files.pgmFile && !loading
            ? 'bg-blue-500 hover:bg-blue-600 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Đang load map...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-2">
            <CheckCircle size={20} />
            <span>Load Map</span>
          </div>
        )}
      </button>

      {/* Instructions */}
      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>PGM file:</strong> Binary grayscale image chứa occupancy grid data</p>
        <p><strong>YAML file:</strong> Metadata chứa resolution, origin và các thông số khác</p>
        <p><strong>Lưu ý:</strong> YAML file là optional, nếu không có sẽ dùng default values</p>
      </div>
    </div>
  );
}