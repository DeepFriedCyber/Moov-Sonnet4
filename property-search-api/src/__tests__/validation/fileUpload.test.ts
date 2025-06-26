import { validateImageUpload, validateDocumentUpload } from '../../validation/fileUploadValidation';

describe('File Upload Validation', () => {
  test('should validate property image uploads', () => {
    const validImageFile = {
      originalname: 'property-photo.jpg',
      mimetype: 'image/jpeg',
      size: 2 * 1024 * 1024, // 2MB
      buffer: Buffer.from('fake-image-data')
    };

    const result = validateImageUpload(validImageFile);
    expect(result.success).toBe(true);

    // Test invalid cases
    const invalidCases = [
      { ...validImageFile, mimetype: 'text/plain' }, // Wrong type
      { ...validImageFile, size: 11 * 1024 * 1024 }, // Too large (>10MB)
      { ...validImageFile, originalname: 'file.exe' }, // Dangerous extension
    ];

    invalidCases.forEach(invalid => {
      const result = validateImageUpload(invalid);
      expect(result.success).toBe(false);
    });
  });

  test('should validate document uploads (EPC certificates, etc.)', () => {
    const validDocument = {
      originalname: 'epc-certificate.pdf',
      mimetype: 'application/pdf',
      size: 1 * 1024 * 1024, // 1MB
      buffer: Buffer.from('fake-pdf-data')
    };

    const result = validateDocumentUpload(validDocument);
    expect(result.success).toBe(true);
  });

  test('should reject potentially dangerous file uploads', () => {
    const dangerousFiles = [
      { originalname: 'script.js', mimetype: 'application/javascript' },
      { originalname: 'virus.exe', mimetype: 'application/x-msdownload' },
      { originalname: 'shell.php', mimetype: 'application/x-php' },
      { originalname: 'macro.docm', mimetype: 'application/vnd.ms-word.document.macroEnabled.12' },
    ];

    dangerousFiles.forEach(file => {
      const testFile = {
        ...file,
        size: 1024,
        buffer: Buffer.from('fake-data')
      };

      const imageResult = validateImageUpload(testFile);
      const docResult = validateDocumentUpload(testFile);

      expect(imageResult.success).toBe(false);
      expect(docResult.success).toBe(false);
    });
  });
});