"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const cron = __importStar(require("node-cron"));
const price_quote_service_1 = require("./price-quote.service");
const logger_1 = require("../utils/logger");
class SchedulerService {
    constructor(config) {
        this.task = null;
        this.config = config;
        this.priceQuoteService = new price_quote_service_1.PriceQuoteService(config.rpc);
    }
    start() {
        if (this.task) {
            logger_1.logger.warn('Scheduler is already running');
            return;
        }
        logger_1.logger.info(`Starting price quote scheduler with cron: ${this.config.scheduler.cronExpression}`);
        logger_1.logger.info(`Scheduler description: ${this.config.scheduler.description}`);
        this.task = cron.schedule(this.config.scheduler.cronExpression, async () => {
            await this.executePriceQuotes();
        }, {
            scheduled: false,
            timezone: "UTC"
        });
        this.task.start();
        logger_1.logger.info('Price quote scheduler started successfully');
    }
    stop() {
        if (this.task) {
            this.task.stop();
            this.task = null;
            logger_1.logger.info('Price quote scheduler stopped');
        }
    }
    async executePriceQuotes() {
        const startTime = Date.now();
        logger_1.logger.info('Starting scheduled price quote execution');
        try {
            const quotes = await this.priceQuoteService.getPriceQuotesForAllPools(this.config.pools);
            // Log summary
            const successfulQuotes = quotes.filter(q => q.success);
            const failedQuotes = quotes.filter(q => !q.success);
            logger_1.logger.info(`Price quote execution completed:`, {
                total: quotes.length,
                successful: successfulQuotes.length,
                failed: failedQuotes.length,
                duration: Date.now() - startTime
            });
            // Log individual quotes
            successfulQuotes.forEach(quote => {
                logger_1.logger.info(`Quote for ${quote.poolName}: ${quote.price}`, {
                    poolAddress: quote.poolAddress,
                    consumedInAmount: quote.consumedInAmount,
                    outAmount: quote.outAmount,
                    swapYtoX: quote.swapYtoX
                });
            });
            if (failedQuotes.length > 0) {
                failedQuotes.forEach(quote => {
                    logger_1.logger.error(`Failed quote for ${quote.poolName}: ${quote.error}`);
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Error during scheduled price quote execution:', error);
        }
    }
    async executeOnce() {
        logger_1.logger.info('Executing price quotes once (manual trigger)');
        return await this.priceQuoteService.getPriceQuotesForAllPools(this.config.pools);
    }
    getStatus() {
        return {
            isRunning: this.task !== null,
            cronExpression: this.config.scheduler.cronExpression,
            description: this.config.scheduler.description
        };
    }
}
exports.SchedulerService = SchedulerService;
//# sourceMappingURL=scheduler.service.js.map