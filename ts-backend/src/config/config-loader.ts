import fs from 'fs';
import path from 'path';
import { AppConfig } from '../types';
import { logger } from '../utils/logger';

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: AppConfig | null = null;

  private constructor() {}

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  loadConfig(configPath?: string): AppConfig {
    if (this.config) {
      return this.config;
    }

    const defaultPath = path.join(process.cwd(), 'config', 'pools.json');
    const configFilePath = configPath || defaultPath;

    try {
      logger.info(`Loading configuration from: ${configFilePath}`);
      
      if (!fs.existsSync(configFilePath)) {
        throw new Error(`Configuration file not found: ${configFilePath}`);
      }

      const configData = fs.readFileSync(configFilePath, 'utf8');
      this.config = JSON.parse(configData) as AppConfig;

      // Validate configuration
      this.validateConfig(this.config);

      logger.info(`Configuration loaded successfully with ${this.config.pools.length} pools`);
      logger.info(`Scheduler configured with: ${this.config.scheduler.description}`);

      return this.config;

    } catch (error) {
      logger.error('Error loading configuration:', error);
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateConfig(config: AppConfig): void {
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

  private isValidCronExpression(cronExpression: string): boolean {
    // Use node-cron's built-in validation instead of regex
    try {
      const cron = require('node-cron');
      return cron.validate(cronExpression);
    } catch (error) {
      return false;
    }
  }

  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  reloadConfig(configPath?: string): AppConfig {
    this.config = null;
    return this.loadConfig(configPath);
  }
} 