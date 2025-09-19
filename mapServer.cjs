// CommonJS HTTP server để serve map files thật từ hệ thống
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const MAP_DIRECTORY = '/hover_board/src/nav2_hover/nav2_hoveramr/map';
const PORT = 3001;

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  console.log(`📥 Request: ${req.method} ${pathname}`);
  
  // Route: GET /api/scan-maps
  if (pathname === '/api/scan-maps') {
    try {
      console.log(`📂 Scanning directory: ${MAP_DIRECTORY}`);
      const files = fs.readdirSync(MAP_DIRECTORY);
      const mapFiles = files.filter(file => 
        file.endsWith('.pgm') || file.endsWith('.yaml')
      );
      
      console.log(`✅ Found ${mapFiles.length} map files:`, mapFiles);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mapFiles));
      
    } catch (error) {
      console.error('❌ Error scanning directory:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Failed to scan directory', 
        details: error.message,
        directory: MAP_DIRECTORY 
      }));
    }
    return;
  }
  
  // Route: GET /api/maps/<filename>
  if (pathname.startsWith('/api/maps/')) {
    const filename = pathname.replace('/api/maps/', '');
    
    // Security check
    if (!filename || filename.includes('..') || filename.includes('/')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid filename' }));
      return;
    }
    
    // Only allow .pgm and .yaml files
    if (!filename.endsWith('.pgm') && !filename.endsWith('.yaml')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Only PGM and YAML files allowed' }));
      return;
    }
    
    try {
      const filePath = path.join(MAP_DIRECTORY, filename);
      console.log(`📄 Reading file: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found', path: filePath }));
        return;
      }
      
      const fileData = fs.readFileSync(filePath);
      
      // Set content type based on file extension
      if (filename.endsWith('.pgm')) {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      } else if (filename.endsWith('.yaml')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
      }
      
      console.log(`✅ Served file: ${filename} (${fileData.length} bytes)`);
      res.end(fileData);
      
    } catch (error) {
      console.error(`❌ Error serving file ${filename}:`, error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
    }
    return;
  }
  
  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', availableRoutes: ['/api/scan-maps', '/api/maps/<filename>'] }));
});

server.listen(PORT, () => {
  console.log(`🚀 Map file server running on http://localhost:${PORT}`);
  console.log(`📂 Serving REAL maps from: ${MAP_DIRECTORY}`);
  
  // Test if directory exists
  try {
    const files = fs.readdirSync(MAP_DIRECTORY);
    console.log(`✅ Directory accessible, found ${files.length} files`);
    
    const mapFiles = files.filter(file => file.endsWith('.pgm') || file.endsWith('.yaml'));
    console.log(`📊 Map files available: ${mapFiles.length}`);
    mapFiles.forEach(file => console.log(`  - ${file}`));
    
  } catch (error) {
    console.error(`❌ Cannot access directory ${MAP_DIRECTORY}:`, error.message);
  }
  
  console.log(`\n🔗 Available endpoints:`);
  console.log(`  GET http://localhost:${PORT}/api/scan-maps`);
  console.log(`  GET http://localhost:${PORT}/api/maps/<filename>`);
  console.log(`\n💡 Usage: Select a map in React app to load REAL files!`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down map file server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});