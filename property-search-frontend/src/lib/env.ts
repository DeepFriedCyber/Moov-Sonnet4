import { z } from 'zod';

const envSchema = z.object({
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_EMBEDDING_SERVICE_URL: z.string().url(),
});

// Parse environment variables with test fallbacks
let env: any;
try {
    env = envSchema.parse({
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_EMBEDDING_SERVICE_URL: process.env.NEXT_PUBLIC_EMBEDDING_SERVICE_URL,
    });
} catch (error) {
    // In test or development without env vars, provide defaults
    env = {
        NEXT_PUBLIC_API_URL: 'http://localhost:3001',
        NEXT_PUBLIC_EMBEDDING_SERVICE_URL: 'http://localhost:8001',
    };
}

export { env };

export type Env = typeof env;
export type FrontendEnvironment = typeof env;

// Function to parse frontend environment variables for testing
export const parseFrontendEnv = (envVars: Record<string, string | undefined>): FrontendEnvironment => {
    return envSchema.parse(envVars);
};