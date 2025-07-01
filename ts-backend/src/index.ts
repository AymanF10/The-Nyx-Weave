import { ConfigLoader } from './config/config-loader';
import { SchedulerService } from './services/scheduler.service';
import { logger } from './utils/logger';

class PriceQuoteScheduler {
  private schedulerService: SchedulerService | null = null;

  async start(): Promise<void> {
    try {
      logger.info('Starting Price Quote Scheduler...');

      // Load configuration
      const configLoader = ConfigLoader.getInstance();
      const config = configLoader.loadConfig();

      // Initialize scheduler service
      this.schedulerService = new SchedulerService(config);

      // Start the scheduler
      this.schedulerService.start();

      // Handle graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Price Quote Scheduler started successfully');
      logger.info(`Monitoring ${config.pools.length} pools with schedule: ${config.scheduler.description}`);

    } catch (error) {
      logger.error('Failed to start Price Quote Scheduler:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      if (this.schedulerService) {
        this.schedulerService.stop();
      }
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  async executeOnce(): Promise<void> {
    try {
      logger.info('Executing price quotes once...');

      const configLoader = ConfigLoader.getInstance();
      const config = configLoader.loadConfig();

      const schedulerService = new SchedulerService(config);
      const quotes = await schedulerService.executeOnce();

      logger.info(`Executed ${quotes.length} price quotes`);
      quotes.forEach(quote => {
        if (quote.success) {
          logger.info(`${quote.poolName}: ${quote.price}`);
        } else {
          logger.error(`${quote.poolName}: Failed - ${quote.error}`);
        }
      });

    } catch (error) {
      logger.error('Error executing price quotes:', error);
      process.exit(1);
    }
  }

  getStatus(): void {
    try {
      const configLoader = ConfigLoader.getInstance();
      const config = configLoader.loadConfig();

      if (this.schedulerService) {
        const status = this.schedulerService.getStatus();
        logger.info('Scheduler Status:', status);
      } else {
        logger.info('Scheduler is not running');
      }

      logger.info(`Configuration: ${config.pools.length} pools, ${config.scheduler.description}`);

    } catch (error) {
      logger.error('Error getting status:', error);
    }
  }
}

// Main execution
async function main(): Promise<void> {
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
      logger.info('Usage: npm run dev [start|once|status]');
      logger.info('  start  - Start the scheduler (default)');
      logger.info('  once   - Execute price quotes once');
      logger.info('  status - Show scheduler status');
      process.exit(0);
  }
}

// Start the application
if (require.main === module) {
  main().catch((error) => {
    logger.error('Application error:', error);
    process.exit(1);
  });
} 