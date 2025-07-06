import * as cron from 'node-cron';
import { AppConfig, PriceQuote } from '../types';
import { PriceQuoteService } from './price-quote.service';
import { logger } from '../utils/logger';

export class SchedulerService {
  private priceQuoteService: PriceQuoteService;
  private config: AppConfig;
  private task: cron.ScheduledTask | null = null;

  constructor(config: AppConfig) {
    this.config = config;
    this.priceQuoteService = new PriceQuoteService(config.rpc);
  }

  start(): void {
    if (this.task) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info(`Starting price quote scheduler with cron: ${this.config.scheduler.cronExpression}`);
    logger.info(`Scheduler description: ${this.config.scheduler.description}`);

    this.task = cron.schedule(this.config.scheduler.cronExpression, async () => {
      await this.executePriceQuotes();
    }, {
      scheduled: false,
      timezone: "UTC"
    });

    this.task.start();
    logger.info('Price quote scheduler started successfully');
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('Price quote scheduler stopped');
    }
  }

  async executePriceQuotes(): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting scheduled price quote execution');

    try {
      const quotes = await this.priceQuoteService.getPriceQuotesForAllPools(this.config.pools);
      
      // Log summary
      const successfulQuotes = quotes.filter(q => q.success);
      const failedQuotes = quotes.filter(q => !q.success);
      
      logger.info(`Price quote execution completed:`, {
        total: quotes.length,
        successful: successfulQuotes.length,
        failed: failedQuotes.length,
        duration: Date.now() - startTime
      });

      // Log individual quotes
      successfulQuotes.forEach(quote => {
        logger.info(`Quote for ${quote.poolName}: ${quote.price}`, {
          poolAddress: quote.poolAddress,
          consumedInAmount: quote.consumedInAmount,
          outAmount: quote.outAmount,
          swapYtoX: quote.swapYtoX
        });
      });

      if (failedQuotes.length > 0) {
        failedQuotes.forEach(quote => {
          logger.error(`Failed quote for ${quote.poolName}: ${quote.error}`);
        });
      }

    } catch (error) {
      logger.error('Error during scheduled price quote execution:', error);
    }
  }

  async executeOnce(): Promise<PriceQuote[]> {
    logger.info('Executing price quotes once (manual trigger)');
    return await this.priceQuoteService.getPriceQuotesForAllPools(this.config.pools);
  }

  getStatus(): { isRunning: boolean; cronExpression: string; description: string } {
    return {
      isRunning: this.task !== null,
      cronExpression: this.config.scheduler.cronExpression,
      description: this.config.scheduler.description
    };
  }
} 