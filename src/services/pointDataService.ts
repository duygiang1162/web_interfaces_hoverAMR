import { GoalPoint } from '../types/robot';

interface MapPointData {
  mapName: string;
  mapPath?: string;
  points: GoalPoint[];
  createdAt: string;
  updatedAt: string;
}

interface PointDataFile {
  version: string;
  maps: MapPointData[];
}

export class PointDataService {
  private static readonly DATA_FILE_PATH = './map_points_data.json';
  private static readonly VERSION = '1.0.0';

  // Load all map point data from file
  static async loadMapPointData(): Promise<PointDataFile> {
    try {
      console.log('🔄 Loading point data from server...');
      const response = await fetch('http://localhost:3001/api/load-point-data', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Point data loaded:', data);
        return data;
      } else {
        console.warn('⚠️ Point data file not found, using default structure');
        // Return default structure if file doesn't exist
        return {
          version: this.VERSION,
          maps: []
        };
      }
    } catch (error) {
      console.warn('❌ Could not load point data, using default:', error);
      return {
        version: this.VERSION,
        maps: []
      };
    }
  }

  // Save all map point data to file
  static async saveMapPointData(data: PointDataFile): Promise<boolean> {
    try {
      console.log('💾 Saving point data to server:', data);
      const response = await fetch('http://localhost:3001/api/save-point-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data, null, 2),
      });
      
      if (response.ok) {
        console.log('✅ Point data saved successfully');
        return true;
      } else {
        console.error('❌ Failed to save point data:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to save point data:', error);
      return false;
    }
  }

  // Get points for a specific map
  static async getPointsForMap(mapName: string): Promise<GoalPoint[]> {
    const data = await this.loadMapPointData();
    const mapData = data.maps.find(m => m.mapName === mapName);
    return mapData ? mapData.points : [];
  }

  // Add point to a specific map
  static async addPointToMap(mapName: string, point: GoalPoint, mapPath?: string): Promise<boolean> {
    const data = await this.loadMapPointData();
    const existingMapIndex = data.maps.findIndex(m => m.mapName === mapName);
    
    if (existingMapIndex >= 0) {
      // Update existing map
      data.maps[existingMapIndex].points.push(point);
      data.maps[existingMapIndex].updatedAt = new Date().toISOString();
    } else {
      // Create new map entry
      data.maps.push({
        mapName,
        mapPath,
        points: [point],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return await this.saveMapPointData(data);
  }

  // Update point in a specific map
  static async updatePointInMap(mapName: string, pointId: string, updates: Partial<GoalPoint>): Promise<boolean> {
    const data = await this.loadMapPointData();
    const mapData = data.maps.find(m => m.mapName === mapName);
    
    if (mapData) {
      const pointIndex = mapData.points.findIndex(p => p.id === pointId);
      if (pointIndex >= 0) {
        mapData.points[pointIndex] = { ...mapData.points[pointIndex], ...updates };
        mapData.updatedAt = new Date().toISOString();
        return await this.saveMapPointData(data);
      }
    }
    
    return false;
  }

  // Remove point from a specific map
  static async removePointFromMap(mapName: string, pointId: string): Promise<boolean> {
    const data = await this.loadMapPointData();
    const mapData = data.maps.find(m => m.mapName === mapName);
    
    if (mapData) {
      mapData.points = mapData.points.filter(p => p.id !== pointId);
      mapData.updatedAt = new Date().toISOString();
      return await this.saveMapPointData(data);
    }
    
    return false;
  }

  // Get all maps with point counts
  static async getAllMapsInfo(): Promise<Array<{mapName: string, pointCount: number, lastUpdated: string}>> {
    const data = await this.loadMapPointData();
    return data.maps.map(m => ({
      mapName: m.mapName,
      pointCount: m.points.length,
      lastUpdated: m.updatedAt
    }));
  }

  // Export map data for backup
  static async exportMapData(mapName?: string): Promise<string> {
    const data = await this.loadMapPointData();
    if (mapName) {
      const mapData = data.maps.find(m => m.mapName === mapName);
      return JSON.stringify(mapData, null, 2);
    }
    return JSON.stringify(data, null, 2);
  }
}