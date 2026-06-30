import { Transaction } from "@mysten/sui/transactions";
import {getCurrentAccount, signAndExecute,} from "./wallet.js";
import {     getCharacterIdForWallet,
    getPricesForStorageUnit,
    getCharacterOwnerCapRef,
    getCreditBalanceForCharacter,
    getStoreInventoryItems,
    getCharacterInventoryItems, } from "./world.js";
import { VYLENT_PACKAGE_ID, VYLENT_EXCHANGE_ID } from "./config.js";

const params = new URLSearchParams(window.location.search);
const STORAGE_UNIT_ID = params.get("storage");

const output = document.getElementById("trade-terminal-output");
const market = document.getElementById("market-output");
const credits = document.getElementById("credits");

let activeTab = "buy";

document.getElementById("buy-tab").addEventListener("click", async () => {
    activeTab = "buy";
    const inventoryState = await getInventoryState();
    render(ITEMS, inventoryState);
    renderTabs();
});

document.getElementById("sell-tab").addEventListener("click", async () => {
    activeTab = "sell";
    const inventoryState = await getInventoryState();
    render(ITEMS, inventoryState);
    renderTabs();
});

const prices = await getPricesForStorageUnit(STORAGE_UNIT_ID);

const TYPE_INDEX_URL = `${import.meta.env.BASE_URL}types-index.json`;

let typeIndexCache = null;

const ITEMS = await Promise.all(prices.map(async row => {
    const itemId = Number(row.fields.item_id);

    console.log("ITEM ID", itemId, await getItemName(itemId));

    return {
        itemId,
        name: await getItemName(itemId),
        buyPrice: Number(row.fields.buy_from_store),
        sellPrice: Number(row.fields.sell_to_store),
    };
}));

refreshCredits();
renderTabs();
const inventoryState = await getInventoryState();
render(ITEMS, inventoryState);

function terminal(message) {
    output.style.display = "block";
    output.innerHTML += `${message}<br>`;
}

function render(items, inventoryState) {
    market.innerHTML = `
        <div class="market-header">
            <span>ITEM</span>
            <span>AVAILABLE</span>
            <span>PRICE</span>
            <span>QTY</span>
            <span>TOTAL</span>
            <span></span>
        </div>

        ${items.map(item => {
        const storeQty =
            inventoryState.storeByType.get(item.itemId)?.quantity || 0;

        const playerQty =
            inventoryState.characterByType.get(item.itemId)?.quantity || 0;

        const available =
            activeTab === "buy" ? storeQty : playerQty;

        const price =
            activeTab === "buy" ? item.buyPrice : item.sellPrice;

        const linkClass =
            activeTab === "buy" ? "buy-link" : "sell-link";

        const linkText =
            activeTab === "buy" ? "[Buy]" : "[Sell]";

        return `
                <div class="market-row">
                    <span>${item.name}</span>
                    <span>${available.toLocaleString()}</span>
                    <span>${price.toLocaleString()}</span>
                    
                    <input
                        id="qty-${item.itemId}"
                        data-item="${item.itemId}"
                        data-price="${price}"
                        class="qty-input"
                        type="number"
                        min="1"
                        max="${available}"
                        value="1"
                    />
                    
                    <span id="total-${item.itemId}">
                        ${price.toLocaleString()}
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
    }).join("")}
    `;

    if (activeTab === "buy") {
        document.querySelectorAll(".buy-link")
            .forEach(link =>
                link.addEventListener("click", buyItem));
    } else {
        document.querySelectorAll(".sell-link")
            .forEach(link =>
                link.addEventListener("click", sellItem));
    }

    document.querySelectorAll(".qty-input").forEach(input => {
        input.addEventListener("input", () => {
            const itemId = Number(input.dataset.item);
            const price = Number(input.dataset.price);
            const quantity = Number(input.value || 0);

            document.getElementById(`total-${itemId}`).textContent =
                (price * quantity).toLocaleString();
        });
    });
}

async function buyItem(event) {
    event.preventDefault();
    output.innerHTML = "";

    const itemId = Number(event.target.dataset.item);
    const quantity = Number(document.getElementById(`qty-${itemId}`).value);

    console.log(itemId, quantity);

    try {
        terminal("CONNECTING TO WALLET...");

        const { wallet, suiAccount } = await getCurrentAccount();
        const address = suiAccount.address;
        const characterId = await getCharacterIdForWallet(address);

        terminal(`DRIFTER IDENTIFIED: ${address.slice(0, 8)}...`);
        terminal(`BUYING ${quantity}x ITEM ${itemId}...`);

        const tx = new Transaction();

        tx.setSender(address);

        tx.moveCall({
            target: `${VYLENT_PACKAGE_ID}::vylent_free_stuff::buy_item`,
            arguments: [
                tx.object(STORAGE_UNIT_ID),
                tx.object(characterId),
                tx.object(VYLENT_EXCHANGE_ID),
                tx.pure.u64(itemId),
                tx.pure.u32(quantity),
            ],
        });

        console.log("buy tx json:", await tx.toJSON());

        terminal("SUBMITTING TRADE...");

        const result = await signAndExecute(wallet, suiAccount, tx);

        console.log("buy result:", result);

        terminal("TRADE COMPLETE.");
        terminal(`TX: ${result.digest}`);

        await refreshCredits();

        const inventoryState = await getInventoryState();
        render(ITEMS, inventoryState);
    } catch (error) {
        console.error(error);
        terminal("ERROR: PURCHASE FAILED.");
        terminal(error.message || "UNKNOWN FRONTIER FAILURE.");
    }
}

async function sellItem(event) {
    event.preventDefault();
    output.innerHTML = "";

    const itemId = Number(event.target.dataset.item);
    const quantity = Number(document.getElementById(`qty-${itemId}`).value);

    try {
        terminal("CONNECTING TO WALLET...");

        const { wallet, suiAccount } = await getCurrentAccount();
        const address = suiAccount.address;
        const characterId = await getCharacterIdForWallet(address);

        const ownerCapRef = await getCharacterOwnerCapRef(characterId);

        console.log("ownerCapRef:", ownerCapRef);
        terminal(`OWNER CAP: ${ownerCapRef.objectId.slice(0, 10)}...`);

        terminal(`SELLING ${quantity}x ITEM ${itemId}...`);

        const tx = new Transaction();
        tx.setSender(address);

        tx.moveCall({
            target: `${VYLENT_PACKAGE_ID}::vylent_free_stuff::sell_item`,
            arguments: [
                tx.object(STORAGE_UNIT_ID),
                tx.object(characterId),
                tx.receivingRef(ownerCapRef),
                tx.object(VYLENT_EXCHANGE_ID),
                tx.pure.u64(itemId),
                tx.pure.u32(quantity),
            ],
        });

        const result = await signAndExecute(wallet, suiAccount, tx);

        terminal("SALE COMPLETE.");
        terminal(`TX: ${result.digest}`);

        await refreshCredits();

        const inventoryState = await getInventoryState();
        render(ITEMS, inventoryState);
    } catch (error) {
        console.error(error);
        terminal("ERROR: SALE FAILED.");
        terminal(error.message || "UNKNOWN FRONTIER FAILURE.");
    }
}

async function refreshCredits() {
    const { wallet, suiAccount } = await getCurrentAccount();
    const address = suiAccount.address;
    const characterId = await getCharacterIdForWallet(address);

    const balance = await getCreditBalanceForCharacter(characterId);

    credits.innerHTML = `CREDITS: ${balance}`;
}

async function getInventoryState() {
    const { wallet, suiAccount } = await getCurrentAccount();
    const address = suiAccount.address;
    const characterId = await getCharacterIdForWallet(address);

    const storeInventory =
        await getStoreInventoryItems(STORAGE_UNIT_ID);

    const characterInventory =
        await getCharacterInventoryItems(
            STORAGE_UNIT_ID,
            characterId,
        );

    return {
        storeByType: new Map(
            storeInventory.map(i => [i.typeId, i])
        ),
        characterByType: new Map(
            characterInventory.map(i => [i.typeId, i])
        ),
    };
}

async function getItemName(typeId) {
    const typeIndex = await getTypeIndex();
    const key = String(typeId);

    console.log("TYPE INDEX LOADED?", !!typeIndex);
    console.log("LOOKUP KEY:", key);
    console.log("RAW ENTRY:", typeIndex[key]);
    console.dir(typeIndex[key], { depth: null });

    return typeIndex[key]?.name || `ITEM ${typeId}`;
}

async function getTypeIndex() {
    if (typeIndexCache) return typeIndexCache;

    const response = await fetch(TYPE_INDEX_URL);
    if (!response.ok) {
        throw new Error(`Type index fetch failed: ${response.status}`);
    }

    typeIndexCache = await response.json();

    return typeIndexCache;
}

function renderTabs() {
    document.getElementById("buy-tab").innerHTML =
        activeTab === "buy"
            ? "&gt;[Buy]&lt;"
            : "[Buy]";

    document.getElementById("sell-tab").innerHTML =
        activeTab === "sell"
            ? "&gt;[Sell]&lt;"
            : "[Sell]";
}

