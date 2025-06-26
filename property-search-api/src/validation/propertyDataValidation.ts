import { z } from 'zod';

// UK Postcode regex pattern
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;

const PropertySchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters')
    .refine(str => !/[<>]/.test(str), 'Invalid characters in title'),
  
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description cannot exceed 2000 characters')
    .refine(str => !/[<>]/.test(str), 'Invalid characters in description'),
  
  price: z.number()
    .min(1000, 'Price must be at least £1,000')
    .max(50000000, 'Price cannot exceed £50M'),
  
  bedrooms: z.number()
    .min(0, 'Bedrooms cannot be negative')
    .max(20, 'Too many bedrooms'),
  
  bathrooms: z.number()
    .min(0, 'Bathrooms cannot be negative')
    .max(10, 'Too many bathrooms'),
  
  property_type: z.enum(['house', 'flat', 'studio', 'commercial', 'land']),
  
  postcode: z.string()
    .regex(UK_POSTCODE_REGEX, 'Invalid UK postcode format')
    .transform(str => str.toUpperCase().replace(/\s+/g, ' ').trim()),
  
  latitude: z.number()
    .min(49.5, 'Latitude outside UK bounds')
    .max(61, 'Latitude outside UK bounds'),
  
  longitude: z.number()
    .min(-8, 'Longitude outside UK bounds')
    .max(2, 'Longitude outside UK bounds'),
  
  square_feet: z.number()
    .min(50, 'Property too small')
    .max(50000, 'Property too large')
    .optional(),
  
  images: z.array(z.string().url('Invalid image URL'))
    .max(20, 'Too many images (max 20)')
    .refine(
      urls => urls.every(url => /\.(jpg|jpeg|png|webp)$/i.test(url)),
      'All images must be in JPG, PNG, or WebP format'
    )
    .default([]),
  
  features: z.array(z.enum([
    'parking', 'garden', 'balcony', 'gym', 'concierge', 
    'lift', 'terrace', 'fireplace', 'storage', 'pet_friendly',
    'furnished', 'unfurnished', 'new_build', 'period_property'
  ]))
    .max(50, 'Too many features (max 50)')
    .default([]),
  
  available: z.boolean().default(true),
  
  energy_rating: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
    .optional(),
  
  council_tax_band: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    .optional(),
  
  lease_remaining: z.number()
    .min(0, 'Lease years cannot be negative')
    .max(999, 'Lease years too high')
    .optional(),
  
  service_charge: z.number()
    .min(0, 'Service charge cannot be negative')
    .max(50000, 'Service charge too high')
    .optional()
});

export type PropertyCreateData = z.infer<typeof PropertySchema>;

export const validatePropertyData = (data: unknown) => {
  return PropertySchema.safeParse(data);
};

export { PropertySchema };