import { Keypair } from "@solana/web3.js";
import * as fs from "fs";

/**
 * Load a keypair from a JSON file
 * @param filepath Path to the keypair JSON file
 * @returns Keypair object
 */
export function loadKeypair(filepath: string): Keypair {
    try {
        const keypairString = fs.readFileSync(filepath, "utf8");
        const keypairData = JSON.parse(keypairString);
        return Keypair.fromSecretKey(new Uint8Array(keypairData));
    } catch (error) {
        throw new Error(`Failed to load keypair from ${filepath}: ${error}`);
    }
}

/**
 * Save a keypair to a JSON file
 * @param keypair The keypair to save
 * @param filepath Path where the keypair should be saved
 */
export function saveKeypair(keypair: Keypair, filepath: string): void {
    const keypairData = Array.from(keypair.secretKey);
    fs.writeFileSync(filepath, JSON.stringify(keypairData));
    console.log(`Keypair saved to ${filepath}`);
}

/**
 * Format a number as a token amount with decimals
 * @param amount The raw amount
 * @param decimals Number of decimals (default 6 for USDC)
 * @returns Formatted string
 */
export function formatTokenAmount(amount: number | bigint, decimals: number = 6): string {
    const divisor = Math.pow(10, decimals);
    const value = Number(amount) / divisor;
    return value.toLocaleString(undefined, { 
        minimumFractionDigits: 2,
        maximumFractionDigits: decimals 
    });
}

/**
 * Convert a token amount to its raw form
 * @param amount The human-readable amount
 * @param decimals Number of decimals (default 6 for USDC)
 * @returns Raw amount as bigint
 */
export function toRawAmount(amount: number, decimals: number = 6): bigint {
    const multiplier = Math.pow(10, decimals);
    return BigInt(Math.floor(amount * multiplier));
}