"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceQuoteService = void 0;
const web3_js_1 = require("@solana/web3.js");
const bn_js_1 = __importDefault(require("bn.js"));
const logger_1 = require("../utils/logger");
// Mock DLMM class - you'll need to replace this with the actual DLMM import
class DLMM {
    static async create(connection, poolAddress, options) {
        // This is a mock implementation - replace with actual DLMM import
        return new DLMM(connection, poolAddress);
    }
    constructor(connection, poolAddress) {
        this.connection = connection;
        this.poolAddress = poolAddress;
    }
    async getBinArrayForSwap(swapYtoX) {
        // Mock implementation - replace with actual method
        return [];
    }
    swapQuote(swapAmount, swapYtoX, slippage, binArrays, isPartialFill, maxExtraBinArrays) {
        // Mock implementation - replace with actual method
        return {
            consumedInAmount: new bn_js_1.default(swapAmount),
            outAmount: new bn_js_1.default(swapAmount.mul(new bn_js_1.default(95)).div(new bn_js_1.default(100))), // 5% slippage mock
            feeAmount: new bn_js_1.default(0),
            binArrays: []
        };
    }
}
class PriceQuoteService {
    constructor(rpcConfig) {
        this.connection = new web3_js_1.Connection(rpcConfig.endpoint, rpcConfig.commitment);
    }
    async getPriceQuote(poolConfig) {
        const startTime = Date.now();
        try {
            logger_1.logger.info(`Getting price quote for pool: ${poolConfig.name}`);
            const poolAddress = new web3_js_1.PublicKey(poolConfig.address);
            const swapAmount = new bn_js_1.default(poolConfig.swapAmount);
            const dlmmPool = await DLMM.create(this.connection, poolAddress, {
                cluster: "mainnet-beta",
            });
            const binArrays = await dlmmPool.getBinArrayForSwap(poolConfig.swapYtoX);
            const swapQuote = dlmmPool.swapQuote(swapAmount, poolConfig.swapYtoX, new bn_js_1.default(10), // slippage tolerance
            binArrays, poolConfig.isPartialFill, poolConfig.maxExtraBinArrays);
            const price = this.calculatePrice(swapQuote.consumedInAmount, swapQuote.outAmount, poolConfig.decimals);
            const quote = {
                poolName: poolConfig.name,
                poolAddress: poolConfig.address,
                timestamp: new Date(),
                consumedInAmount: swapQuote.consumedInAmount.toString(),
                outAmount: swapQuote.outAmount.toString(),
                swapYtoX: poolConfig.swapYtoX,
                swapAmount: poolConfig.swapAmount,
                price,
                success: true
            };
            const duration = Date.now() - startTime;
            logger_1.logger.info(`Price quote for ${poolConfig.name}: ${price} (${duration}ms)`);
            return quote;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Error getting price quote for ${poolConfig.name}: ${errorMessage}`);
            return {
                poolName: poolConfig.name,
                poolAddress: poolConfig.address,
                timestamp: new Date(),
                consumedInAmount: "0",
                outAmount: "0",
                swapYtoX: poolConfig.swapYtoX,
                swapAmount: poolConfig.swapAmount,
                price: 0,
                success: false,
                error: errorMessage
            };
        }
    }
    calculatePrice(consumedInAmount, outAmount, decimals) {
        if (consumedInAmount.isZero())
            return 0;
        const inAmount = consumedInAmount.toNumber() / Math.pow(10, decimals);
        const outAmountNum = outAmount.toNumber() / Math.pow(10, decimals);
        return outAmountNum / inAmount;
    }
    async getPriceQuotesForAllPools(poolConfigs) {
        logger_1.logger.info(`Getting price quotes for ${poolConfigs.length} pools`);
        const quotes = await Promise.allSettled(poolConfigs.map(poolConfig => this.getPriceQuote(poolConfig)));
        const results = [];
        quotes.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            }
            else {
                logger_1.logger.error(`Failed to get quote for pool ${poolConfigs[index].name}: ${result.reason}`);
            }
        });
        const successCount = results.filter(q => q.success).length;
        logger_1.logger.info(`Completed price quotes: ${successCount}/${poolConfigs.length} successful`);
        return results;
    }
}
exports.PriceQuoteService = PriceQuoteService;
//# sourceMappingURL=price-quote.service.js.map