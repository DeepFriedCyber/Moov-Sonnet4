import { z } from 'zod';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp'
];

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs',
  '.js', '.jar', '.php', '.asp', '.aspx', '.jsp'
];

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ImageUploadSchema = z.object({
  originalname: z.string()
    .refine(
      name => !DANGEROUS_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext)),
      'File type not allowed'
    )
    .refine(
      name => /\.(jpg|jpeg|png|webp)$/i.test(name),
      'Only JPG, PNG, and WebP images are allowed'
    ),
  
  mimetype: z.enum(ALLOWED_IMAGE_TYPES as [string, ...string[]], {
    errorMap: () => ({ message: 'Invalid image type' })
  }),
  
  size: z.number()
    .max(10 * 1024 * 1024, 'Image must be less than 10MB')
    .min(1024, 'Image file is too small'),
  
  buffer: z.instanceof(Buffer)
});

const DocumentUploadSchema = z.object({
  originalname: z.string()
    .refine(
      name => !DANGEROUS_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext)),
      'File type not allowed'
    )
    .refine(
      name => /\.(pdf|doc|docx)$/i.test(name),
      'Only PDF and Word documents are allowed'
    ),
  
  mimetype: z.enum(ALLOWED_DOCUMENT_TYPES as [string, ...string[]], {
    errorMap: () => ({ message: 'Invalid document type' })
  }),
  
  size: z.number()
    .max(5 * 1024 * 1024, 'Document must be less than 5MB')
    .min(1024, 'Document file is too small'),
  
  buffer: z.instanceof(Buffer)
});

export const validateImageUpload = (file: UploadedFile) => {
  return ImageUploadSchema.safeParse(file);
};

export const validateDocumentUpload = (file: UploadedFile) => {
  return DocumentUploadSchema.safeParse(file);
};

export type { UploadedFile };