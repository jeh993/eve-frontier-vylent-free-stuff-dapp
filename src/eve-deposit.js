import { Transaction } from "@mysten/sui/transactions";
import { suiClient } from "./sui-client";
import { getWalletAndAccount, signAndExecute } from "./wallet";

const PACKAGE_ID =
    "0xa2f86c3e24b229cf9b287dcdfd959b4e3c313fc8709f1b4a81af23d403903ea1";

const TREASURY_ID =
    "0x60ad496cae0087e540abab97f076cda9617651521a337f8a026163788e1eb909";

const EVE_TYPE =
    "0xac361aa5ceb726bd974f885c9dea9e55dc9bc98fa1f5731c5965a810707bf0b8::EVE::EVE";

const EVE_DECIMALS = 9;
const EVE_SCALE = 10n ** BigInt(EVE_DECIMALS);

let wallet = null;
let account = null;

const $ = (id) => document.getElementById(id);

$("package-id").textContent = PACKAGE_ID;
$("treasury-id").textContent = TREASURY_ID;
$("eve-type").textContent = EVE_TYPE;

function setStatus(message, kind = "muted") {
    const el = $("status");
    el.className = kind;
    el.textContent = message;
}

function formatEve(baseUnits) {
    const value = BigInt(baseUnits);
    const whole = value / EVE_SCALE;

    const fraction = (value % EVE_SCALE)
        .toString()
        .padStart(EVE_DECIMALS, "0")
        .replace(/0+$/, "");

    return fraction ? `${whole}.${fraction}` : `${whole}`;
}

function parseEve(input) {
    const trimmed = input.trim();

    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
        throw new Error("Enter a positive EVE amount, e.g. 0.01");
    }

    const [whole, fraction = ""] = trimmed.split(".");

    if (fraction.length > EVE_DECIMALS) {
        throw new Error(
            `EVE supports at most ${EVE_DECIMALS} decimal places.`
        );
    }

    const paddedFraction = fraction.padEnd(EVE_DECIMALS, "0");

    const amount =
        BigInt(whole) * EVE_SCALE +
        BigInt(paddedFraction || "0");

    if (amount <= 0n) {
        throw new Error("Deposit amount must be greater than zero.");
    }

    return amount;
}

async function getAllEveCoins(owner) {
    const coins = [];
    let cursor = null;

    do {
        const page = await suiClient.getCoins({
            owner,
            coinType: EVE_TYPE,
            cursor,
            limit: 50,
        });

        coins.push(...page.data);

        cursor = page.hasNextPage
            ? page.nextCursor
            : null;
    } while (cursor);

    return coins;
}

async function getTreasuryBalance() {
    const object = await suiClient.getObject({
        id: TREASURY_ID,
        options: {
            showContent: true,
        },
    });

    const fields = object?.data?.content?.fields;

    if (!fields) {
        throw new Error("Could not read EveTreasury fields.");
    }

    const raw =
        typeof fields.balance === "string"
            ? fields.balance
            : fields.balance?.fields?.value ??
            fields.balance?.value ??
            fields.balance?.fields?.balance;

    if (raw === undefined || raw === null) {
        console.log("Treasury object fields:", fields);

        throw new Error(
            "Treasury found, but its EVE balance field had an unexpected RPC shape. See console."
        );
    }

    return BigInt(raw);
}

async function refreshBalances() {
    if (!account) return;

    const [coins, treasuryBalance] =
        await Promise.all([
            getAllEveCoins(account.address),
            getTreasuryBalance(),
        ]);

    const walletTotal = coins.reduce(
        (sum, coin) =>
            sum + BigInt(coin.balance),
        0n
    );

    $("wallet-balance").textContent =
        `${formatEve(walletTotal)} EVE`;

    $("treasury-balance").textContent =
        `${formatEve(treasuryBalance)} EVE`;

    return {
        coins,
        walletTotal,
        treasuryBalance,
    };
}

async function connect() {
    try {
        setStatus("Requesting Eve Vault connection…");

        ({
            wallet,
            suiAccount: account,
        } = await getWalletAndAccount());

        $("wallet-address").textContent =
            account.address;

        $("deposit-button").disabled = false;
        $("refresh-button").disabled = false;

        $("connect-button").textContent =
            "EVE VAULT CONNECTED";

        await refreshBalances();

        setStatus(
            "Connected. Ready to deposit testnet EVE.",
            "success"
        );
    } catch (error) {
        console.error(error);

        setStatus(
            error?.message ?? String(error),
            "error"
        );
    }
}

function selectCoinsForAmount(coins, amount) {
    const sorted = [...coins].sort(
        (a, b) =>
            BigInt(b.balance) > BigInt(a.balance)
                ? 1
                : BigInt(b.balance) < BigInt(a.balance)
                    ? -1
                    : 0
    );

    const selected = [];
    let total = 0n;

    for (const coin of sorted) {
        selected.push(coin);
        total += BigInt(coin.balance);

        if (total >= amount) {
            break;
        }
    }

    if (total < amount) {
        throw new Error(
            `Not enough EVE. Wallet has ${formatEve(total)} EVE, deposit requires ${formatEve(amount)} EVE.`
        );
    }

    return selected;
}

async function deposit() {
    if (!wallet || !account) {
        throw new Error(
            "Connect Eve Vault first."
        );
    }

    const amount =
        parseEve($("amount").value);

    const coins =
        await getAllEveCoins(account.address);

    const selected =
        selectCoinsForAmount(
            coins,
            amount
        );

    const tx = new Transaction();

    const primary =
        tx.object(
            selected[0].coinObjectId
        );

    if (selected.length > 1) {
        tx.mergeCoins(
            primary,
            selected
                .slice(1)
                .map((coin) =>
                    tx.object(
                        coin.coinObjectId
                    )
                )
        );
    }

    const [payment] =
        tx.splitCoins(
            primary,
            [
                tx.pure.u64(amount),
            ]
        );

    tx.moveCall({
        target:
            `${PACKAGE_ID}::vylent_free_stuff::deposit_eve`,

        arguments: [
            tx.object(TREASURY_ID),
            payment,
        ],
    });

    setStatus(
        `Submitting ${formatEve(amount)} EVE deposit.\nApprove the transaction in Eve Vault…`
    );

    $("deposit-button").disabled = true;

    try {
        const result =
            await signAndExecute(
                wallet,
                account,
                tx
            );

        console.log(
            "deposit_eve result:",
            result
        );

        const digest =
            result?.digest ??
            result?.effects?.transactionDigest ??
            "unknown";

        setStatus(
            `SUCCESS\nDeposited ${formatEve(amount)} EVE.\nTransaction: ${digest}`,
            "success"
        );

        await refreshBalances();
    } finally {
        $("deposit-button").disabled = false;
    }
}

$("connect-button")
    .addEventListener(
        "click",
        connect
    );

$("refresh-button")
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

$("deposit-button")
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

                $("deposit-button").disabled =
                    false;
            }
        }
    );