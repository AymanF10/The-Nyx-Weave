import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo
} from '@solana/spl-token';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { expect } from 'chai';
import {
    buildDepositIx,
    buildInitializeIx,
    buildWithdrawAllIx,
    buildWithdrawIx
} from '../sdk/nyx-weave-client';


describe('thenyxweave treasury tests', () => {

  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.the_nyx_weave as Program;

  const connection = provider.connection;
  const payer = provider.wallet.payer as Keypair;

  const admin = Keypair.generate();

  let globalConfigPda: PublicKey;
  let treasuryVaultPda: PublicKey;


  const mints: Record<string, PublicKey> = {};
  const adminAtas: Record<string, PublicKey> = {};
  const vaultAtas: Record<string, PublicKey> = {};

  const getTokenBalance = async (ata: PublicKey) => {
    const acct = (await connection.getParsedAccountInfo(ata)).value
      ?.data as unknown as { parsed: { info: { tokenAmount: { amount: string } } } };
    return BigInt(acct.parsed.info.tokenAmount.amount);
  };

  before('airdrop SOL & create SPL mints', async () => {
    // funds
    await connection.confirmTransaction(
      await connection.requestAirdrop(admin.publicKey, 10 * web3.LAMPORTS_PER_SOL),
      'confirmed'
    );

    // three arbitrary mints standing in for USDC/WSOL/JITO
    for (const label of ['usdc', 'wsol', 'jito'] as const) {
      const mint = await createMint(
        connection,
        payer,
        admin.publicKey, // mint authority
        null,
        6 // decimals
      );
      mints[label] = mint;

      // admin ATA
      adminAtas[label] = (
        await getOrCreateAssociatedTokenAccount(
          connection,
          payer,
          mint,
          admin.publicKey
        )
      ).address;

      // vault ATA (will belong to PDA once we know it)
    }
  });

  it('initializes treasury & config', async () => {
    const initIx = await buildInitializeIx({
      admin: admin.publicKey,
      feeBps: 250,
      maxRetries: 3,
    });

    globalConfigPda = initIx.keys[1].pubkey;
    treasuryVaultPda = initIx.keys[2].pubkey;

    for (const label of ['usdc', 'wsol', 'jito'] as const) {
      vaultAtas[label] = (
        await getOrCreateAssociatedTokenAccount(
          connection,
          payer,
          mints[label],
          treasuryVaultPda,
          true
        )
      ).address;
    }

    const tx = new Transaction().add(initIx);
    await provider.sendAndConfirm(tx, [admin]);

    // sanity: config PDA now exists
    const cfgInfo = await connection.getAccountInfo(globalConfigPda);
    expect(cfgInfo).to.not.equal(null);
  });

  it('deposits 100 tokens (USDC) into treasury', async () => {
    const amount = 100_000; // 100 with 6 decimals

    await mintTo(
      connection,
      payer,
      mints.usdc,
      adminAtas.usdc,
      admin,
      Number(amount)
    );

    const beforeAdmin = await getTokenBalance(adminAtas.usdc);
    const beforeVault = await getTokenBalance(vaultAtas.usdc);

    const amountBigInt = BigInt(amount);

    const depositIx = await buildDepositIx({
      admin: admin.publicKey,
      mint: mints.usdc,
      amount: amountBigInt,
      usdcMint: mints.usdc,
      wsolMint: mints.wsol,
      jitoMint: mints.jito,
      adminUsdcAta: adminAtas.usdc,
      adminWsolAta: adminAtas.wsol,
      adminJitoAta: adminAtas.jito,
      treasuryVaultUsdcAta: vaultAtas.usdc,
      treasuryVaultWsolAta: vaultAtas.wsol,
      treasuryVaultJitoAta: vaultAtas.jito,
    });

    await provider.sendAndConfirm(new Transaction().add(depositIx), [admin]);

    const afterAdmin = await getTokenBalance(adminAtas.usdc);
    const afterVault = await getTokenBalance(vaultAtas.usdc);

    expect(afterAdmin).to.equal(beforeAdmin - amountBigInt);
    expect(afterVault).to.equal(beforeVault + amountBigInt);
  });

  it.skip('withdraws 40 tokens (USDC) from treasury', async () => {
    const amount = 40_000;

    const beforeAdmin = await getTokenBalance(adminAtas.usdc);
    const beforeVault = await getTokenBalance(vaultAtas.usdc);

    const amountBigInt = BigInt(amount);

    const withdrawIx = await buildWithdrawIx({
      admin: admin.publicKey,
      mint: mints.usdc,
      amount: amountBigInt,
      usdcMint: mints.usdc,
      wsolMint: mints.wsol,
      jitoMint: mints.jito,
      adminUsdcAta: adminAtas.usdc,
      adminWsolAta: adminAtas.wsol,
      adminJitoAta: adminAtas.jito,
      treasuryVaultUsdcAta: vaultAtas.usdc,
      treasuryVaultWsolAta: vaultAtas.wsol,
      treasuryVaultJitoAta: vaultAtas.jito,
    });

    await provider.sendAndConfirm(new Transaction().add(withdrawIx), [admin]);

    const afterAdmin = await getTokenBalance(adminAtas.usdc);
    const afterVault = await getTokenBalance(vaultAtas.usdc);

    expect(afterAdmin).to.equal(beforeAdmin + amountBigInt);
    expect(afterVault).to.equal(beforeVault - amountBigInt);
  });

  it.skip('withdraws ALL remaining tokens from treasury', async () => {
    const beforeAdmin = {
      usdc: await getTokenBalance(adminAtas.usdc),
      wsol: await getTokenBalance(adminAtas.wsol),
      jito: await getTokenBalance(adminAtas.jito),
    };
    const beforeVault = {
      usdc: await getTokenBalance(vaultAtas.usdc),
      wsol: await getTokenBalance(vaultAtas.wsol),
      jito: await getTokenBalance(vaultAtas.jito),
    };

    const withdrawAllIx = await buildWithdrawAllIx({
      admin: admin.publicKey,
      usdcMint: mints.usdc,
      wsolMint: mints.wsol,
      jitoMint: mints.jito,
      adminUsdcAta: adminAtas.usdc,
      adminWsolAta: adminAtas.wsol,
      adminJitoAta: adminAtas.jito,
      treasuryVaultUsdcAta: vaultAtas.usdc,
      treasuryVaultWsolAta: vaultAtas.wsol,
      treasuryVaultJitoAta: vaultAtas.jito,
    });

    await provider.sendAndConfirm(new Transaction().add(withdrawAllIx), [admin]);

    const afterAdmin = {
      usdc: await getTokenBalance(adminAtas.usdc),
      wsol: await getTokenBalance(adminAtas.wsol),
      jito: await getTokenBalance(adminAtas.jito),
    };
    const afterVault = {
      usdc: await getTokenBalance(vaultAtas.usdc),
      wsol: await getTokenBalance(vaultAtas.wsol),
      jito: await getTokenBalance(vaultAtas.jito),
    };

    for (const label of ['usdc', 'wsol', 'jito'] as const) {
      expect(afterAdmin[label]).to.equal(beforeAdmin[label] + beforeVault[label]);
      expect(afterVault[label]).to.equal(0);
    }
  });
});
