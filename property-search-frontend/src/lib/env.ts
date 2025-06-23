// REFACTORED frontend environment config
import { z } from 'zod';

// Schema definition
const FrontendEnvironmentSchema = z.object({
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_EMBEDDING_SERVICE_URL: z.string().url(),
});

// Export types
export type FrontendEnvironment = z.infer<typeof FrontendEnvironmentSchema>;

// Parse function - same public API
export const parseFrontendEnv = (env: Record<string, unknown>): FrontendEnvironment => {
    return FrontendEnvironmentSchema.parse(env);
};

// For actual usage in the app
let cachedEnv: FrontendEnvironment | undefined;

export const getEnv = (): FrontendEnvironment => {
    if (!cachedEnv) {
        cachedEnv = parseFrontendEnv({
            NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
            NEXT_PUBLIC_EMBEDDING_SERVICE_URL: process.env.NEXT_PUBLIC_EMBEDDING_SERVICE_URL,
        });
    }
    return cachedEnv;
};

// Usage throughout the app:
// import { getEnv } from '@/lib/env';
// const env = getEnv();
// fetch(`${env.NEXT_PUBLIC_API_URL}/properties`);