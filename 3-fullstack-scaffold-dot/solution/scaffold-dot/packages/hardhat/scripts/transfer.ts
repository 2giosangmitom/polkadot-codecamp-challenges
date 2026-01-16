import hre from "hardhat";

async function main() {
  // Get the deployer (first account)
  const [deployer] = await hre.ethers.getSigners();
  console.log("Sending from:", deployer.address);

  // The recipient address - change this to your target address
  const recipient = "0xAa8E7C144C29eef192F8c6A52a0531aA4C4137Ea";
  
  // Amount to send (in tokens, not wei) - 1000 tokens
  const amount = hre.ethers.parseUnits("1000", 18);

  // Get the deployed ExampleERC20 contract
  const ExampleERC20 = await hre.ethers.getContractAt(
    "ExampleERC20",
    "0x21cb3940e6Ba5284E1750F1109131a8E8062b9f1" // Update with your deployed contract address
  );

  // Check balance before
  const balanceBefore = await ExampleERC20.balanceOf(recipient);
  console.log("Recipient balance before:", hre.ethers.formatUnits(balanceBefore, 18), "EXT");

  // Transfer tokens
  console.log(`Transferring ${hre.ethers.formatUnits(amount, 18)} EXT to ${recipient}...`);
  const tx = await ExampleERC20.transfer(recipient, amount);
  await tx.wait();
  console.log("Transfer complete! Tx hash:", tx.hash);

  // Check balance after
  const balanceAfter = await ExampleERC20.balanceOf(recipient);
  console.log("Recipient balance after:", hre.ethers.formatUnits(balanceAfter, 18), "EXT");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
