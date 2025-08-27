import dotenv from 'dotenv';

dotenv.config();

function validateEnvVar(name, defaultValue = null) {
    const value = process.env[name] || defaultValue;
    if (!value && defaultValue === null) {
        throw new Error(`Environment variable ${name} is required but not set`);
    }
    return value;
}

function validateNumericEnvVar(name, defaultValue = null) {
    const value = process.env[name] || defaultValue;
    if (!value && defaultValue === null) {
        throw new Error(`Environment variable ${name} is required but not set`);
    }
    const numValue = parseInt(value);
    if (isNaN(numValue)) {
        throw new Error(`Environment variable ${name} must be a valid number`);
    }
    return numValue;
}

export const config = {
    postgres: {
        host: validateEnvVar('PG_HOST', 'localhost'),
        port: validateNumericEnvVar('PG_PORT', 5433),
        user: validateEnvVar('PG_USER', 'user'),
        password: validateEnvVar('PG_PASS', 'secret'),
        database: validateEnvVar('PG_DB', 'lf8_lets_meet_db'),
    },
    mongo: {
        url: validateEnvVar('MONGO_URL', 'mongodb://localhost:27017'),
    },
    logging: {
        level: validateEnvVar('LOG_LEVEL', 'info'),
    }
};

export function validateConfig() {
    try {
        // Test MongoDB URL format
        new URL(config.mongo.url);
        
        // Validate PostgreSQL port range
        if (config.postgres.port < 1 || config.postgres.port > 65535) {
            throw new Error('PostgreSQL port must be between 1 and 65535');
        }
        
        console.log('✅ Configuration validated successfully');
        return true;
    } catch (error) {
        console.error('❌ Configuration validation failed:', error.message);
        console.error('💡 Please check your environment variables or create a .env file');
        console.error('📋 See .env.example for reference');
        return false;
    }
}