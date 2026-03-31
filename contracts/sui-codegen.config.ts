import type { SuiCodegenConfig } from "@mysten/codegen";
import dotenv from "dotenv";

dotenv.config({ path: "../.env.devnet" });
const packageId = process.env.VITE_HASHI_PACKAGE_ID;
if (!packageId) throw new Error("VITE_HASHI_PACKAGE_ID not set in .env.devnet");

const config: SuiCodegenConfig = {
  output: "./src",
  packages: [
    {
      package: packageId,
      packageName: "hashi",
      network: "testnet",
      generate: {
        modules: [
          "deposit",
          "deposit_queue",
          "utxo",
          "withdraw",
          "withdrawal_queue",
        ],
      },
    },
  ],
};

export default config;
