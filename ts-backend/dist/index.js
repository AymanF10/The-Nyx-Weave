"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_loader_1 = require("./config/config-loader");
const scheduler_service_1 = require("./services/scheduler.service");
const logger_1 = require("./utils/logger");
class PriceQuoteScheduler {
    constructor() {
        this.schedulerService = null;
    }
    async start() {
        try {
            logger_1.logger.info('Starting Price Quote Scheduler...');
            // Load configuration
            const configLoader = config_loader_1.ConfigLoader.getInstance();
            const config = configLoader.loadConfig();
            // Initialize scheduler service
            this.schedulerService = new scheduler_service_1.SchedulerService(config);
            // Start the scheduler
            this.schedulerService.start();
            // Handle graceful shutdown
            this.setupGracefulShutdown();
            logger_1.logger.info('Price Quote Scheduler started successfully');
            logger_1.logger.info(`Monitoring ${config.pools.length} pools with schedule: ${config.scheduler.description}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to start Price Quote Scheduler:', error);
            process.exit(1);
        }
    }
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger_1.logger.info(`Received ${signal}. Starting graceful shutdown...`);
            if (this.schedulerService) {
                this.schedulerService.stop();
            }
            logger_1.logger.info('Graceful shutdown completed');
            process.exit(0);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught Exception:', error);
            shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            shutdown('unhandledRejection');
        });
    }
    async executeOnce() {
        try {
            logger_1.logger.info('Executing price quotes once...');
            const configLoader = config_loader_1.ConfigLoader.getInstance();
            const config = configLoader.loadConfig();
            const schedulerService = new scheduler_service_1.SchedulerService(config);
            const quotes = await schedulerService.executeOnce();
            logger_1.logger.info(`Executed ${quotes.length} price quotes`);
            quotes.forEach(quote => {
                if (quote.success) {
                    logger_1.logger.info(`${quote.poolName}: ${quote.price}`);
                }
                else {
                    logger_1.logger.error(`${quote.poolName}: Failed - ${quote.error}`);
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error executing price quotes:', error);
            process.exit(1);
        }
    }
    getStatus() {
        try {
            const configLoader = config_loader_1.ConfigLoader.getInstance();
            const config = configLoader.loadConfig();
            if (this.schedulerService) {
                const status = this.schedulerService.getStatus();
                logger_1.logger.info('Scheduler Status:', status);
            }
            else {
                logger_1.logger.info('Scheduler is not running');
            }
            logger_1.logger.info(`Configuration: ${config.pools.length} pools, ${config.scheduler.description}`);
        }
        catch (error) {
            logger_1.logger.error('Error getting status:', error);
        }
    }
}
// Main execution
async function main() {
    const scheduler = new PriceQuoteScheduler();
    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0];
    switch (command) {
        case 'start':
            await scheduler.start();
            break;
        case 'once':
            await scheduler.executeOnce();
            break;
        case 'status':
            scheduler.getStatus();
            break;
        default:
            logger_1.logger.info('Usage: npm run dev [start|once|status]');
            logger_1.logger.info('  start  - Start the scheduler (default)');
            logger_1.logger.info('  once   - Execute price quotes once');
            logger_1.logger.info('  status - Show scheduler status');
            process.exit(0);
    }
}
// Start the application
if (require.main === module) {
    main().catch((error) => {
        logger_1.logger.error('Application error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map