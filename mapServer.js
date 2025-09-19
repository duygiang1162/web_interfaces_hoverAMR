#!/usr/bin/env node

// Simple HTTP server để serve map files (ES Module version)
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

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
      const files = fs.readdirSync(MAP_DIRECTORY);
      const mapFiles = files.filter(file => 
        file.endsWith('.pgm') || file.endsWith('.yaml')
      );
      
      console.log(`✅ Found ${mapFiles.length} map files:`, mapFiles);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mapFiles));
      
    } catch (error) {
      console.error('❌ Error scanning directory:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to scan directory' }));
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
      
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
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
      console.error(`❌ Error serving file ${filename}:`, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }
  
  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 Map file server running on http://localhost:${PORT}`);
  console.log(`📂 Serving maps from: ${MAP_DIRECTORY}`);
  console.log(`\n🔗 Available endpoints:`);
  console.log(`  GET /api/scan-maps - List all map files`);
  console.log(`  GET /api/maps/<filename> - Download specific file`);
  console.log(`\n📝 Usage in React app:`);
  console.log(`  fetch('http://localhost:${PORT}/api/scan-maps')`);
  console.log(`  fetch('http://localhost:${PORT}/api/maps/home.pgm')`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down map file server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});