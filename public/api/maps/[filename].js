// API endpoint để đọc map files từ filesystem
const fs = require('fs').promises;
const path = require('path');

const MAP_DIRECTORY = '/hover_board/src/nav2_hover/nav2_hoveramr/map';

export default async function handler(req, res) {
  const { filename } = req.query;
  
  try {
    // Security check
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Chỉ cho phép .pgm và .yaml files
    if (!filename.endsWith('.pgm') && !filename.endsWith('.yaml')) {
      return res.status(400).json({ error: 'Only PGM and YAML files are allowed' });
    }
    
    const filePath = path.join(MAP_DIRECTORY, filename);
    
    // Security check - đảm bảo file trong MAP_DIRECTORY
    const resolvedPath = path.resolve(filePath);
    const resolvedMapDir = path.resolve(MAP_DIRECTORY);
    
    if (!resolvedPath.startsWith(resolvedMapDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Đọc file
    const fileData = await fs.readFile(filePath);
    
    // Set appropriate content type
    if (filename.endsWith('.pgm')) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(fileData);
    } else if (filename.endsWith('.yaml')) {
      res.setHeader('Content-Type', 'text/plain');
      res.send(fileData.toString('utf-8'));
    }
    
  } catch (error) {
    console.error('Error reading map file:', error);
    
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}