import { z } from 'zod';

const UK_PHONE_REGEX = /^(\+44\s?|0)(7\d{3}\s?\d{3}\s?\d{3}|[1-9]\d{8,9})$/;

const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long')
    .refine(
        password => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password),
        'Password must contain uppercase, lowercase, number, and special character'
    );

const UserRegistrationSchema = z.object({
    email: z.string()
        .email('Invalid email format')
        .max(255, 'Email too long')
        .transform(str => str.toLowerCase().trim()),

    password: passwordSchema,

    confirmPassword: z.string(),

    firstName: z.string()
        .min(1, 'First name is required')
        .max(50, 'First name too long')
        .refine(str => /^[a-zA-Z\s-']+$/.test(str), 'Invalid characters in first name'),

    lastName: z.string()
        .min(1, 'Last name is required')
        .max(50, 'Last name too long')
        .refine(str => /^[a-zA-Z\s-']+$/.test(str), 'Invalid characters in last name'),

    phone: z.string()
        .regex(UK_PHONE_REGEX, 'Invalid UK phone number format')
        .transform(str => str.replace(/\s/g, '')),

    termsAccepted: z.boolean()
        .refine(val => val === true, 'You must accept the terms and conditions'),

    marketingOptIn: z.boolean().default(false),

    dateOfBirth: z.string()
        .datetime()
        .optional()
        .refine(date => {
            if (!date) return true;
            const age = new Date().getFullYear() - new Date(date).getFullYear();
            return age >= 18;
        }, 'You must be at least 18 years old')
}).refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
});

const UserLoginSchema = z.object({
    email: z.string()
        .email('Invalid email format')
        .transform(str => str.toLowerCase().trim()),

    password: z.string()
        .min(1, 'Password is required'),

    rememberMe: z.boolean().default(false)
});

export type UserRegistrationData = z.infer<typeof UserRegistrationSchema>;
export type UserLoginData = z.infer<typeof UserLoginSchema>;

export const validateUserRegistration = (data: unknown) => {
    return UserRegistrationSchema.safeParse(data);
};

export const validateUserLogin = (data: unknown) => {
    return UserLoginSchema.safeParse(data);
};