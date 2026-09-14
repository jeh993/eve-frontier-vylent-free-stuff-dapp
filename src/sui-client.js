import { SuiGrpcClient } from "@mysten/sui/grpc";

export const NETWORK = "testnet";

export function getRpcUrl(network) {
    if (network === "testnet") {
        return "https://fullnode.testnet.sui.io:443";
    }

    if (network === "mainnet") {
        return "https://fullnode.mainnet.sui.io:443";
    }

    throw new Error(`Unsupported network: ${network}`);
}

export const suiClient = new SuiGrpcClient({
    network: NETWORK,
    baseUrl: getRpcUrl(NETWORK),
});