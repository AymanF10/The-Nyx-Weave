"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigLoader = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
class ConfigLoader {
    constructor() {
        this.config = null;
    }
    static getInstance() {
        if (!ConfigLoader.instance) {
            ConfigLoader.instance = new ConfigLoader();
        }
        return ConfigLoader.instance;
    }
    loadConfig(configPath) {
        if (this.config) {
            return this.config;
        }
        const defaultPath = path_1.default.join(process.cwd(), 'config', 'pools.json');
        const configFilePath = configPath || defaultPath;
        try {
            logger_1.logger.info(`Loading configuration from: ${configFilePath}`);
            if (!fs_1.default.existsSync(configFilePath)) {
                throw new Error(`Configuration file not found: ${configFilePath}`);
            }
            const configData = fs_1.default.readFileSync(configFilePath, 'utf8');
            this.config = JSON.parse(configData);
            // Validate configuration
            this.validateConfig(this.config);
            logger_1.logger.info(`Configuration loaded successfully with ${this.config.pools.length} pools`);
            logger_1.logger.info(`Scheduler configured with: ${this.config.scheduler.description}`);
            return this.config;
        }
        catch (error) {
            logger_1.logger.error('Error loading configuration:', error);
            throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    validateConfig(config) {
        if (!config.pools || !Array.isArray(config.pools) || config.pools.length === 0) {
            throw new Error('Configuration must contain at least one pool');
        }
        if (!config.scheduler || !config.scheduler.cronExpression) {
            throw new Error('Configuration must contain scheduler settings with cron expression');
        }
        if (!config.rpc || !config.rpc.endpoint) {
            throw new Error('Configuration must contain RPC settings');
        }
        // Validate each pool configuration
        config.pools.forEach((pool, index) => {
            if (!pool.name || !pool.address) {
                throw new Error(`Pool at index ${index} must have name and address`);
            }
            if (pool.swapAmount <= 0) {
                throw new Error(`Pool ${pool.name} must have a positive swap amount`);
            }
        });
        // Validate cron expression
        if (!this.isValidCronExpression(config.scheduler.cronExpression)) {
            throw new Error(`Invalid cron expression: ${config.scheduler.cronExpression}`);
        }
    }
    isValidCronExpression(cronExpression) {
        // Use node-cron's built-in validation instead of regex
        try {
            const cron = require('node-cron');
            return cron.validate(cronExpression);
        }
        catch (error) {
            return false;
        }
    }
    getConfig() {
        if (!this.config) {
            throw new Error('Configuration not loaded. Call loadConfig() first.');
        }
        return this.config;
    }
    reloadConfig(configPath) {
        this.config = null;
        return this.loadConfig(configPath);
    }
}
exports.ConfigLoader = ConfigLoader;
//# sourceMappingURL=config-loader.js.map