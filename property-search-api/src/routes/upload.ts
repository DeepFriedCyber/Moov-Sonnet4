import express from 'express';
import multer from 'multer';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

const router = express.Router();

// File signature validation
const validateFileSignature = (filePath: string, expectedType: string): boolean => {
  try {
    const buffer = fs.readFileSync(filePath);
    const signature = buffer.toString('hex', 0, 8).toUpperCase();

    switch (expectedType) {
      case '.xlsx':
        // XLSX files are ZIP archives, should start with PK (50 4B)
        return signature.startsWith('504B');

      case '.xls':
        // XLS files have OLE signature (D0 CF 11 E0 A1 B1 1A E1)
        return signature.startsWith('D0CF11E0');

      case '.csv':
        // CSV files should be valid text, check if it's readable as text
        try {
          const text = buffer.toString('utf8', 0, Math.min(1024, buffer.length));
          // Basic check: should contain printable characters and common CSV patterns
          return /^[\x20-\x7E\t\n\r,;"']*$/.test(text) && (text.includes(',') || text.includes(';') || text.includes('\t'));
        } catch {
          return false;
        }

      default:
        return false;
    }
  } catch (error) {
    console.error('Error validating file signature:', error);
    return false;
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${originalName}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileExt = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Upload endpoint for property files
router.post('/property-file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
      return;
    }

    const uploadedFile = req.file;
    const filePath = uploadedFile.path;
    const agentId = req.body.agentId || 'default';
    const fileExt = path.extname(uploadedFile.originalname).toLowerCase();

    console.log(`Processing uploaded file: ${uploadedFile.originalname}`);
    console.log(`Agent ID: ${agentId}`);

    // Validate file signature for security
    if (!validateFileSignature(filePath, fileExt)) {
      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('Error deleting uploaded file:', e);
      }

      res.status(400).json({
        success: false,
        error: `Invalid file format. The file does not match the expected ${fileExt} format.`
      });
      return;
    }

    // Run the Python import script
    const pythonScript = path.join(__dirname, '../../flexible_import_system.py');

    const pythonProcess = spawn('python', [pythonScript, filePath, agentId], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(data.toString());
    });

    pythonProcess.on('close', (code) => {
      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('Error deleting uploaded file:', e);
      }

      if (code === 0) {
        // Parse the result from stdout (you might want to make this more robust)
        const lines = stdout.split('\n');
        const importedLine = lines.find(line => line.includes('Import complete:'));

        let importedCount = 0;
        if (importedLine) {
          const match = importedLine.match(/Import complete: (\d+)\/(\d+) rows imported/);
          if (match) {
            importedCount = parseInt(match[1]);
          }
        }

        res.json({
          success: true,
          message: 'File processed successfully',
          importedRows: importedCount,
          output: stdout,
          agentId: agentId,
          originalFilename: uploadedFile.originalname
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Import process failed',
          output: stdout,
          errorOutput: stderr
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Error running Python script:', error);

      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('Error deleting uploaded file:', e);
      }

      res.status(500).json({
        success: false,
        error: 'Failed to run import process',
        details: error.message
      });
    });

    // Return to satisfy TypeScript - responses are handled in event callbacks
    return;

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get supported agents/mappings
router.get('/supported-agents', (req, res) => {
  try {
    const mappingsPath = path.join(__dirname, '../../agent_field_mappings.json');
    const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));

    const agents = Object.keys(mappings).map(key => ({
      id: key,
      name: key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      fields: Object.keys(mappings[key])
    }));

    res.json({
      success: true,
      agents: agents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load agent mappings',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Preview file columns (for mapping validation)
router.post('/preview-columns', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
      return;
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    // Validate file signature for security
    if (!validateFileSignature(filePath, fileExt)) {
      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('Error deleting uploaded file:', e);
      }

      res.status(400).json({
        success: false,
        error: `Invalid file format. The file does not match the expected ${fileExt} format.`
      });
      return;
    }

    // Run a preview version of the Python script to get column info
    const pythonScript = `
import pandas as pd
import sys
import json

try:
    file_path = sys.argv[1]
    
    # Load file
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path)
    
    # Get sample data
    result = {
        'columns': list(df.columns),
        'row_count': len(df),
        'sample_data': df.head(3).to_dict('records')
    }
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

    const pythonProcess = spawn('python', ['-c', pythonScript, filePath]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('Error deleting uploaded file:', e);
      }

      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            res.status(400).json({
              success: false,
              error: result.error
            });
          } else {
            res.json({
              success: true,
              ...result
            });
          }
        } catch (e) {
          res.status(500).json({
            success: false,
            error: 'Failed to parse preview data'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to preview file',
          details: stderr
        });
      }
    });

    // Return to satisfy TypeScript - responses are handled in event callbacks
    return;

  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({
      success: false,
      error: 'Preview failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;