import { describe, it } from "node:test";
import { BN, Program } from "@coral-xyz/anchor";
import { BankrunProvider } from "anchor-bankrun";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createAccount, createMint, mintTo } from "spl-token-bankrun";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { struct, u32 } from "@solana/buffer-layout";
import { u64 } from "@solana/buffer-layout-utils";

import {
  startAnchor,
  BanksClient,
  ProgramTestContext,
  AddedAccount,
} from "solana-bankrun";

import { PublicKey, Keypair, Connection } from "@solana/web3.js";

import { Lending } from "../target/types/lending";
import { BankrunContextWrapper } from "../bankrun-utils/bankrunConnection";
import { assert } from "chai";

describe("Lending Bankrun Tests", async () => {
  const IDL = require("../target/idl/lending.json");
  let signer: Keypair;
  let usdcBankAccount: PublicKey;
  let solBankAccount: PublicKey;
  let userAccount: PublicKey;

  let solTokenAccount: PublicKey;
  let provider: BankrunProvider;
  let program: Program<Lending>;
  let banksClient: BanksClient;
  let context: ProgramTestContext;
  let bankrunContextWrapper: BankrunContextWrapper;

  const devnetConnection = new Connection(
    "https://devnet.helius-rpc.com/?api-key=47fcd2c1-bfb0-4224-8257-ce200078152a"
  );

  context = await startAnchor("", [], []);
  provider = new BankrunProvider(context);

  bankrunContextWrapper = new BankrunContextWrapper(context);

  const connection = bankrunContextWrapper.connection.toConnection();

  const pythSolanaReceiver = new PythSolanaReceiver({
    connection,
    wallet: provider.wallet,
  });

  const SOL_PRICE_FEED_ID =
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
  const USDC_PRICE_FEED_ID =
    "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";

  const solUsdPriceFeedAccount = pythSolanaReceiver
    .getPriceFeedAccountAddress(0, SOL_PRICE_FEED_ID)
    .toBase58();

  const usdcUsdPriceFeedAccount = pythSolanaReceiver
    .getPriceFeedAccountAddress(0, USDC_PRICE_FEED_ID)
    .toBase58();

  // console.log("solUsdPriceFeedAccount:", solUsdPriceFeedAccount);
  // console.log("usdcUsdPriceFeedAccount:", usdcUsdPriceFeedAccount);

  const solUsdPriceFeedAccountPubkey = new PublicKey(solUsdPriceFeedAccount);
  const solUsdPriceFeedAccountInfo = await devnetConnection.getAccountInfo(
    solUsdPriceFeedAccountPubkey
  );

  const usdcUsdPriceFeedAccountPubkey = new PublicKey(usdcUsdPriceFeedAccount);
  const usdcUsdPriceFeedAccountInfo = await devnetConnection.getAccountInfo(
    usdcUsdPriceFeedAccountPubkey
  );
  console.log("usdcUsdPriceFeedAccountAddress:", usdcUsdPriceFeedAccountPubkey);

  context.setAccount(solUsdPriceFeedAccountPubkey, solUsdPriceFeedAccountInfo);
  context.setAccount(
    usdcUsdPriceFeedAccountPubkey,
    usdcUsdPriceFeedAccountInfo
  );

  // console.log("pricefeed:", solUsdPriceFeedAccount);

  // console.log("Pyth Account Info:", accountInfo);

  program = new Program<Lending>(IDL as Lending, provider);

  banksClient = context.banksClient;

  signer = provider.wallet.payer;

  const mintUSDC = await createMint(
    // @ts-ignore
    banksClient,
    signer,
    signer.publicKey,
    null,
    6
  );

  const mintSOL = await createMint(
    // @ts-ignore
    banksClient,
    signer,
    signer.publicKey,
    null,
    6
  );

  [userAccount] = PublicKey.findProgramAddressSync(
    [signer.publicKey.toBuffer()],
    program.programId
  );

  [usdcBankAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), mintUSDC.toBuffer()],
    program.programId
  );

  [solBankAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), mintSOL.toBuffer()],
    program.programId
  );

  [solTokenAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), mintSOL.toBuffer()],
    program.programId
  );

  console.log("USDC Bank Account", usdcBankAccount.toBase58());

  console.log("SOL Bank Account", solBankAccount.toBase58());

  it("Test Init User", async () => {
    const initUserTx = await program.methods
      .initUser(mintUSDC)
      .signers([signer])
      .rpc({ commitment: "confirmed" });

    console.log("Create User Account", initUserTx);
  });

  it("Init USDC Bank", async () => {
    const initUSDCBankTx = await program.methods
      .initBank(new BN(8_500), new BN(8_000), new BN(5_000), new BN(500))
      .accounts({
        mint: mintUSDC,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([signer])
      .rpc({ commitment: "confirmed" });

    console.log("Create USDC Bank Account", initUSDCBankTx);

    const amount = 10_000 * 10 ** 9;
    const mintTx = await mintTo(
      // @ts-ignores
      banksClient,
      signer,
      mintUSDC,
      usdcBankAccount,
      signer,
      amount
    );

    console.log("Mint to USDC Bank Signature:", mintTx);
  });

  it("Init SOL Bank", async () => {
    const initSOLBankTx = await program.methods
      .initBank(new BN(8_500), new BN(8_000), new BN(5_000), new BN(500))
      .accounts({
        mint: mintSOL,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([signer])
      .rpc({ commitment: "confirmed" });

    console.log("Create SOL Bank Account", initSOLBankTx);

    const amount = 10_000 * 10 ** 9;
    const mintSOLTx = await mintTo(
      // @ts-ignores
      banksClient,
      signer,
      mintSOL,
      solBankAccount,
      signer,
      amount
    );

    console.log("Mint to SOL Bank Signature:", mintSOLTx);
  });

  it("Create and USDC Token Account", async () => {
    const USDCTokenAccount = await createAccount(
      // @ts-ignores
      banksClient,
      signer,
      mintUSDC,
      signer.publicKey
    );

    console.log("USDC Token Account Created:", USDCTokenAccount);

    const amount = 10_000 * 10 ** 9;
    const mintUSDCTx = await mintTo(
      // @ts-ignores
      banksClient,
      signer,
      mintUSDC,
      USDCTokenAccount,
      signer,
      amount
    );

    console.log("Mint to USDC Bank Signature:", mintUSDCTx);
  });

  it("Test Deposit", async () => {
    const depositUSDC = await program.methods
      .deposit(new BN(1000_000_000))
      .accounts({
        mint: mintUSDC,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([signer])
      .rpc({ commitment: "confirmed" });

    console.log("Deposit USDC", depositUSDC);

    const user = await program.account.user.fetch(userAccount);

    assert.equal(user.depositedUsdc.toNumber(), 1000_000_000);
  });

  it("Test Borrow", async () => {
    const borrowSOL = await program.methods
      .borrow(new BN(2_000_000))
      .accounts({
        mint: mintSOL,
        tokenProgram: TOKEN_PROGRAM_ID,
        solOrUsdcPriceFeed: usdcUsdPriceFeedAccountPubkey,
      })
      .signers([signer])
      .rpc({ commitment: "confirmed" });

    console.log("Borrow SOL", borrowSOL);

    const user = await program.account.user.fetch(userAccount);
    assert.equal(user.borrowedSol.toNumber(), 2_000_000);
  });

  it("Test Repay", async () => {
    const repaySOL = await program.methods
      .repay(new BN(1_000_000))
      .accounts({
        mint: mintSOL,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([signer])
      .rpc({ commitment: "confirmed" });

    console.log("Repay SOL", repaySOL);

    const user = await program.account.user.fetch(userAccount);
    assert.equal(user.borrowedSol.toNumber(), 1_000_000);
  });

  it("Test Withdraw", async () => {
    const withdrawUSDC = await program.methods
      .withdraw(new BN(50_000_000))
      .accounts({
        mint: mintUSDC,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([signer])
      .rpc({ commitment: "confirmed" });

    console.log("Withdraw USDC", withdrawUSDC);

    const user = await program.account.user.fetch(userAccount);
    assert.equal(user.depositedUsdc.toNumber(), 950_000_000);
  });

  it("test liquidate", async () => {
    await program.methods
      .liquidate()
      .accounts({
        collateralMint: mintUSDC,
        borrowedMint: mintSOL,
        solPriceFeed: solUsdPriceFeedAccountPubkey,
        usdcPriceFeed: usdcUsdPriceFeedAccountPubkey,
        liquidator: signer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([signer])
      .rpc({ commitment: "confirmed" });
  });

  // it("test liquidate by chaning sol price", async () => {

  //   const PriceFeedData = Buffer.alloc();
  //   interface PriceFeed {
  //     price: bigint;
  //     conf: bigint;
  //     expo: number;
  //     publish_time: bigint;
  //   }
  //   const PriceFeedstruct = struct<PriceFeed>([
  //     u64("price"),
  //     u64("conf"),
  //     u32("expo"),
  //     u64("publish_time"),
  //   ]);
  //   const priceFeed = PriceFeedstruct.encode({
  //     price: BigInt(1000000000),
  //     conf: BigInt(1000000000),
  //     expo: 9,
  //     publish_time: BigInt(Math.floor(Date.now() / 1000)),
  //   },

  //   );

  //   await program.methods
  //     .liquidate()
  //     .accounts({
  //       collateralMint: mintUSDC,
  //       borrowedMint: mintSOL,
  //       solPriceFeed: solUsdPriceFeedAccountPubkey,
  //       usdcPriceFeed: usdcUsdPriceFeedAccountPubkey,
  //       liquidator: signer.publicKey,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //     })
  //     .signers([signer])
  //     .rpc({ commitment: "confirmed" });

  //   // Add assertions to verify liquidation worked
  //   // Check updated bank states, user positions, etc
  // });
});
