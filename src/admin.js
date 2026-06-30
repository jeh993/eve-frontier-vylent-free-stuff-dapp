import {suiClient} from "./sui-client";
import {Transaction} from "@mysten/sui/transactions";
import { clearTerminal, terminal } from "./terminal.js";
import {
    WORLD_PACKAGE_ID,
    VYLENT_AUTH_TYPE, VYLENT_PACKAGE_ID, VYLENT_EXCHANGE_ID,
} from "./config.js";
import {
    getWalletAndAccount,
    signAndExecute,
} from "./wallet.js";
import {
    getCharacterIdForWallet,
    getStorageUnitOwnerCapId,
} from "./world.js";
import {buildAuthorizeStorageUnitTx, buildExchangeEntryTx} from "./transaction.js";

const params = new URLSearchParams(window.location.search);
const storageUnitId = params.get("storage");
const adminState = {
    storageUnitId,
    isAuthorized: false,
    storageUnit: null,
    exchange: null,
};

refreshAdminState();

async function refreshAdminState() {
    const storageUnit = await getStorageUnit(storageUnitId);

    adminState.storageUnit = storageUnit;
    adminState.isAuthorized = storageUnitHasVylentAuth(storageUnit);

    renderAdminControls();
}

const authorizeButton = document.getElementById("authorize-button");
const exchangeButton = document.getElementById("exchange-button");
const sellTestButton = document.getElementById("sell-test-button");
const buyTestButton = document.getElementById("buy-test-button");

authorizeButton.addEventListener("click", async (event) => {
    event.preventDefault();
    clearTerminal();

    try{
        if (!storageUnitId){
            throw new Error("No storage unit specified. Use ?storage=0x...");
        }

        terminal("CONNECTING TO WALLET...");
        terminal("VERIFYING STORAGE UNIT AUTHORITY...");

        const { wallet, suiAccount } = await getWalletAndAccount();

        const characterId = await getCharacterIdForWallet(suiAccount.address);
        console.log("CHARACTER ID", characterId);
        const storageUnitOwnerCapId = await getStorageUnitOwnerCapId(storageUnitId);

        const tx = buildAuthorizeStorageUnitTx({
                worldPackageId: WORLD_PACKAGE_ID,
                storageUnitId,
                characterId,
                storageUnitOwnerCapId,
                vylentAuthType: VYLENT_AUTH_TYPE,
        });

        terminal("REQUESTING SIGNATURE...");

        const result = await signAndExecute(wallet, suiAccount, tx);

        terminal("VYLENT AUTHORIZED");
        terminal(`TX ${result.digest}`);

        try {
            await refreshAdminState();
        } catch (refreshError) {
            console.error("Refresh failed after successful auth:", refreshError);
            terminal("WARNING: AUTHORIZED, BUT REFRESH FAILED.");
            terminal(refreshError.message || "Unknown refresh error.");
        }

    }catch(error){
        console.error(error);
        terminal("ERROR: AUTHORIZATION FAILED.");
        terminal(error.message || "UNKNOWN FRONTIER FAILURE.");
    }
});

sellTestButton.addEventListener("click", async (event) => {
    event.preventDefault();
    clearTerminal();

    try{
        if (!storageUnitId){
            throw new Error("No storage unit specified. Use ?storage=0x...");
        }

        terminal("CONNECTING TO WALLET...");
        terminal("VERIFYING STORAGE UNIT AUTHORITY...");

        const { wallet, suiAccount } = await getWalletAndAccount();


        const characterId = await getCharacterIdForWallet(suiAccount.address);
        const character = await suiClient.getObject({
            id: characterId,
            options: { showContent: true },
        });

        const ownerCapId = character.data.content.fields.owner_cap_id;

        if (!ownerCapId) {
            throw new Error("Character owner_cap_id not found.");
        }

        const ownerCap = await suiClient.getObject({
            id: ownerCapId,
            options: { showOwner: true },
        });

        const ownerCapRef = {
            objectId: ownerCap.data.objectId,
            version: ownerCap.data.version,
            digest: ownerCap.data.digest,
        };

        const tx = new Transaction();

        tx.moveCall({
            target: `${VYLENT_PACKAGE_ID}::vylent_free_stuff::sell_item`,
            arguments: [
                tx.object(storageUnitId),
                tx.object(characterId),
                tx.receivingRef(ownerCapRef),
                tx.object(VYLENT_EXCHANGE_ID),
                tx.pure.u64(88335),
                tx.pure.u32(4),
            ],
        });

        terminal("ATTEMPTING SALE...");

        const result = await signAndExecute(wallet, suiAccount, tx);

        terminal("SALE SUCCESS!");
        terminal(`TXL ${result.digest}`);
    }catch(error){
        console.error(error);
        terminal("ERROR: SALE FAILED.");
        terminal(error.message || "UNKNOWN FRONTIER FAILURE.");
    }

})

buyTestButton.addEventListener("click", async (event) => {
    event.preventDefault();
    clearTerminal();

    try{
        if (!storageUnitId){
            throw new Error("No storage unit specified. Use ?storage=0x...");
        }

        terminal("CONNECTING TO WALLET...");
        terminal("VERIFYING STORAGE UNIT AUTHORITY...");

        const { wallet, suiAccount } = await getWalletAndAccount();


        const characterId = await getCharacterIdForWallet(suiAccount.address);
        const character = await suiClient.getObject({
            id: characterId,
            options: { showContent: true },
        });

        const tx = new Transaction();

        tx.moveCall({
            target: `${VYLENT_PACKAGE_ID}::vylent_free_stuff::buy_item`,
            arguments: [
                tx.object(storageUnitId),
                tx.object(characterId),
                tx.object(VYLENT_EXCHANGE_ID),
                tx.pure.u64(88335),
                tx.pure.u32(1),
            ],
        });

        terminal("ATTEMPTING PURCHASE...");

        const result = await signAndExecute(wallet, suiAccount, tx);

        terminal("PURCHASE SUCCESS!");
        terminal(`TXL ${result.digest}`);
    }catch(error){
        console.error(error);
        terminal("ERROR: SALE FAILED.");
        terminal(error.message || "UNKNOWN FRONTIER FAILURE.");
    }

})

exchangeButton.addEventListener("click", async (event) => {
    event.preventDefault();
    clearTerminal();

    if (!adminState.isAuthorized) {
        terminal("AUTHORIZE THIS STORAGE UNIT BEFORE EDITING THE EXCHANGE.");
        return;
    }

    const exchange = await suiClient.getObject({
        id: VYLENT_EXCHANGE_ID,
        options: {
            showContent: true,
            showType: true,
        },
    });

    const freebies = await getFreebiesForStorageUnit(exchange, storageUnitId);

    if (!freebies) {
        terminal("NO FREEBIES CONFIGURED FOR THIS STORAGE UNIT.");
    } else {
        console.log("freebies:", freebies);
    }

    const { wallet, suiAccount } = await getWalletAndAccount();

    const characterId = await getCharacterIdForWallet(suiAccount.address);
    console.log("CHARACTER ID", characterId);

    terminal("READY TO SET UP / EDIT EXCHANGE.");

    //const tx = buildExchangeEntryTx(adminCapId, storageUnitId, typeId, quantity);
});

async function getStorageUnit(storageUnitId) {
    const storageUnit = await suiClient.getObject({
        id: storageUnitId,
        options: {
            showContent: true,
            showType: true,
        },
    });

    console.log("storage unit object:", storageUnit);
    console.log("storage unit fields:", storageUnit.data?.content?.fields);
    return storageUnit;
}

async function getFreebiesForStorageUnit(exchange, storageUnitId) {
    const freebieTableId =
        exchange.data?.content?.fields?.freebies_by_storage_unit?.fields?.id?.id;
    console.log("freebieTable:", freebieTableId);

    try {
        const result = await suiClient.getDynamicFieldObject({
            parentId: freebieTableId,
            name: {
                type: "0x2::object::ID",
                value: storageUnitId,
            },
        });

        return result.data?.content?.fields?.value;
    } catch (error) {
        if (error?.code === "dynamicFieldNotFound") {
            return null;
        }

        throw error;
    }


}

function storageUnitHasVylentAuth(storageUnit) {
    let authType = storageUnit.data?.content?.fields?.extension?.fields?.name;
    if (authType.indexOf("0x") !== 0) { authType = "0x" + authType; }
    return authType === VYLENT_AUTH_TYPE
}

function renderAdminControls() {
    if (adminState.isAuthorized) {
        authorizeButton.disabled = true;
        authorizeButton.textContent = "Already Authorized";

        exchangeButton.disabled = false;
        exchangeButton.textContent = "Setup / Edit Exchange";

        terminal("STORAGE UNIT AUTHORIZED. EXCHANGE CONTROLS ENABLED.");
    } else {
        authorizeButton.disabled = false;
        authorizeButton.textContent = "Authorize Vylent";

        exchangeButton.disabled = true;
        exchangeButton.textContent = "Authorize Vylent First";

        terminal("STORAGE UNIT NEEDS VYLENT AUTHORIZATION.");
    }
}