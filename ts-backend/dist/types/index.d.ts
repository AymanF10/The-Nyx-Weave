export interface PoolConfig {
    name: string;
    address: string;
    swapAmount: number;
    swapYtoX: boolean;
    isPartialFill: boolean;
    maxExtraBinArrays: number;
    decimals: number;
}
export interface SchedulerConfig {
    cronExpression: string;
    description: string;
}
export interface RpcConfig {
    endpoint: string;
    commitment: string;
}
export interface AppConfig {
    pools: PoolConfig[];
    scheduler: SchedulerConfig;
    rpc: RpcConfig;
}
export interface PriceQuote {
    poolName: string;
    poolAddress: string;
    timestamp: Date;
    consumedInAmount: string;
    outAmount: string;
    swapYtoX: boolean;
    swapAmount: number;
    price: number;
    success: boolean;
    error?: string;
}
import BN from 'bn.js';
export interface SwapQuoteResult {
    consumedInAmount: BN;
    outAmount: BN;
    feeAmount: BN;
    binArrays: any[];
}
//# sourceMappingURL=index.d.ts.map