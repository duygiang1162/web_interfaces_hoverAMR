#!/usr/bin/env node

// Script đọc map file thật từ hệ thống
const fs = require('fs');
const path = require('path');

const MAP_DIRECTORY = '/hover_board/src/nav2_hover/nav2_hoveramr/map';

async function readMapFiles(mapName) {
  try {
    console.log(`📂 Reading real map files: ${mapName}`);
    
    const pgmPath = path.join(MAP_DIRECTORY, `${mapName}.pgm`);
    const yamlPath = path.join(MAP_DIRECTORY, `${mapName}.yaml`);
    
    // Check if files exist
    if (!fs.existsSync(pgmPath)) {
      throw new Error(`PGM file not found: ${pgmPath}`);
    }
    
    if (!fs.existsSync(yamlPath)) {
      throw new Error(`YAML file not found: ${yamlPath}`);
    }
    
    // Read files
    const pgmBuffer = fs.readFileSync(pgmPath);
    const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
    
    console.log('✅ Files read successfully:');
    console.log(`  PGM: ${pgmBuffer.length} bytes`);
    console.log(`  YAML: ${yamlContent.length} chars`);
    console.log('\n📄 YAML Content:');
    console.log(yamlContent);
    
    // Parse PGM header để lấy thông tin
    const headerText = pgmBuffer.toString('utf-8', 0, 1000);
    const lines = headerText.split('\n');
    
    let width = 0, height = 0;
    let lineIndex = 0;
    
    // Skip P5
    if (lines[lineIndex].trim() === 'P5') lineIndex++;
    
    // Skip comments
    while (lines[lineIndex]?.startsWith('#')) lineIndex++;
    
    // Get dimensions
    const dimensions = lines[lineIndex].trim().split(/\s+/);
    width = parseInt(dimensions[0]);
    height = parseInt(dimensions[1]);
    
    console.log('\n📊 PGM Info:');
    console.log(`  Dimensions: ${width} x ${height}`);
    console.log(`  Expected pixels: ${width * height}`);
    
    return {
      pgmBuffer,
      yamlContent,
      width,
      height
    };
    
  } catch (error) {
    console.error('❌ Error reading map files:', error.message);
    throw error;
  }
}

// Main function
async function main() {
  const mapName = process.argv[2];
  
  if (!mapName) {
    console.log('Usage: node readMap.js <mapName>');
    console.log('Example: node readMap.js home_slamtoolbox');
    return;
  }
  
  try {
    await readMapFiles(mapName);
  } catch (error) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { readMapFiles };