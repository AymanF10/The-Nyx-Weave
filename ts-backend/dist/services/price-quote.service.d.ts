import { PoolConfig, PriceQuote, RpcConfig } from "../types";
export declare class PriceQuoteService {
    private connection;
    constructor(rpcConfig: RpcConfig);
    getPriceQuote(poolConfig: PoolConfig): Promise<PriceQuote>;
    private calculatePrice;
    getPriceQuotesForAllPools(poolConfigs: PoolConfig[]): Promise<PriceQuote[]>;
}
//# sourceMappingURL=price-quote.service.d.ts.map