import { TARGET_CHAIN } from "./config";
import { getWallets } from "@mysten/wallet-standard";

let currentAccount = null;

export async function getWalletAndAccount() {
    const wallets = getWallets().get();

    console.table(wallets.map((wallet) => ({
        name: wallet.name,
        chains: wallet.chains?.join(", "),
        features: Object.keys(wallet.features).join(", "),
    })));

    const wallet = wallets.find((wallet) => {
        const supportsTargetChain = wallet.chains?.includes(TARGET_CHAIN);

        const supportsSuiSigning =
            wallet.features["sui:signAndExecuteTransaction"] ||
            wallet.features["sui:signAndExecuteTransactionBlock"];

        const isVault = wallet.name.toLowerCase().includes("eve vault");

        return supportsTargetChain &&
            supportsSuiSigning &&
            isVault;
    });

    if (!wallet) {
        throw new Error("No Eve Vault wallet detected.");
    }

    const connectResult = await wallet.features["standard:connect"].connect();
    const suiAccount = connectResult.accounts?.[0];

    console.log("connected accounts:", connectResult.accounts.map((a) => ({
        address: a.address,
        chains: a.chains,
        features: a.features,
    })));

    if (!suiAccount) {
        throw new Error("No account selected.");
    }

    return { wallet, suiAccount };
}

export async function getCurrentAccount() {
    if (currentAccount) return currentAccount;

    currentAccount = await getWalletAndAccount();
    return currentAccount;
}

export async function signAndExecute(wallet, suiAccount, tx) {
    console.log("wallet name:", wallet.name);
    console.log("wallet features:", Object.keys(wallet.features));

    if (wallet.features["sui:signAndExecuteTransaction"]) {
        console.log("Using sui:signAndExecuteTransaction");

        return await wallet.features["sui:signAndExecuteTransaction"]
            .signAndExecuteTransaction({
                transaction: tx,
                account: suiAccount,
                chain: TARGET_CHAIN,
                options: {
                    showEffects: true,
                    showObjectChanges: true,
                    showEvents: true,
                },
            });
    }

    if (wallet.features["sui:signAndExecuteTransactionBlock"]) {
        console.log("Using sui:signAndExecuteTransactionBlock");

        return await wallet.features["sui:signAndExecuteTransactionBlock"]
            .signAndExecuteTransactionBlock({
                transactionBlock: tx,
                account: suiAccount,
                chain: TARGET_CHAIN,
                options: {
                    showEffects: true,
                    showObjectChanges: true,
                    showEvents: true,
                    showBalanceChanges: true,
                },
            });
    }

    throw new Error("Wallet does not support Sui transaction execution.");
}