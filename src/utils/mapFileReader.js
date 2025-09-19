// Server-side map file reader cho development
const fs = require('fs');
const path = require('path');

const MAP_DIRECTORY = '/hover_board/src/nav2_hover/nav2_hoveramr/map';

// Function để đọc file map
async function readMapFile(filename) {
  try {
    const filePath = path.join(MAP_DIRECTORY, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filename}`);
    }
    
    // Read file
    const data = fs.readFileSync(filePath);
    
    console.log(`✅ Read file: ${filename} (${data.length} bytes)`);
    return data;
    
  } catch (error) {
    console.error(`❌ Error reading ${filename}:`, error.message);
    throw error;
  }
}

// Function để list tất cả map files
function listMapFiles() {
  try {
    const files = fs.readdirSync(MAP_DIRECTORY);
    const mapFiles = files.filter(file => 
      file.endsWith('.pgm') || file.endsWith('.yaml')
    );
    
    console.log(`✅ Found ${mapFiles.length} map files:`, mapFiles);
    return mapFiles;
    
  } catch (error) {
    console.error(`❌ Error listing files:`, error.message);
    throw error;
  }
}

module.exports = {
  readMapFile,
  listMapFiles,
  MAP_DIRECTORY
};