// Offline, test-only setup. Never overwrites a wallet file and never prints a key.
import fs from "node:fs";
import path from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { root } from "../src/store.ts";
const directory = path.join(root, ".local");
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const file = path.join(directory, "test-wallets.json");
if (fs.existsSync(file))
  throw Error("A test wallet file already exists; refusing to overwrite it.");
const roles = Object.fromEntries(
  ["deployer", "buyer", "counterparty"].map((role) => {
    const privateKey = generatePrivateKey();
    return [
      role,
      { address: privateKeyToAccount(privateKey).address, privateKey },
    ];
  }),
);
fs.writeFileSync(
  file,
  JSON.stringify(
    { testOnly: true, chainId: 84532, project: "second-order", roles },
    null,
    2,
  ) + "\n",
  { flag: "wx", mode: 0o600 },
);
console.log({
  walletFile: file,
  testOnly: true,
  chainId: 84532,
  addresses: Object.fromEntries(
    Object.entries(roles).map(([role, value]) => [role, value.address]),
  ),
  next: "Fund only with Base Sepolia test ETH. Set WALLET_FILE in your private .env. Do not send real ETH or share keys.",
});
