// API endpoints for map management
import { promises as fs } from 'fs';
import path from 'path';

const MAP_DIRECTORY = '/hover_board/src/nav2_hover/nav2_hoveramr/map';

// GET /api/scan-maps - Scan map directory for available maps
export async function GET() {
  try {
    const files = await fs.readdir(MAP_DIRECTORY);
    const mapFiles = files.filter(file => 
      file.endsWith('.pgm') || file.endsWith('.yaml')
    );
    
    return Response.json(mapFiles);
  } catch (error) {
    console.error('Error scanning map directory:', error);
    return Response.json({ error: 'Failed to scan map directory' }, { status: 500 });
  }
}

// GET /api/load-map/[filename] - Load specific map file
export async function loadMapFile(filename: string) {
  try {
    const filePath = path.join(MAP_DIRECTORY, filename);
    
    // Security check - ensure file is in map directory
    const resolvedPath = path.resolve(filePath);
    const resolvedMapDir = path.resolve(MAP_DIRECTORY);
    
    if (!resolvedPath.startsWith(resolvedMapDir)) {
      throw new Error('Invalid file path');
    }
    
    // Check if file exists
    await fs.access(filePath);
    
    if (filename.endsWith('.yaml')) {
      // Return text content for YAML files
      const content = await fs.readFile(filePath, 'utf-8');
      return new Response(content, {
        headers: { 'Content-Type': 'text/plain' }
      });
    } else if (filename.endsWith('.pgm')) {
      // Return binary content for PGM files
      const buffer = await fs.readFile(filePath);
      return new Response(buffer, {
        headers: { 'Content-Type': 'application/octet-stream' }
      });
    } else {
      throw new Error('Unsupported file type');
    }
    
  } catch (error) {
    console.error('Error loading map file:', error);
    return Response.json({ error: 'Failed to load map file' }, { status: 500 });
  }
}

// Utility function to check if both PGM and YAML exist for a map name
export async function checkMapPair(mapName: string): Promise<boolean> {
  try {
    const pgmPath = path.join(MAP_DIRECTORY, `${mapName}.pgm`);
    const yamlPath = path.join(MAP_DIRECTORY, `${mapName}.yaml`);
    
    await Promise.all([
      fs.access(pgmPath),
      fs.access(yamlPath)
    ]);
    
    return true;
  } catch {
    return false;
  }
}