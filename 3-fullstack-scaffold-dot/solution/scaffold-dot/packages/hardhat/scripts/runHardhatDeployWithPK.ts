import * as dotenv from "dotenv";
dotenv.config();
import { Wallet } from "ethers";
import password from "@inquirer/password";
import { spawn } from "child_process";
import { config } from "hardhat";

/**
 * Unencrypts the private key and runs the hardhat deploy command in a subprocess
 * so the environment variable is available when hardhat config loads
 */
async function main() {
  const networkIndex = process.argv.indexOf("--network");
  const networkName = networkIndex !== -1 ? process.argv[networkIndex + 1] : config.defaultNetwork;
  
  // For local development, use the pre-funded dev account (no password needed)
  if (networkName === "localNode" || networkName === "hardhat") {
    console.log("🔑 Using pre-funded dev account for local deployment\n");
    
    const child = spawn(
      "npx",
      ["hardhat", "run", "scripts/deployAll.ts", "--network", networkName],
      {
        stdio: "inherit",
        env: process.env,
      }
    );
    
    child.on("close", (code) => {
      process.exit(code ?? 0);
    });
    return;
  }
  
  // For testnets/mainnets, decrypt the user's account
  const encryptedKey = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
  
  if (!encryptedKey) {
    console.log("🚫️ You don't have a deployer account. Run `yarn generate` or `yarn account:import` first");
    return;
  }
  
  const pass = await password({ message: "Enter password to decrypt private key:" });
  
  try {
    const wallet = await Wallet.fromEncryptedJson(encryptedKey, pass);
    
    console.log(`🔑 Deploying with account: ${wallet.address}\n`);
    
    // Spawn a subprocess with the private key set in environment
    // This ensures hardhat config picks up the key when it loads
    const child = spawn(
      "npx",
      ["hardhat", "run", "scripts/deployAll.ts", "--network", networkName],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          __RUNTIME_DEPLOYER_PRIVATE_KEY: wallet.privateKey,
        },
      }
    );
    
    child.on("close", (code) => {
      process.exit(code ?? 0);
    });
    
  } catch (e) {
    console.error("Failed to decrypt private key. Wrong password?");
    process.exit(1);
  }
}

main().catch(console.error);
