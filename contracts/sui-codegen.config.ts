import type { SuiCodegenConfig } from "@mysten/codegen";

const config: SuiCodegenConfig = {
  output: "./src",
  packages: [
    {
      package:
        "0xe87f0c85488c5c442612103a08e5df93d2f190cdb0456b667f5257be506aefc7",
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
