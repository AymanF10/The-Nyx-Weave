import { AppConfig, PriceQuote } from '../types';
export declare class SchedulerService {
    private priceQuoteService;
    private config;
    private task;
    constructor(config: AppConfig);
    start(): void;
    stop(): void;
    executePriceQuotes(): Promise<void>;
    executeOnce(): Promise<PriceQuote[]>;
    getStatus(): {
        isRunning: boolean;
        cronExpression: string;
        description: string;
    };
}
//# sourceMappingURL=scheduler.service.d.ts.map