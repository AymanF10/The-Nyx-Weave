import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import DLMM from "@meteora-ag/dlmm";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TheNyxWeave } from "../target/types/the_nyx_weave";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { GetCommitmentSignature } from "@magicblock-labs/ephemeral-rollups-sdk";

describe("scan meteora, execute arbitrage", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TheNyxWeave as Program<TheNyxWeave>;

  console.log("Program ID: ", program.programId.toString());

  const providerEphemeralRollup = new anchor.AnchorProvider(
    new anchor.web3.Connection(
      process.env.PROVIDER_ENDPOINT || "https://devnet.magicblock.app/",
      {
        wsEndpoint: process.env.WS_ENDPOINT || "wss://devnet.magicblock.app/",
      }
    ),
    anchor.Wallet.local()
  );
  console.log("Base Layer Connection: ", provider.connection.rpcEndpoint);
  
  console.log(
    "Ephemeral Rollup Connection: ",
    providerEphemeralRollup.connection.rpcEndpoint
  );
  

  console.log(`Current SOL Public Key: ${anchor.Wallet.local().publicKey}`);

  before(async function () {
    const balance = await provider.connection.getBalance(
      anchor.Wallet.local().publicKey
    );
    console.log("Current balance is", balance / LAMPORTS_PER_SOL, " SOL", "\n");
  });


  it("Fetches Pools Details", async () => {
    const TRUMP_USDC_POOL_1 = new PublicKey('9d9mb8kooFfaD3SctgZtkxQypkshx6ezhbKio89ixyy2')
    const TRUMP_USDC_POOL_2 = new PublicKey('3C5YE97HADPDxZehYq9Cis8AXr9aNyrUsczKzE1nDbW9')
    
  let rpc = process.env.RPC || "https://mainnet.helius-rpc.com/?api-key=9911d2bb-0d88-4e1a-a3ed-441b84305680";
  const connection = new Connection(rpc, "finalized");
  const dlmmPool1 = await DLMM.create(connection, TRUMP_USDC_POOL_1);
  const dlmmPool2 = await DLMM.create(connection, TRUMP_USDC_POOL_2);
  // const lbPairLockInfo = await dlmmPool1.getLbPairLockInfo();
  console.log("Current price of TRUMP in PoolA:", (await dlmmPool1.getActiveBin()).price )
  console.log("Current price of TRUMP in PoolB:", (await dlmmPool2.getActiveBin()).price )
  
  });

});