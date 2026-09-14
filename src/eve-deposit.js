import { Transaction } from "@mysten/sui/transactions";

import { suiClient } from "./sui-client.js";
import {
    getWalletAndAccount,
    signAndExecute,
} from "./wallet.js";

const PACKAGE_ID =
    "0xa2f86c3e24b229cf9b287dcdfd959b4e3c313fc8709f1b4a81af23d403903ea1";

const TREASURY_ID =
    "0x60ad496cae0087e540abab97f076cda9617651521a337f8a026163788e1eb909";

const EVE_TYPE =
    "0xac361aa5ceb726bd974f885c9dea9e55dc9bc98fa1f5731c5965a810707bf0b8::EVE::EVE";

const EVE_DECIMALS = 9;
const EVE_SCALE = 10n ** BigInt(EVE_DECIMALS);

let currentWallet = null;
let currentAccount = null;

const el = (id) => document.getElementById(id);


// ---------------------------------------------------------
// PAGE SETUP
// ---------------------------------------------------------

el("package-id").textContent = PACKAGE_ID;
el("treasury-id").textContent = TREASURY_ID;
el("eve-type").textContent = EVE_TYPE;


// ---------------------------------------------------------
// STATUS
// ---------------------------------------------------------

function setStatus(message, className = "muted") {
    const status = el("status");

    status.className = className;
    status.textContent = message;
}


// ---------------------------------------------------------
// EVE AMOUNT HELPERS
// ---------------------------------------------------------

function formatEve(value) {
    const amount = BigInt(value);

    const whole = amount / EVE_SCALE;

    const fraction = (amount % EVE_SCALE)
        .toString()
        .padStart(EVE_DECIMALS, "0")
        .replace(/0+$/, "");

    return fraction
        ? `${whole}.${fraction}`
        : `${whole}`;
}


function parseEve(value) {
    const text = value.trim();

    if (!/^\d+(\.\d+)?$/.test(text)) {
        throw new Error(
            "Enter a positive EVE amount, e.g. 0.01"
        );
    }

    const [whole, fraction = ""] = text.split(".");

    if (fraction.length > EVE_DECIMALS) {
        throw new Error(
            `EVE supports at most ${EVE_DECIMALS} decimal places.`
        );
    }

    const paddedFraction =
        fraction.padEnd(EVE_DECIMALS, "0");

    const amount =
        BigInt(whole) * EVE_SCALE +
        BigInt(paddedFraction || "0");

    if (amount <= 0n) {
        throw new Error(
            "Deposit amount must be greater than zero."
        );
    }

    return amount;
}


// ---------------------------------------------------------
// READ ALL EVE COINS OWNED BY WALLET
// ---------------------------------------------------------

async function getAllEveCoins(owner) {
    const coins = [];

    let page = await suiClient.listCoins({
        owner,
        coinType: EVE_TYPE,
        limit: 50,
    });

    while (true) {
        coins.push(...page.objects);

        if (!page.hasNextPage) {
            break;
        }

        page = await suiClient.listCoins({
            owner,
            coinType: EVE_TYPE,
            cursor: page.cursor,
            limit: 50,
        });
    }

    console.log("EVE coin objects:", coins);

    return coins;
}


// ---------------------------------------------------------
// READ VYLENT TREASURY BALANCE
// ---------------------------------------------------------

async function getTreasuryBalance() {
    const { object } = await suiClient.getObject({
        objectId: TREASURY_ID,
        include: {
            json: true,
        },
    });

    console.log("Treasury object:", object);

    if (!object) {
        throw new Error("EveTreasury object not found.");
    }

    console.log("Treasury JSON:", object.json);

    const fields = object.json;

    if (!fields) {
        throw new Error(
            "Treasury object returned without JSON fields. See console."
        );
    }

    const balance =
        fields.balance ??
        fields.balance?.value ??
        fields.balance?.fields?.value ??
        fields.balance?.fields?.balance;

    if (balance == null) {
        console.log("Treasury fields:", fields);

        throw new Error(
            "Treasury found, but couldn't locate its EVE balance. See console."
        );
    }

    return BigInt(balance);
}


// ---------------------------------------------------------
// REFRESH WALLET + TREASURY BALANCES
// ---------------------------------------------------------

async function refreshBalances() {
    if (!currentAccount) {
        return;
    }

    const [coins, treasuryBalance] =
        await Promise.all([
            getAllEveCoins(
                currentAccount.address
            ),

            getTreasuryBalance(),
        ]);

    const walletTotal =
        coins.reduce(
            (total, coin) =>
                total + BigInt(coin.balance),
            0n
        );

    el("wallet-balance").textContent =
        `${formatEve(walletTotal)} EVE`;

    el("treasury-balance").textContent =
        `${formatEve(treasuryBalance)} EVE`;

    return {
        coins,
        walletTotal,
        treasuryBalance,
    };
}


// ---------------------------------------------------------
// CONNECT EVE VAULT
// ---------------------------------------------------------

async function connect() {
    try {
        setStatus(
            "Requesting Eve Vault connection…"
        );

        console.log("PAGE ORIGIN:", {
            href: window.location.href,
            origin: window.location.origin,
            protocol: window.location.protocol,
            isTopLevel:
                window.top === window.self,
        });

        const result =
            await getWalletAndAccount();

        currentWallet = result.wallet;
        currentAccount = result.suiAccount;

        console.log(
            "CONNECTED TO:",
            currentWallet.name
        );

        console.log(
            "ACCOUNT:",
            currentAccount.address
        );

        el("wallet-address").textContent =
            currentAccount.address;

        el("deposit-button").disabled =
            false;

        el("refresh-button").disabled =
            false;

        el("connect-button").textContent =
            "EVE VAULT CONNECTED";

        await refreshBalances();

        setStatus(
            "Connected.\nReady to deposit testnet EVE.",
            "success"
        );

    } catch (error) {
        console.error(
            "EVE Vault connection failed:",
            error
        );

        setStatus(
            error?.message ?? String(error),
            "error"
        );
    }
}


// ---------------------------------------------------------
// CHOOSE ENOUGH COIN OBJECTS TO COVER DEPOSIT
// ---------------------------------------------------------

function chooseCoins(
    coins,
    requiredAmount
) {
    const sorted =
        [...coins].sort(
            (a, b) =>
                BigInt(b.balance) >
                BigInt(a.balance)
                    ? 1
                    : BigInt(b.balance) <
                    BigInt(a.balance)
                        ? -1
                        : 0
        );

    const selected = [];

    let total = 0n;

    for (const coin of sorted) {
        selected.push(coin);

        total +=
            BigInt(coin.balance);

        if (total >= requiredAmount) {
            break;
        }
    }

    if (total < requiredAmount) {
        throw new Error(
            `Not enough EVE.\nWallet has ${formatEve(total)} EVE, deposit requires ${formatEve(requiredAmount)} EVE.`
        );
    }

    return selected;
}


// ---------------------------------------------------------
// DEPOSIT EVE
// ---------------------------------------------------------

async function deposit() {
    if (
        !currentWallet ||
        !currentAccount
    ) {
        throw new Error(
            "Connect Eve Vault first."
        );
    }

    const amount =
        parseEve(
            el("amount").value
        );

    const allCoins =
        await getAllEveCoins(
            currentAccount.address
        );

    const selectedCoins =
        chooseCoins(
            allCoins,
            amount
        );

    const tx =
        new Transaction();

    const primaryCoin =
        tx.object(
            selectedCoins[0]
                .objectId
        );

    // Merge multiple EVE coin objects
    // if necessary.

    if (
        selectedCoins.length > 1
    ) {
        tx.mergeCoins(
            primaryCoin,

            selectedCoins
                .slice(1)
                .map(
                    (coin) =>
                        tx.object(
                            coin.objectId
                        )
                )
        );
    }

    // Split off exactly the amount
    // being deposited.

    const [depositCoin] =
        tx.splitCoins(
            primaryCoin,
            [
                tx.pure.u64(
                    amount
                ),
            ]
        );

    // Call Vylent Move contract.

    tx.moveCall({
        target:
            `${PACKAGE_ID}::vylent_free_stuff::deposit_eve`,

        arguments: [
            tx.object(
                TREASURY_ID
            ),

            depositCoin,
        ],
    });

    setStatus(
        `Submitting ${formatEve(amount)} EVE deposit.\nApprove the transaction in Eve Vault…`
    );

    el("deposit-button").disabled =
        true;

    try {
        const result =
            await signAndExecute(
                currentWallet,
                currentAccount,
                tx
            );

        console.log(
            "deposit_eve result:",
            result
        );

        const digest =
            result?.digest
            ?? result?.effects
                ?.transactionDigest
            ?? "unknown";

        setStatus(
            `SUCCESS\nDeposited ${formatEve(amount)} EVE.\nTransaction: ${digest}`,
            "success"
        );

        await refreshBalances();

    } finally {
        el("deposit-button").disabled =
            false;
    }
}


// ---------------------------------------------------------
// BUTTONS
// ---------------------------------------------------------

el("connect-button")
    .addEventListener(
        "click",
        connect
    );


el("refresh-button")
    .addEventListener(
        "click",
        async () => {
            try {
                setStatus(
                    "Refreshing balances…"
                );

                await refreshBalances();

                setStatus(
                    "Balances refreshed.",
                    "success"
                );

            } catch (error) {
                console.error(error);

                setStatus(
                    error?.message ??
                    String(error),
                    "error"
                );
            }
        }
    );


el("deposit-button")
    .addEventListener(
        "click",
        async () => {
            try {
                await deposit();

            } catch (error) {
                console.error(error);

                setStatus(
                    error?.message ??
                    String(error),
                    "error"
                );

                el(
                    "deposit-button"
                ).disabled = false;
            }
        }
    );