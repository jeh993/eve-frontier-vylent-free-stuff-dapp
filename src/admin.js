import {
    WORLD_PACKAGE_ID,
    VYLENT_AUTH_TYPE,
    VYLENT_EXCHANGE_ID,
} from "./config.js";

import {
    getWalletAndAccount,
    signAndExecute,
} from "./wallet.js";

import {
    getCharacterIdForWallet,
    getStorageUnitOwnerCapId,
    getPricesForStorageUnit,
} from "./world.js";

import {
    buildAuthorizeStorageUnitTx,
} from "./transaction.js";

import { suiClient } from "./sui-client.js";


// =========================================================
// PAGE / STATE
// =========================================================

console.log("[VYLENT SSU ADMIN] admin.js loaded");

const params =
    new URLSearchParams(
        window.location.search
    );

const storageUnitId =
    params.get("storage");


const adminState = {
    storageUnitId,
    storageUnit: null,
    isAuthorized: false,
    prices: [],
};


const el = (id) =>
    document.getElementById(id);


const authorizeButton =
    el("authorize-button");

const exchangeButton =
    el("exchange-button");

const sellTestButton =
    el("sell-test-button");

const buyTestButton =
    el("buy-test-button");

const openStoreButton =
    el("open-store-button");

const terminalOutput =
    el("terminal-output");


// =========================================================
// TERMINAL
// =========================================================

function clearTerminal() {
    if (!terminalOutput) {
        return;
    }

    terminalOutput.textContent = "";
}


function terminal(message) {
    console.log(
        "[VYLENT SSU ADMIN]",
        message
    );

    if (!terminalOutput) {
        return;
    }

    if (
        terminalOutput.textContent &&
        !terminalOutput.textContent.endsWith("\n")
    ) {
        terminalOutput.textContent += "\n";
    }

    terminalOutput.textContent +=
        `${message}\n`;
}


// =========================================================
// NORMALIZATION HELPERS
// =========================================================

function normalizeType(value) {
    if (
        typeof value !== "string"
    ) {
        return null;
    }

    let normalized =
        value.trim();

    if (
        normalized &&
        !normalized.startsWith("0x") &&
        normalized.includes("::")
    ) {
        normalized =
            `0x${normalized}`;
    }

    return normalized.toLowerCase();
}


function objectContainsType(
    value,
    targetType
) {
    const normalizedTarget =
        normalizeType(
            targetType
        );

    if (!normalizedTarget) {
        return false;
    }

    if (
        typeof value === "string"
    ) {
        return (
            normalizeType(value) ===
            normalizedTarget
        );
    }

    if (
        Array.isArray(value)
    ) {
        return value.some(
            (entry) =>
                objectContainsType(
                    entry,
                    targetType
                )
        );
    }

    if (
        value &&
        typeof value === "object"
    ) {
        return Object.values(
            value
        ).some(
            (entry) =>
                objectContainsType(
                    entry,
                    targetType
                )
        );
    }

    return false;
}


// =========================================================
// STORAGE UNIT
// =========================================================

async function getStorageUnit(
    objectId
) {
    if (!objectId) {
        throw new Error(
            "No storage unit selected."
        );
    }

    console.log(
        "[VYLENT SSU ADMIN] Reading SSU:",
        objectId
    );

    const { object } =
        await suiClient.getObject({
            objectId,

            include: {
                json: true,
            },
        });

    if (!object) {
        throw new Error(
            `Storage Unit not found: ${objectId}`
        );
    }

    console.log(
        "[VYLENT SSU ADMIN] SSU object:",
        object
    );

    console.log(
        "[VYLENT SSU ADMIN] SSU JSON:",
        object.json
    );

    return object;
}


// =========================================================
// VYLENT AUTH CHECK
// =========================================================

function storageUnitHasVylentAuth(storageUnit) {
    const extension =
        storageUnit?.json?.extension;

    console.log(
        "[VYLENT SSU ADMIN] Extension on chain:",
        extension
    );

    console.log(
        "[VYLENT SSU ADMIN] Expected Vylent extension:",
        VYLENT_AUTH_TYPE
    );

    if (
        typeof extension !== "string"
    ) {
        return false;
    }

    const actual =
        extension
            .toLowerCase()
            .replace(/^0x/, "");

    const expected =
        VYLENT_AUTH_TYPE
            .toLowerCase()
            .replace(/^0x/, "");

    const matches =
        actual === expected;

    console.log(
        "[VYLENT SSU ADMIN] Vylent authorized:",
        matches
    );

    return matches;
}


// =========================================================
// PRICE STATE
// =========================================================

async function loadPrices() {
    if (!storageUnitId) {
        return [];
    }

    try {
        const prices =
            await getPricesForStorageUnit(
                storageUnitId
            );

        console.log(
            "[VYLENT SSU ADMIN] Prices:",
            prices
        );

        return prices;

    } catch (error) {
        /*
         * An SSU with no configured prices is not a
         * fatal admin-page error.
         */

        console.log(
            "[VYLENT SSU ADMIN] No price configuration:",
            error
        );

        return [];
    }
}


// =========================================================
// REFRESH STATE
// =========================================================

async function refreshAdminState() {
    console.log(
        "[VYLENT SSU ADMIN] refreshAdminState()"
    );

    if (!storageUnitId) {
        adminState.storageUnit =
            null;

        adminState.isAuthorized =
            false;

        adminState.prices =
            [];

        renderAdminControls();

        terminal(
            "SELECT A STORAGE UNIT."
        );

        return;
    }

    try {
        const [
            storageUnit,
            prices,
        ] =
            await Promise.all([
                getStorageUnit(
                    storageUnitId
                ),

                loadPrices(),
            ]);

        adminState.storageUnit =
            storageUnit;

        adminState.prices =
            prices;

        adminState.isAuthorized =
            storageUnitHasVylentAuth(
                storageUnit
            );

        console.log(
            "[VYLENT SSU ADMIN] State:",
            adminState
        );

        renderAdminControls();

    } catch (error) {
        console.error(
            "[VYLENT SSU ADMIN] Refresh failed:",
            error
        );

        terminal(
            "ERROR READING STORAGE UNIT."
        );

        terminal(
            error.message ??
            String(error)
        );

        renderAdminControls();
    }
}


// =========================================================
// RENDER CONTROLS
// =========================================================

function renderAdminControls() {
    console.log(
        "[VYLENT SSU ADMIN] Rendering controls:",
        {
            storageUnitId,
            authorized:
                adminState.isAuthorized,

            prices:
                adminState.prices.length,
        }
    );

    if (!storageUnitId) {
        if (authorizeButton) {
            authorizeButton.disabled =
                true;

            authorizeButton.textContent =
                "Select an SSU First";
        }

        if (exchangeButton) {
            exchangeButton.disabled =
                true;

            exchangeButton.textContent =
                "Select an SSU First";
        }

        if (buyTestButton) {
            buyTestButton.disabled =
                true;
        }

        if (sellTestButton) {
            sellTestButton.disabled =
                true;
        }

        if (openStoreButton) {
            openStoreButton.disabled =
                true;
        }

        return;
    }


    if (openStoreButton) {
        openStoreButton.disabled =
            false;
    }


    if (
        adminState.isAuthorized
    ) {
        if (authorizeButton) {
            authorizeButton.disabled =
                true;

            authorizeButton.textContent =
                "Already Authorized";
        }

        if (exchangeButton) {
            exchangeButton.disabled =
                false;

            exchangeButton.textContent =
                "Inspect Exchange";
        }

        if (buyTestButton) {
            buyTestButton.disabled =
                false;
        }

        if (sellTestButton) {
            sellTestButton.disabled =
                false;
        }

        terminal(
            "STORAGE UNIT AUTHORIZED FOR VYLENT."
        );

        if (
            adminState.prices.length >
            0
        ) {
            terminal(
                `${adminState.prices.length} PRICE ENTRIES CONFIGURED.`
            );
        } else {
            terminal(
                "NO PRICE ENTRIES CONFIGURED."
            );
        }

    } else {
        if (authorizeButton) {
            authorizeButton.disabled =
                false;

            authorizeButton.textContent =
                "Authorize Vylent";
        }

        if (exchangeButton) {
            exchangeButton.disabled =
                true;

            exchangeButton.textContent =
                "Authorize Vylent First";
        }

        if (buyTestButton) {
            buyTestButton.disabled =
                true;
        }

        if (sellTestButton) {
            sellTestButton.disabled =
                true;
        }

        terminal(
            "STORAGE UNIT NEEDS VYLENT AUTHORIZATION."
        );
    }
}


// =========================================================
// AUTHORIZE VYLENT ON SSU
// =========================================================

authorizeButton
    ?.addEventListener(
        "click",
        async (event) => {
            event.preventDefault();

            clearTerminal();

            try {
                if (!storageUnitId) {
                    throw new Error(
                        "No storage unit specified."
                    );
                }

                terminal(
                    "CONNECTING TO EVE VAULT..."
                );

                const {
                    wallet,
                    suiAccount,
                } =
                    await getWalletAndAccount();


                terminal(
                    "LOOKING UP CHARACTER..."
                );

                const characterId =
                    await getCharacterIdForWallet(
                        suiAccount.address
                    );


                terminal(
                    `CHARACTER: ${characterId}`
                );


                terminal(
                    "LOOKING UP STORAGE UNIT OWNER CAP..."
                );

                const storageUnitOwnerCapId =
                    await getStorageUnitOwnerCapId(
                        storageUnitId
                    );


                terminal(
                    `OWNER CAP: ${storageUnitOwnerCapId}`
                );


                const tx =
                    buildAuthorizeStorageUnitTx({
                        worldPackageId:
                            WORLD_PACKAGE_ID,

                        storageUnitId,

                        characterId,

                        storageUnitOwnerCapId,

                        vylentAuthType:
                            VYLENT_AUTH_TYPE,
                    });


                terminal(
                    "REQUESTING SIGNATURE..."
                );


                const result =
                    await signAndExecute(
                        wallet,
                        suiAccount,
                        tx
                    );


                console.log(
                    "[VYLENT SSU ADMIN] Authorization result:",
                    result
                );


                terminal(
                    "VYLENT AUTHORIZED."
                );


                terminal(
                    `TX: ${result.digest}`
                );

                await new Promise(
                    (resolve) =>
                        setTimeout(resolve, 1000)
                );
                await refreshAdminState();

            } catch (error) {
                console.error(
                    "[VYLENT SSU ADMIN] Authorization error:",
                    error
                );

                terminal(
                    "ERROR: AUTHORIZATION FAILED."
                );

                terminal(
                    error.message ??
                    String(error)
                );
            }
        }
    );


// =========================================================
// INSPECT EXCHANGE
// =========================================================

exchangeButton
    ?.addEventListener(
        "click",
        async (event) => {
            event.preventDefault();

            clearTerminal();

            if (
                !adminState.isAuthorized
            ) {
                terminal(
                    "AUTHORIZE THIS STORAGE UNIT FIRST."
                );

                return;
            }

            terminal(
                `EXCHANGE: ${VYLENT_EXCHANGE_ID}`
            );

            terminal(
                `STORAGE UNIT: ${storageUnitId}`
            );


            if (
                adminState.prices.length ===
                0
            ) {
                terminal(
                    "NO PRICES CONFIGURED FOR THIS SSU."
                );

                terminal(
                    "PRICE EDITING REQUIRES THE VYLENT ADMINCAP / SLUSH ADMIN WALLET."
                );

                return;
            }


            terminal(
                `${adminState.prices.length} PRICE ENTRIES:`
            );


            for (
                const row
                of adminState.prices
            ) {
                const fields =
                    row.fields ?? {};

                terminal(
                    `ITEM ${fields.item_id}: BUY ${fields.buy_from_store} / SELL ${fields.sell_to_store}`
);
}


terminal(
    "PRICE EDITING REQUIRES THE VYLENT ADMINCAP / SLUSH ADMIN WALLET."
);
}
);


// =========================================================
// BUY / SELL TEST BUTTONS
//
// The actual EVE trade implementation now lives in trade.js.
// These buttons take us to the real storefront instead of
// exercising the obsolete credit functions.
// =========================================================

function openStorefront(
    tab = "buy"
) {
    if (!storageUnitId) {
        terminal(
            "NO STORAGE UNIT SELECTED."
        );

        return;
    }

    const url =
        new URL(
            "./index.html",
            window.location.href
        );

    url.searchParams.set(
        "storage",
        storageUnitId
    );

    url.searchParams.set(
        "tab",
        tab
    );

    window.location.href =
        url.toString();
}


buyTestButton
    ?.addEventListener(
        "click",
        (event) => {
            event.preventDefault();

            openStorefront(
                "buy"
            );
        }
    );


sellTestButton
    ?.addEventListener(
        "click",
        (event) => {
            event.preventDefault();

            openStorefront(
                "sell"
            );
        }
    );


// =========================================================
// INITIALIZE
// =========================================================

console.log(
    "[VYLENT SSU ADMIN] Initializing:",
    {
        storageUnitId,
        VYLENT_AUTH_TYPE,
        VYLENT_EXCHANGE_ID,
    }
);


refreshAdminState()
    .catch(
        (error) => {
            console.error(
                "[VYLENT SSU ADMIN] Initial refresh failed:",
                error
            );

            terminal(
                "ADMIN INITIALIZATION FAILED."
            );

            terminal(
                error.message ??
                String(error)
            );
        }
    );
