import { Transaction } from "@mysten/sui/transactions";
import { getWallets } from "@mysten/wallet-standard";

import { suiClient } from "./sui-client.js";

import {
    TARGET_CHAIN,
    VYLENT_PACKAGE_ID,
    VYLENT_EXCHANGE_ID,
    VYLENT_EVE_TREASURY_ID,
} from "./config.js";

import {
    getPricesForStorageUnit,
} from "./world.js";


console.log("[VYLENT ADMIN] loaded");


// =========================================================
// CONFIG
// =========================================================

const PACKAGE_ID =
    VYLENT_PACKAGE_ID;

const EXCHANGE_ID =
    VYLENT_EXCHANGE_ID;

const TREASURY_ID =
    VYLENT_EVE_TREASURY_ID;

const ADMIN_CAP_TYPE =
    `${PACKAGE_ID}::vylent_free_stuff::AdminCap`;

const EVE_DECIMALS = 9;

const EVE_SCALE =
    10n ** BigInt(EVE_DECIMALS);


const params =
    new URLSearchParams(
        window.location.search
    );

const STORAGE_UNIT_ID =
    params.get("storage");


// =========================================================
// STATE
// =========================================================

let currentWallet = null;
let currentAccount = null;
let currentAdminCapId = null;


const el = (id) =>
    document.getElementById(id);


el("treasury-id").textContent =
    TREASURY_ID;

el("storage-id").textContent =
    STORAGE_UNIT_ID ??
    "NONE";


// =========================================================
// STATUS
// =========================================================

function setStatus(
    message,
    className = "muted"
) {
    console.log(
        "[VYLENT ADMIN]",
        message
    );

    el("status").className =
        className;

    el("status").textContent =
        message;
}


// =========================================================
// HELPERS
// =========================================================

function formatEve(value) {
    const amount =
        BigInt(value);

    const whole =
        amount / EVE_SCALE;

    const fraction =
        (amount % EVE_SCALE)
            .toString()
            .padStart(
                EVE_DECIMALS,
                "0"
            )
            .replace(
                /0+$/,
                ""
            );

    return fraction
        ? `${whole}.${fraction}`
        : `${whole}`;
}


function parseEve(value) {
    const text =
        value.trim();

    if (
        !/^\d+(\.\d+)?$/.test(text)
    ) {
        throw new Error(
            "Invalid EVE amount."
        );
    }

    const [
        whole,
        fraction = ""
    ] =
        text.split(".");

    if (
        fraction.length >
        EVE_DECIMALS
    ) {
        throw new Error(
            "Too many decimal places."
        );
    }

    const padded =
        fraction.padEnd(
            EVE_DECIMALS,
            "0"
        );

    return (
        BigInt(whole) *
        EVE_SCALE
    ) + BigInt(
        padded || "0"
    );
}


function parseU64(
    value,
    label
) {
    const text =
        value.trim();

    if (
        !/^\d+$/.test(text)
    ) {
        throw new Error(
            `${label} must be a positive integer.`
        );
    }

    return BigInt(text);
}


function requireStorage() {
    if (!STORAGE_UNIT_ID) {
        throw new Error(
            "No storage unit selected. Open this page with ?storage=0x..."
        );
    }
}


// =========================================================
// CONNECT SLUSH
// =========================================================

async function connectSlush() {
    const wallets =
        getWallets().get();

    console.table(
        wallets.map(
            (wallet) => ({
                name:
                    wallet.name,

                chains:
                    wallet.chains
                        ?.join(", "),

                features:
                    Object.keys(
                        wallet.features
                    ).join(", "),
            })
        )
    );

    const wallet =
        wallets.find(
            (candidate) =>
                candidate.name
                    ?.toLowerCase()
                    .includes("slush") &&

                candidate.chains
                    ?.includes(
                        TARGET_CHAIN
                    )
        );

    if (!wallet) {
        throw new Error(
            "Slush wallet not detected."
        );
    }

    const result =
        await wallet.features[
            "standard:connect"
        ].connect();

    const account =
        result.accounts?.find(
            (candidate) =>
                candidate.chains
                    ?.includes(
                        TARGET_CHAIN
                    )
        ) ??
        result.accounts?.[0];

    if (!account) {
        throw new Error(
            "Slush returned no Sui account."
        );
    }

    currentWallet =
        wallet;

    currentAccount =
        account;

    return {
        wallet,
        account,
    };
}


// =========================================================
// SIGN / EXECUTE
// =========================================================

async function signAndExecute(
    tx
) {
    const feature =
        currentWallet.features[
            "sui:signAndExecuteTransaction"
        ];

    if (!feature) {
        throw new Error(
            "Slush does not support transaction execution."
        );
    }

    return await feature
        .signAndExecuteTransaction({
            transaction:
                tx,

            account:
                currentAccount,

            chain:
                TARGET_CHAIN,

            options: {
                showEffects:
                    true,

                showObjectChanges:
                    true,

                showBalanceChanges:
                    true,

                showEvents:
                    true,
            },
        });
}


// =========================================================
// ADMIN CAP
// =========================================================

async function findAdminCap() {
    const page =
        await suiClient.listOwnedObjects({
            owner:
                currentAccount.address,

            type:
                ADMIN_CAP_TYPE,

            limit:
                10,
        });

    if (
        page.objects.length === 0
    ) {
        currentAdminCapId =
            null;

        return null;
    }

    currentAdminCapId =
        page.objects[0]
            .objectId;

    return currentAdminCapId;
}


// =========================================================
// TREASURY
// =========================================================

async function getTreasuryBalance() {
    const {
        object
    } =
        await suiClient.getObject({
            objectId:
                TREASURY_ID,

            include: {
                json:
                    true,
            },
        });

    if (!object) {
        throw new Error(
            "Treasury not found."
        );
    }

    return BigInt(
        object.json.balance
    );
}


// =========================================================
// PRICES
// =========================================================

async function refreshPrices() {
    if (!STORAGE_UNIT_ID) {
        el("prices-output")
            .textContent =
            "No SSU selected.";

        return;
    }

    try {
        const prices =
            await getPricesForStorageUnit(
                STORAGE_UNIT_ID
            );

        if (
            prices.length === 0
        ) {
            el("prices-output")
                .textContent =
                "No prices configured.";

            return;
        }

        el("prices-output")
            .innerHTML = `
<table>
<thead>
<tr>
<th>Item</th>
<th>Store Pays</th>
<th>Player Pays</th>
</tr>
</thead>

<tbody>
${prices.map(
    (row) => `
                                <tr>
                                    <td>
                                        ${row.fields.item_id}
                                    </td>

                                    <td>
                                        ${formatEve(
        row.fields.sell_to_store
    )} EVE
                                    </td>

                                    <td>
                                        ${formatEve(
        row.fields.buy_from_store
    )} EVE
                                    </td>
                                </tr>
                            `
).join("")}
</tbody>
</table>
`;

    } catch (error) {
        el("prices-output")
            .textContent =
            "No prices configured.";
    }
}


// =========================================================
// REFRESH
// =========================================================

async function refresh() {
    if (!currentAccount) {
        return;
    }

    const [
        adminCap,
        treasury
    ] =
        await Promise.all([
            findAdminCap(),
            getTreasuryBalance(),
        ]);

    el("wallet-address")
        .textContent =
        currentAccount.address;

    el("treasury-balance")
        .textContent =
        `${formatEve(
    treasury
)} EVE`;

    if (adminCap) {
        el("admin-cap")
            .textContent =
            adminCap;

        enableAdminControls();

        setStatus(
            "AdminCap verified.",
            "success"
        );

    } else {
        el("admin-cap")
            .textContent =
            "NOT FOUND";

        disableAdminControls();

        setStatus(
            "Connected wallet does not own the Vylent AdminCap.",
            "error"
        );
    }

    await refreshPrices();
}


// =========================================================
// ENABLE / DISABLE
// =========================================================

function enableAdminControls() {
    el("withdraw-button")
        .disabled =
        false;

    const storageControls = [
        "set-price-button",
        "remove-price-button",
        "set-freebie-button",
        "remove-freebie-button",
    ];

    for (
        const id
        of storageControls
    ) {
        el(id).disabled =
            !STORAGE_UNIT_ID;
    }
}


function disableAdminControls() {
    [
        "withdraw-button",
        "set-price-button",
        "remove-price-button",
        "set-freebie-button",
        "remove-freebie-button",
    ].forEach(
        (id) => {
            el(id).disabled =
                true;
        }
    );
}


// =========================================================
// SET ITEM PRICE
// =========================================================

async function setItemPrice() {
    requireStorage();

    const itemId =
        parseU64(
            el("price-item-id")
                .value,
            "Item ID"
        );

    const sellPrice =
        parseEve(
            el("sell-price")
                .value
        );

    const buyPrice =
        parseEve(
            el("buy-price")
                .value
        );

    const tx =
        new Transaction();

    tx.moveCall({
        target:
            `${PACKAGE_ID}::vylent_free_stuff::set_item_price`,

        arguments: [
            tx.object(
                currentAdminCapId
            ),

            tx.object(
                EXCHANGE_ID
            ),

            tx.pure.address(
                STORAGE_UNIT_ID
            ),

            tx.pure.u64(
                itemId
            ),

            tx.pure.u64(
                sellPrice
            ),

            tx.pure.u64(
                buyPrice
            ),
        ],
    });

    setStatus(
        "Setting item price. Approve in Slush..."
    );

    const result =
        await signAndExecute(
            tx
        );

    console.log(
        "[VYLENT ADMIN] set_item_price:",
        result
    );

    setStatus(
        `Price updated.\nTX: ${result.digest}`,
        "success"
    );

    await refreshPrices();
}


// =========================================================
// REMOVE ITEM PRICE
// =========================================================

async function removeItemPrice() {
    requireStorage();

    const itemId =
        parseU64(
            el("price-item-id")
                .value,
            "Item ID"
        );

    const tx =
        new Transaction();

    tx.moveCall({
        target:
            `${PACKAGE_ID}::vylent_free_stuff::remove_item_price`,

        arguments: [
            tx.object(
                currentAdminCapId
            ),

            tx.object(
                EXCHANGE_ID
            ),

            tx.pure.address(
                STORAGE_UNIT_ID
            ),

            tx.pure.u64(
                itemId
            ),
        ],
    });

    setStatus(
        "Removing price. Approve in Slush..."
    );

    const result =
        await signAndExecute(
            tx
        );

    setStatus(
        `Price removed.\nTX: ${result.digest}`,
        "success"
    );

    await refreshPrices();
}


// =========================================================
// SET FREEBIE
// =========================================================

async function setFreebie() {
    requireStorage();

    const typeId =
        parseU64(
            el("freebie-type-id")
                .value,
            "Type ID"
        );

    const quantity =
        Number(
            el("freebie-quantity")
                .value
        );

    if (
        !Number.isInteger(
            quantity
        ) ||
        quantity <= 0
    ) {
        throw new Error(
            "Freebie quantity must be greater than zero."
        );
    }

    const tx =
        new Transaction();

    tx.moveCall({
        target:
            `${PACKAGE_ID}::vylent_free_stuff::set_single_freebie`,

        arguments: [
            tx.object(
                currentAdminCapId
            ),

            tx.object(
                EXCHANGE_ID
            ),

            tx.pure.address(
                STORAGE_UNIT_ID
            ),

            tx.pure.u64(
                typeId
            ),

            tx.pure.u32(
                quantity
            ),
        ],
    });

    setStatus(
        "Setting freebie. Approve in Slush..."
    );

    const result =
        await signAndExecute(
            tx
        );

    setStatus(
        `Freebie configured.\nTX: ${result.digest}`,
        "success"
    );
}


// =========================================================
// REMOVE FREEBIE
// =========================================================

async function removeFreebie() {
    requireStorage();

    const typeId =
        parseU64(
            el("freebie-type-id")
                .value,
            "Type ID"
        );

    const tx =
        new Transaction();

    tx.moveCall({
        target:
            `${PACKAGE_ID}::vylent_free_stuff::remove_freebie`,

        arguments: [
            tx.object(
                currentAdminCapId
            ),

            tx.object(
                EXCHANGE_ID
            ),

            tx.pure.address(
                STORAGE_UNIT_ID
            ),

            tx.pure.u64(
                typeId
            ),
        ],
    });

    setStatus(
        "Removing freebie. Approve in Slush..."
    );

    const result =
        await signAndExecute(
            tx
        );

    setStatus(
        `Freebie removed.\nTX: ${result.digest}`,
        "success"
    );
}


// =========================================================
// WITHDRAW TREASURY
// =========================================================

async function withdraw() {
    const amount =
        parseEve(
            el("withdraw-amount")
                .value
        );

    const tx =
        new Transaction();

    const [
        withdrawalCoin
    ] =
        tx.moveCall({
            target:
                `${PACKAGE_ID}::vylent_free_stuff::withdraw_eve`,

            arguments: [
                tx.object(
                    currentAdminCapId
                ),

                tx.object(
                    TREASURY_ID
                ),

                tx.pure.u64(
                    amount
                ),
            ],
        });

    tx.transferObjects(
        [
            withdrawalCoin
        ],

        tx.pure.address(
            currentAccount.address
        )
    );

    setStatus(
        "Withdrawing EVE. Approve in Slush..."
    );

    const result =
        await signAndExecute(
            tx
        );

    setStatus(
        `Withdrawal complete.\nTX: ${result.digest}`,
        "success"
    );

    await refresh();
}


// =========================================================
// BUTTON WRAPPER
// =========================================================

function onClick(
    id,
    handler
) {
    el(id)
        ?.addEventListener(
            "click",
            async () => {
                try {
                    await handler();
                } catch (error) {
                    console.error(
                        `[VYLENT ADMIN] ${id}:`,
                        error
                    );

                    setStatus(
                        error.message ??
                        String(error),
                        "error"
                    );
                }
            }
        );
}


// =========================================================
// BUTTONS
// =========================================================

onClick(
    "connect-button",
    async () => {
        setStatus(
            "Connecting Slush..."
        );

        await connectSlush();

        el("connect-button")
            .textContent =
            "SLUSH CONNECTED";

        el("refresh-button")
            .disabled =
            false;

        await refresh();
    }
);


onClick(
    "refresh-button",
    refresh
);


onClick(
    "set-price-button",
    setItemPrice
);


onClick(
    "remove-price-button",
    removeItemPrice
);


onClick(
    "set-freebie-button",
    setFreebie
);


onClick(
    "remove-freebie-button",
    removeFreebie
);


onClick(
    "withdraw-button",
    withdraw
);


console.log(
    "[VYLENT ADMIN] initialization complete",
    {
        storage:
            STORAGE_UNIT_ID,

        package:
            PACKAGE_ID,

        exchange:
            EXCHANGE_ID,

        treasury:
            TREASURY_ID,
    }
);