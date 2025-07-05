import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { PoolConfig, PriceQuote, RpcConfig } from "../types";
import { logger } from "../utils/logger";
import DLMM from '@meteora-ag/dlmm'

export class PriceQuoteService {
  private connection: Connection;

  constructor(rpcConfig: RpcConfig) {
    this.connection = new Connection(rpcConfig.endpoint, rpcConfig.commitment as any);
  }

  async getPriceQuote(poolConfig: PoolConfig): Promise<PriceQuote> {
    const startTime = Date.now();
    
    try {
      logger.info(`Getting price quote for pool: ${poolConfig.name}`);
      
      const poolAddress = new PublicKey(poolConfig.address);
      const swapAmount = new BN(poolConfig.swapAmount);
      
      const dlmmPool = await DLMM.create(this.connection, poolAddress, {
        cluster: "mainnet-beta",
      });

      const binArrays = await dlmmPool.getBinArrayForSwap(poolConfig.swapYtoX);

      const swapQuote = dlmmPool.swapQuote(
        swapAmount,
        poolConfig.swapYtoX,
        new BN(10), // slippage tolerance
        binArrays,
        poolConfig.isPartialFill,
        poolConfig.maxExtraBinArrays
      );

      const price = this.calculatePrice(
        swapQuote.consumedInAmount,
        swapQuote.outAmount,
        poolConfig.decimals
      );

      const quote: PriceQuote = {
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
      logger.info(`Price quote for ${poolConfig.name}: ${price} (${duration}ms)`);

      return quote;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error getting price quote for ${poolConfig.name}: ${errorMessage}`);
      
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

  private calculatePrice(consumedInAmount: BN, outAmount: BN, decimals: number): number {
    if (consumedInAmount.isZero()) return 0;
    
    const inAmount = consumedInAmount.toNumber() / Math.pow(10, decimals);
    const outAmountNum = outAmount.toNumber() / Math.pow(10, decimals);
    
    return outAmountNum / inAmount;
  }

  async getPriceQuotesForAllPools(poolConfigs: PoolConfig[]): Promise<PriceQuote[]> {
    logger.info(`Getting price quotes for ${poolConfigs.length} pools`);
    
    const quotes = await Promise.allSettled(
      poolConfigs.map(poolConfig => this.getPriceQuote(poolConfig))
    );

    const results: PriceQuote[] = [];
    quotes.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        logger.error(`Failed to get quote for pool ${poolConfigs[index].name}: ${result.reason}`);
      }
    });

    const successCount = results.filter(q => q.success).length;
    logger.info(`Completed price quotes: ${successCount}/${poolConfigs.length} successful`);

    return results;
  }
} 