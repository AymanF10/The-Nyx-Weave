import { AppConfig } from '../types';
export declare class ConfigLoader {
    private static instance;
    private config;
    private constructor();
    static getInstance(): ConfigLoader;
    loadConfig(configPath?: string): AppConfig;
    private validateConfig;
    private isValidCronExpression;
    getConfig(): AppConfig;
    reloadConfig(configPath?: string): AppConfig;
}
//# sourceMappingURL=config-loader.d.ts.map