// API endpoint để scan map directory
const fs = require('fs').promises;
const path = require('path');

const MAP_DIRECTORY = '/hover_board/src/nav2_hover/nav2_hoveramr/map';

export default async function handler(req, res) {
  try {
    console.log(`📂 Scanning map directory: ${MAP_DIRECTORY}`);
    
    // Đọc danh sách files trong directory
    const files = await fs.readdir(MAP_DIRECTORY);
    
    // Lọc chỉ lấy .pgm và .yaml files
    const mapFiles = files.filter(file => 
      file.endsWith('.pgm') || file.endsWith('.yaml')
    );
    
    console.log(`✅ Found ${mapFiles.length} map files:`, mapFiles);
    
    res.status(200).json(mapFiles);
    
  } catch (error) {
    console.error('Error scanning map directory:', error);
    
    if (error.code === 'ENOENT') {
      return res.status(404).json({ 
        error: 'Map directory not found',
        directory: MAP_DIRECTORY
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to scan directory',
      details: error.message
    });
  }
}