import { deployYourContract } from "./deploy";

async function main() {
  await deployYourContract();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
