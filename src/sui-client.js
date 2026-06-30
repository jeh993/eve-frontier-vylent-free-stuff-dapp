import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

export function getRpcUrl(network) {
    if (network === "localnet") return "http://127.0.0.1:9000";
    if (network === "testnet") return "https://fullnode.testnet.sui.io:443";
    if (network === "mainnet") return "https://fullnode.mainnet.sui.io:443";
    throw new Error(`Unsupported network: ${network}`);
}

export const NETWORK = "testnet";

export const suiClient = new SuiJsonRpcClient({
    url: getRpcUrl(NETWORK),
});