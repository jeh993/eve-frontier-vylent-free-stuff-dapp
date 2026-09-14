import { Transaction } from "@mysten/sui/transactions";

import {
    getCurrentAccount,
    signAndExecute,
} from "./wallet.js";

import {
    getCharacterIdForWallet,
    getPricesForStorageUnit,
    getCharacterOwnerCapRef,
    getStoreInventoryItems,
    getCharacterInventoryItems,
} from "./world.js";

import { suiClient } from "./sui-client.js";

import {
    VYLENT_PACKAGE_ID,
    VYLENT_EXCHANGE_ID,
    VYLENT_EVE_TREASURY_ID,
    EVE_TYPE,
} from "./config.js";


// =========================================================
// CONFIG
// =========================================================

const EVE_DECIMALS = 9;
const EVE_SCALE =
    10n ** BigInt(EVE_DECIMALS);

const params =
    new URLSearchParams(
        window.location.search
    );

const STORAGE_UNIT_ID =
    params.get("storage");

if (!STORAGE_UNIT_ID) {
    throw new Error(
        "No storage unit supplied in URL."
    );
}


// =========================================================
// DOM
// =========================================================

const output =
    document.getElementById(
        "trade-terminal-output"
    );

const market =
    document.getElementById(
        "market-output"
    );

const credits =
    document.getElementById(
        "credits"
    );


// =========================================================
// STATE
// =========================================================

let activeTab =
    "buy";

let typeIndexCache =
    null;


// =========================================================
// LOGGING
// =========================================================

console.log(
    "[VYLENT TRADE] Config:",
    {
        storageUnit:
            STORAGE_UNIT_ID,

        package:
            VYLENT_PACKAGE_ID,

        exchange:
            VYLENT_EXCHANGE_ID,

        treasury:
            VYLENT_EVE_TREASURY_ID,

        eveType:
            EVE_TYPE,
    }
);


// =========================================================
// EVE HELPERS
// =========================================================

function formatEve(value) {
    const amount =
        BigInt(value);

    const whole =
        amount / EVE_SCALE;

    const fraction =
        (
            amount %
            EVE_SCALE
        )
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


// =========================================================
// TERMINAL
// =========================================================

function terminal(message) {
    output.style.display =
        "block";

    output.innerHTML +=
        `${message}<br>`;
    }


    // =========================================================
    // EVE COINS / BALANCE
    // =========================================================

    async function getAllEveCoins(
    owner
    ) {
        const coins =
        [];

        let cursor =
        null;

        while (true) {
        const page =
        await suiClient.listCoins({
        owner,
        coinType:
        EVE_TYPE,
        cursor,
        limit: 50,
    });

        coins.push(
        ...page.objects
        );

        if (
        !page.hasNextPage
        ) {
        break;
    }

        cursor =
        page.cursor;
    }

        console.log(
        "[VYLENT TRADE] EVE coins:",
        coins
        );

        return coins;
    }


    function totalCoinBalance(
    coins
    ) {
        return coins.reduce(
        (
        total,
        coin
        ) =>
        total +
        BigInt(
        coin.balance
        ),
        0n
        );
    }


    function chooseCoins(
    coins,
    requiredAmount
    ) {
        const sorted =
        [...coins].sort(
        (a, b) => {
        const aBalance =
        BigInt(
        a.balance
        );

        const bBalance =
        BigInt(
        b.balance
        );

        if (
        bBalance >
        aBalance
        ) {
        return 1;
    }

        if (
        bBalance <
        aBalance
        ) {
        return -1;
    }

        return 0;
    }
        );

        const selected =
        [];

        let total =
        0n;

        for (
        const coin
        of sorted
        ) {
        selected.push(
        coin
        );

        total +=
        BigInt(
        coin.balance
        );

        if (
        total >=
        requiredAmount
        ) {
        break;
    }
    }

        if (
        total <
        requiredAmount
        ) {
        throw new Error(
        `Insufficient EVE. Wallet has ${formatEve(
        total
        )} EVE but purchase requires ${formatEve(
        requiredAmount
        )} EVE.`
        );
    }

        return selected;
    }


    // =========================================================
    // TREASURY
    // =========================================================

    async function getTreasuryBalance() {
        const { object } =
        await suiClient.getObject({
        objectId:
        VYLENT_EVE_TREASURY_ID,

        include: {
        json: true,
    },
    });

        if (!object) {
        throw new Error(
        "Vylent EVE treasury was not found."
        );
    }

        const balance =
        object.json?.balance;

        if (
        balance == null
        ) {
        throw new Error(
        "Could not read Vylent treasury balance."
        );
    }

        return BigInt(
        balance
        );
    }


    // =========================================================
    // WALLET BALANCE DISPLAY
    // =========================================================

    async function refreshEveBalance() {
        const {
        suiAccount
    } =
        await getCurrentAccount();

        const coins =
        await getAllEveCoins(
        suiAccount.address
        );

        const balance =
        totalCoinBalance(
        coins
        );

        credits.innerHTML =
        `EVE: ${formatEve(
        balance
        )}`;

        return balance;
    }


    // =========================================================
    // PRICES
    // =========================================================

    const prices =
    await getPricesForStorageUnit(
    STORAGE_UNIT_ID
    );


    const TYPE_INDEX_URL =
    `${import.meta.env.BASE_URL}types-index.json`;


    const ITEMS =
    await Promise.all(
    prices.map(
    async (row) => {

        const itemId =
        Number(
        row.fields.item_id
        );

        const buyPrice =
        BigInt(
        row.fields
        .buy_from_store
        );

        const sellPrice =
        BigInt(
        row.fields
        .sell_to_store
        );

        return {
        itemId,

        name:
        await getItemName(
        itemId
        ),

        buyPrice,

        sellPrice,
    };
    }
    )
    );


    console.log(
    "[VYLENT TRADE] Items:",
    ITEMS
    );


    // =========================================================
    // TABS
    // =========================================================

    document
    .getElementById(
    "buy-tab"
    )
    .addEventListener(
    "click",
    async () => {

        activeTab =
            "buy";

        const inventoryState =
        await getInventoryState();

        render(
        ITEMS,
        inventoryState
        );

        renderTabs();
    }
    );


    document
    .getElementById(
    "sell-tab"
    )
    .addEventListener(
    "click",
    async () => {

        activeTab =
            "sell";

        const inventoryState =
        await getInventoryState();

        render(
        ITEMS,
        inventoryState
        );

        renderTabs();
    }
    );


    // =========================================================
    // INITIAL PAGE
    // =========================================================

    renderTabs();


    credits.innerHTML =
    `EVE: <a href="#" id="connect-credits">[CONNECT WALLET]</a>`;


    const inventoryState =
    await getPublicInventoryState();


    render(
    ITEMS,
    inventoryState
    );


    document
    .getElementById(
    "connect-credits"
    )
    .addEventListener(
    "click",
    async (
    event
    ) => {

        event.preventDefault();

        try {
        terminal(
        "CONNECTING TO EVE VAULT..."
        );

        await refreshEveBalance();

        terminal(
        "EVE WALLET CONNECTED."
        );

        const state =
        await getInventoryState();

        render(
        ITEMS,
        state
        );

    } catch (
        error
        ) {
        console.error(
        error
        );

        terminal(
        "ERROR: WALLET CONNECTION FAILED."
        );

        terminal(
        error.message ||
        "UNKNOWN WALLET FAILURE."
        );
    }
    }
    );


    // =========================================================
    // RENDER MARKET
    // =========================================================

    function render(
    items,
    inventoryState
    ) {
        market.innerHTML = `
        <div class="market-header">
            <span>ITEM</span>
            <span>AVAILABLE</span>
            <span>PRICE</span>
            <span>QTY</span>
            <span>TOTAL</span>
            <span></span>
        </div>

        ${items.map(
            (item) => {

                const storeQty =
                    inventoryState
                        .storeByType
                        .get(
                            item.itemId
                        )
                        ?.quantity ||
                    0;

                const playerQty =
                    inventoryState
                        .characterByType
                        .get(
                            item.itemId
                        )
                        ?.quantity ||
                    0;

                const available =
                    activeTab ===
                    "buy"
                        ? storeQty
                        : playerQty;

                const price =
                    activeTab ===
                    "buy"
                        ? item.buyPrice
                        : item.sellPrice;

                const linkClass =
                    activeTab ===
                    "buy"
                        ? "buy-link"
                        : "sell-link";

                const linkText =
                    activeTab ===
                    "buy"
                        ? "[Buy]"
                        : "[Sell]";

                const priceText =
                    formatEve(
                        price
                    );

                return `
                    <div class="market-row">

                        <span>
                            ${item.name}
                        </span>

                        <span>
                            ${available.toLocaleString()}
                        </span>

                        <span>
                            ${priceText} EVE
                        </span>

                        <input
                            id="qty-${item.itemId}"
                            data-item="${item.itemId}"
                            data-price="${price.toString()}"
                            class="qty-input"
                            type="number"
                            min="1"
                            max="${available}"
                            value="1"
                        />

                        <span
                            id="total-${item.itemId}"
                        >
                            ${priceText} EVE
                        </span>

                        <a
                            href="#"
                            data-item="${item.itemId}"
                            class="${linkClass}"
                        >
                            ${linkText}
                        </a>

                    </div>
                `;
            }
        ).join("")}
    `;


        if (
        activeTab ===
        "buy"
        ) {
        document
        .querySelectorAll(
        ".buy-link"
        )
        .forEach(
        (link) =>
        link.addEventListener(
        "click",
        buyItem
        )
        );

    } else {
        document
        .querySelectorAll(
        ".sell-link"
        )
        .forEach(
        (link) =>
        link.addEventListener(
        "click",
        sellItem
        )
        );
    }


        document
        .querySelectorAll(
        ".qty-input"
        )
        .forEach(
        (input) => {

        input.addEventListener(
        "input",
        () => {

        const itemId =
        Number(
        input.dataset
        .item
        );

        const price =
        BigInt(
        input.dataset
        .price
        );

        const quantity =
        BigInt(
        input.value ||
        "0"
        );

        const total =
        price *
        quantity;

        document
        .getElementById(
        `total-${itemId}`
        )
        .textContent =
        `${formatEve(
        total
        )} EVE`;
    }
        );
    }
        );
    }


    // =========================================================
    // BUY WITH EVE
    // =========================================================

    async function buyItem(
    event
    ) {
        event.preventDefault();

        output.innerHTML =
        "";

        const itemId =
        Number(
        event.target
        .dataset.item
        );

        const quantity =
        Number(
        document
        .getElementById(
        `qty-${itemId}`
        )
        .value
        );


        try {
        if (
        !Number.isInteger(
        quantity
        ) ||
        quantity <= 0
        ) {
        throw new Error(
        "Quantity must be greater than zero."
        );
    }


        terminal(
        "CONNECTING TO EVE VAULT..."
        );


        const {
        wallet,
        suiAccount
    } =
        await getCurrentAccount();


        const address =
        suiAccount.address;


        const characterId =
        await getCharacterIdForWallet(
        address
        );


        const item =
        ITEMS.find(
        (candidate) =>
        candidate.itemId ===
        itemId
        );


        if (!item) {
        throw new Error(
        `Unknown item ${itemId}.`
        );
    }


        const total =
        item.buyPrice *
        BigInt(
        quantity
        );


        terminal(
        `DRIFTER IDENTIFIED: ${address.slice(
        0,
        8
        )}...`
        );


        terminal(
        `BUYING ${quantity}x ${item.name}`
        );


        terminal(
        `PRICE: ${formatEve(
        total
        )} EVE`
        );


        const allCoins =
        await getAllEveCoins(
        address
        );


        const selectedCoins =
        chooseCoins(
        allCoins,
        total
        );


        terminal(
        `USING ${selectedCoins.length} EVE COIN OBJECT(S)...`
        );


        const tx =
        new Transaction();


        tx.setSender(
        address
        );


        const paymentCoin =
        tx.object(
        selectedCoins[0]
        .objectId
        );


        if (
        selectedCoins.length >
        1
        ) {
        tx.mergeCoins(
        paymentCoin,

        selectedCoins
        .slice(1)
        .map(
        (
        coin
        ) =>
        tx.object(
        coin.objectId
        )
        )
        );
    }


        const [
        changeCoin
        ] =
        tx.moveCall({
        target:
        `${VYLENT_PACKAGE_ID}::vylent_free_stuff::buy_item_eve`,

        arguments: [
        tx.object(
        STORAGE_UNIT_ID
        ),

        tx.object(
        characterId
        ),

        tx.object(
        VYLENT_EXCHANGE_ID
        ),

        tx.object(
        VYLENT_EVE_TREASURY_ID
        ),

        paymentCoin,

        tx.pure.u64(
        itemId
        ),

        tx.pure.u32(
        quantity
        ),
        ],
    });


        // buy_item_eve returns any overpayment.
        // Send that Coin<EVE> back to the buyer.

        tx.transferObjects(
        [
        changeCoin
        ],

        tx.pure.address(
        address
        )
        );


        console.log(
        "[VYLENT TRADE] buy tx:",
        await tx.toJSON()
        );


        terminal(
        "SUBMITTING EVE PURCHASE..."
        );


        const result =
        await signAndExecute(
        wallet,
        suiAccount,
        tx
        );


        console.log(
        "[VYLENT TRADE] buy result:",
        result
        );


        terminal(
        "PURCHASE COMPLETE."
        );


        terminal(
        `TX: ${result.digest}`
        );


        await refreshEveBalance();


        const newInventoryState =
        await getInventoryState();


        render(
        ITEMS,
        newInventoryState
        );


    } catch (
        error
        ) {
        console.error(
        "[VYLENT TRADE] BUY ERROR:",
        error
        );


        terminal(
        "ERROR: PURCHASE FAILED."
        );


        terminal(
        error.message ||
        "UNKNOWN FRONTIER FAILURE."
        );
    }
    }


    // =========================================================
    // SELL FOR EVE
    // =========================================================

    async function sellItem(
    event
    ) {
        event.preventDefault();

        output.innerHTML =
        "";


        const itemId =
        Number(
        event.target
        .dataset.item
        );


        const quantity =
        Number(
        document
        .getElementById(
        `qty-${itemId}`
        )
        .value
        );


        try {
        if (
        !Number.isInteger(
        quantity
        ) ||
        quantity <= 0
        ) {
        throw new Error(
        "Quantity must be greater than zero."
        );
    }


        terminal(
        "CONNECTING TO EVE VAULT..."
        );


        const {
        wallet,
        suiAccount
    } =
        await getCurrentAccount();


        const address =
        suiAccount.address;


        const characterId =
        await getCharacterIdForWallet(
        address
        );


        const ownerCapRef =
        await getCharacterOwnerCapRef(
        characterId
        );


        const item =
        ITEMS.find(
        (candidate) =>
        candidate.itemId ===
        itemId
        );


        if (!item) {
        throw new Error(
        `Unknown item ${itemId}.`
        );
    }


        const total =
        item.sellPrice *
        BigInt(
        quantity
        );


        const treasuryBalance =
        await getTreasuryBalance();


        if (
        treasuryBalance <
        total
        ) {
        throw new Error(
        `Store only has ${formatEve(
        treasuryBalance
        )} EVE available. This sale requires ${formatEve(
        total
        )} EVE.`
        );
    }


        terminal(
        `SELLING ${quantity}x ${item.name}`
        );


        terminal(
        `PAYOUT: ${formatEve(
        total
        )} EVE`
        );


        terminal(
        `OWNER CAP: ${ownerCapRef.objectId.slice(
        0,
        10
        )}...`
        );


        const tx =
        new Transaction();


        tx.setSender(
        address
        );


        const [
        payoutCoin
        ] =
        tx.moveCall({
        target:
        `${VYLENT_PACKAGE_ID}::vylent_free_stuff::sell_item_eve`,

        arguments: [
        tx.object(
        STORAGE_UNIT_ID
        ),

        tx.object(
        characterId
        ),

        tx.receivingRef(
        ownerCapRef
        ),

        tx.object(
        VYLENT_EXCHANGE_ID
        ),

        tx.object(
        VYLENT_EVE_TREASURY_ID
        ),

        tx.pure.u64(
        itemId
        ),

        tx.pure.u32(
        quantity
        ),
        ],
    });


        // sell_item_eve returns the payout Coin<EVE>.
        // Send it directly to the seller.

        tx.transferObjects(
        [
        payoutCoin
        ],

        tx.pure.address(
        address
        )
        );


        console.log(
        "[VYLENT TRADE] sell tx:",
        await tx.toJSON()
        );


        terminal(
        "SUBMITTING SALE..."
        );


        const result =
        await signAndExecute(
        wallet,
        suiAccount,
        tx
        );


        console.log(
        "[VYLENT TRADE] sell result:",
        result
        );


        terminal(
        "SALE COMPLETE."
        );


        terminal(
        `TX: ${result.digest}`
        );


        await refreshEveBalance();


        const newInventoryState =
        await getInventoryState();


        render(
        ITEMS,
        newInventoryState
        );


    } catch (
        error
        ) {
        console.error(
        "[VYLENT TRADE] SELL ERROR:",
        error
        );


        terminal(
        "ERROR: SALE FAILED."
        );


        terminal(
        error.message ||
        "UNKNOWN FRONTIER FAILURE."
        );
    }
    }


    // =========================================================
    // INVENTORY
    // =========================================================

    async function getPublicInventoryState() {
        const storeInventory =
        await getStoreInventoryItems(
        STORAGE_UNIT_ID
        );

        return {
        storeByType:
        new Map(
        storeInventory.map(
        (item) => [
        item.typeId,
        item,
        ]
        )
        ),

        characterByType:
        new Map(),
    };
    }


    async function getInventoryState() {
        const {
        suiAccount
    } =
        await getCurrentAccount();


        const address =
        suiAccount.address;


        const characterId =
        await getCharacterIdForWallet(
        address
        );


        const storeInventory =
        await getStoreInventoryItems(
        STORAGE_UNIT_ID
        );


        const characterInventory =
        await getCharacterInventoryItems(
        STORAGE_UNIT_ID,
        characterId
        );


        return {
        storeByType:
        new Map(
        storeInventory.map(
        (item) => [
        item.typeId,
        item,
        ]
        )
        ),

        characterByType:
        new Map(
        characterInventory.map(
        (item) => [
        item.typeId,
        item,
        ]
        )
        ),
    };
    }


    // =========================================================
    // TYPE INDEX
    // =========================================================

    async function getItemName(
    typeId
    ) {
        const typeIndex =
        await getTypeIndex();

        const key =
        String(
        typeId
        );

        return (
        typeIndex[key]
        ?.name ||
        `ITEM ${typeId}`
        );
    }


    async function getTypeIndex() {
        if (
        typeIndexCache
        ) {
        return typeIndexCache;
    }


        const response =
        await fetch(
        TYPE_INDEX_URL
        );


        if (!response.ok) {
        throw new Error(
        `Type index fetch failed: ${response.status}`
        );
    }


        typeIndexCache =
        await response.json();


        return typeIndexCache;
    }


    // =========================================================
    // TAB DISPLAY
    // =========================================================

    function renderTabs() {
        document
            .getElementById(
                "buy-tab"
            )
            .innerHTML =
            activeTab ===
            "buy"
                ? "&gt;[Buy]&lt;"
                : "[Buy]";


        document
        .getElementById(
        "sell-tab"
        )
        .innerHTML =
        activeTab ===
        "sell"
        ? "&gt;[Sell]&lt;"
        : "[Sell]";
    }


    console.log(
    "[VYLENT TRADE] initialization complete"
    );
