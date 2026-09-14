import {
    PLAYER_PROFILE_TYPE,
    VYLENT_EXCHANGE_ID,
} from "./config.js";

import { suiClient } from "./sui-client.js";


// =========================================================
// SMALL NORMALIZATION HELPERS
// =========================================================

function isObject(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}


function unwrapFields(value) {
    if (
        isObject(value) &&
        isObject(value.fields)
    ) {
        return value.fields;
    }

    return value;
}


function normalizeHex(value) {
    if (
        typeof value !== "string"
    ) {
        return value;
    }

    if (
        value.startsWith("0x")
    ) {
        return value.toLowerCase();
    }

    return value;
}


function extractId(value) {
    if (!value) {
        return null;
    }

    if (
        typeof value === "string"
    ) {
        return value;
    }

    const unwrapped =
        unwrapFields(value);

    if (
        typeof unwrapped === "string"
    ) {
        return unwrapped;
    }

    if (
        isObject(unwrapped)
    ) {
        if (
            typeof unwrapped.id === "string"
        ) {
            return unwrapped.id;
        }

        if (unwrapped.id) {
            const nested =
                extractId(
                    unwrapped.id
                );

            if (nested) {
                return nested;
            }
        }

        if (
            typeof unwrapped.bytes === "string"
        ) {
            return unwrapped.bytes;
        }

        if (
            typeof unwrapped.value === "string"
        ) {
            return unwrapped.value;
        }
    }

    return null;
}


// =========================================================
// GENERIC OBJECT READ
// =========================================================

async function getJsonObject(
    objectId
) {
    const { object } =
        await suiClient.getObject({
            objectId,

            include: {
                json: true,
            },
        });

    if (!object) {
        throw new Error(
            `Object not found: ${objectId}`
        );
    }

    return object;
}


// =========================================================
// DYNAMIC FIELD HELPERS
// =========================================================

async function listAllDynamicFields(
    parentId
) {
    const results =
        [];

    let page =
        await suiClient.listDynamicFields({
            parentId,
            limit: 50,
        });

    while (true) {
        results.push(
            ...page.dynamicFields
        );

        if (
            !page.hasNextPage
        ) {
            break;
        }

        page =
            await suiClient.listDynamicFields({
                parentId,
                cursor:
                    page.cursor,
                limit: 50,
            });
    }

    return results;
}


async function getDynamicFieldJsonEntries(
    parentId
) {
    const fields =
        await listAllDynamicFields(
            parentId
        );

    if (
        fields.length === 0
    ) {
        return [];
    }

    const objectIds =
        fields
            .map(
                (field) =>
                    field.fieldId
            )
            .filter(Boolean);

    if (
        objectIds.length === 0
    ) {
        return [];
    }

    const entries =
        [];

    for (
        let i = 0;
        i < objectIds.length;
        i += 50
    ) {
        const chunk =
            objectIds.slice(
                i,
                i + 50
            );

        const {
            objects
        } =
            await suiClient.getObjects({
                objectIds:
                    chunk,

                include: {
                    json: true,
                },
            });

        for (
            const object
            of objects
        ) {
            if (
                object instanceof Error
            ) {
                console.warn(
                    "[WORLD] Could not read dynamic field:",
                    object
                );

                continue;
            }

            entries.push(
                object
            );
        }
    }

    return entries;
}


async function findDynamicFieldByIdKey(
    parentId,
    keyId
) {
    const target =
        normalizeHex(
            keyId
        );

    const entries =
        await getDynamicFieldJsonEntries(
            parentId
        );

    for (
        const entry
        of entries
    ) {
        const json =
            unwrapFields(
                entry.json
            );

        const fieldName =
            extractId(
                json?.name
            );

        if (
            fieldName &&
            normalizeHex(
                fieldName
            ) === target
        ) {
            return entry;
        }
    }

    return null;
}


// =========================================================
// EXCHANGE
// =========================================================

export async function getExchangeObject() {
    return await getJsonObject(
        VYLENT_EXCHANGE_ID
    );
}


export async function getExchangeTableIds() {
    const exchange =
        await getExchangeObject();

    const fields =
        unwrapFields(
            exchange.json
        );

    if (!fields) {
        throw new Error(
            "Exchange object fields not found."
        );
    }

    console.log(
        "[WORLD] Exchange JSON:",
        fields
    );

    return {
        pricesTableId:
            extractId(
                fields
                    .prices_by_storage_unit
            ),

        balancesTableId:
            extractId(
                fields
                    .balances_by_character
            ),

        freebiesTableId:
            extractId(
                fields
                    .freebies_by_storage_unit
            ),

        timeoutsTableId:
            extractId(
                fields
                    .timeouts_by_storage_unit
            ),

        cooldownsTableId:
            extractId(
                fields
                    .cooldowns_by_storage_unit
            ),
    };
}


// =========================================================
// PRICE TABLE
// =========================================================

export async function getPriceDynamicFields() {
    const {
        pricesTableId
    } =
        await getExchangeTableIds();

    if (!pricesTableId) {
        throw new Error(
            "Prices table ID not found."
        );
    }

    const fields =
        await listAllDynamicFields(
            pricesTableId
        );

    console.log(
        "[WORLD] Price dynamic fields:",
        fields
    );

    return fields;
}


export async function getPricesForStorageUnit(
    storageUnitId
) {
    const {
        pricesTableId
    } =
        await getExchangeTableIds();

    if (!pricesTableId) {
        throw new Error(
            "Prices table ID not found."
        );
    }

    const field =
        await findDynamicFieldByIdKey(
            pricesTableId,
            storageUnitId
        );

    console.log(
        "[WORLD] Price field object:",
        field
    );

    if (!field) {
        throw new Error(
            "No prices found for this storage unit."
        );
    }

    const json =
        unwrapFields(
            field.json
        );

    const value =
        unwrapFields(
            json?.value
        );

    if (
        !Array.isArray(value)
    ) {
        console.log(
            "[WORLD] Unexpected price value:",
            value
        );

        throw new Error(
            "Price table value had an unexpected shape."
        );
    }

    /*
     * Preserve the old world.js return shape so
     * current trade.js can continue using row.fields.
     */
    return value.map(
        (row) => {

            const fields =
                unwrapFields(
                    row
                );

            return {
                fields: {
                    item_id:
                        fields.item_id,

                    sell_to_store:
                        fields.sell_to_store,

                    buy_from_store:
                        fields.buy_from_store,
                },
            };
        }
    );
}


// =========================================================
// PLAYER PROFILE / CHARACTER
// =========================================================

export async function getCharacterIdForWallet(
    walletAddress
) {
    console.log(
        "[WORLD] Looking for configured PlayerProfile:",
        {
            owner: walletAddress,
            type: PLAYER_PROFILE_TYPE,
        }
    );

    let page =
        await suiClient.listOwnedObjects({
            owner: walletAddress,
            type: PLAYER_PROFILE_TYPE,

            include: {
                json: true,
            },

            limit: 50,
        });

    while (true) {
        for (
            const object
            of page.objects
            ) {
            console.log(
                "[WORLD] Matching PlayerProfile:",
                object
            );

            const fields =
                unwrapFields(
                    object.json
                );

            const characterId =
                extractId(
                    fields?.character_id
                );

            if (characterId) {
                console.log(
                    "[WORLD] Character selected:",
                    {
                        profileType:
                        object.type,
                        characterId,
                    }
                );

                return characterId;
            }
        }

        if (!page.hasNextPage) {
            break;
        }

        page =
            await suiClient.listOwnedObjects({
                owner: walletAddress,
                type: PLAYER_PROFILE_TYPE,

                include: {
                    json: true,
                },

                cursor:
                page.cursor,

                limit: 50,
            });
    }

    throw new Error(
        `No PlayerProfile of the configured World type was found: ${PLAYER_PROFILE_TYPE}`
    );
}


// =========================================================
// STORAGE UNIT
// =========================================================

export async function getStorageUnitOwnerCapId(
    storageUnitId
) {
    const storageUnit =
        await getJsonObject(
            storageUnitId
        );

    const fields =
        unwrapFields(
            storageUnit.json
        );

    const ownerCapId =
        extractId(
            fields?.owner_cap_id
        );

    if (!ownerCapId) {
        console.log(
            "[WORLD] Storage Unit JSON:",
            fields
        );

        throw new Error(
            "Storage unit owner_cap_id not found."
        );
    }

    return ownerCapId;
}


export async function getStorageUnitContents(
    storageUnitId
) {
    const fields =
        await listAllDynamicFields(
            storageUnitId
        );

    console.log(
        "[WORLD] Storage Unit dynamic fields:",
        fields
    );

    const inventoryFields =
        fields.filter(
            (field) =>
                String(
                    field.valueType ??
                    ""
                ).includes(
                    "::inventory::Inventory"
                )
        );

    const results =
        [];

    for (
        const field
        of inventoryFields
    ) {
        if (!field.fieldId) {
            continue;
        }

        try {
            const object =
                await getJsonObject(
                    field.fieldId
                );

            results.push(
                object
            );
        } catch (
            error
        ) {
            console.warn(
                "[WORLD] Failed reading inventory field:",
                field,
                error
            );
        }
    }

    return results;
}


// =========================================================
// CHARACTER OWNER CAP
// =========================================================

export async function getCharacterOwnerCapRef(
    characterId
) {
    const character =
        await getJsonObject(
            characterId
        );

    const fields =
        unwrapFields(
            character.json
        );

    const ownerCapId =
        extractId(
            fields?.owner_cap_id
        );

    if (!ownerCapId) {
        console.log(
            "[WORLD] Character JSON:",
            fields
        );

        throw new Error(
            "Character owner_cap_id not found."
        );
    }

    const {
        object
    } =
        await suiClient.getObject({
            objectId:
                ownerCapId,
        });

    if (!object) {
        throw new Error(
            `Character OwnerCap not found: ${ownerCapId}`
        );
    }

    return {
        objectId:
            object.objectId,

        version:
            object.version,

        digest:
            object.digest,
    };
}


// =========================================================
// DEBUG CHARACTER OWNED OBJECTS
// =========================================================

export async function debugCharacterOwnedObjects(
    characterId
) {
    const objects =
        [];

    let page =
        await suiClient.listOwnedObjects({
            owner:
                characterId,

            include: {
                json: true,
            },

            limit: 50,
        });

    while (true) {
        objects.push(
            ...page.objects
        );

        if (
            !page.hasNextPage
        ) {
            break;
        }

        page =
            await suiClient.listOwnedObjects({
                owner:
                    characterId,

                include: {
                    json: true,
                },

                cursor:
                    page.cursor,

                limit: 50,
            });
    }

    console.log(
        "[WORLD] Character owned objects:",
        objects.map(
            (object) => ({
                objectId:
                    object.objectId,

                type:
                    object.type,

                owner:
                    object.owner,

                json:
                    object.json,

                version:
                    object.version,

                digest:
                    object.digest,
            })
        )
    );

    return objects;
}


// =========================================================
// LEGACY VYLENT CREDIT BALANCE
// Kept only so older UI code does not break.
// =========================================================

export async function getCreditBalanceForCharacter(
    characterId
) {
    const {
        balancesTableId
    } =
        await getExchangeTableIds();

    if (!balancesTableId) {
        throw new Error(
            "Balances table not found."
        );
    }

    const field =
        await findDynamicFieldByIdKey(
            balancesTableId,
            characterId
        );

    if (!field) {
        return 0;
    }

    const json =
        unwrapFields(
            field.json
        );

    const value =
        unwrapFields(
            json?.value
        );

    if (
        typeof value === "number"
    ) {
        return value;
    }

    if (
        typeof value === "string"
    ) {
        return Number(
            value
        );
    }

    if (
        isObject(value) &&
        value.value != null
    ) {
        return Number(
            value.value
        );
    }

    return 0;
}


// =========================================================
// INVENTORY
// =========================================================

function findContentsArray(
    value
) {
    if (!value) {
        return null;
    }

    const current =
        unwrapFields(
            value
        );

    if (
        Array.isArray(current)
    ) {
        return current;
    }

    if (
        !isObject(current)
    ) {
        return null;
    }

    if (
        Array.isArray(
            current.contents
        )
    ) {
        return current.contents;
    }

    if (
        current.items
    ) {
        const found =
            findContentsArray(
                current.items
            );

        if (found) {
            return found;
        }
    }

    for (
        const child
        of Object.values(
            current
        )
    ) {
        if (
            isObject(child) ||
            Array.isArray(child)
        ) {
            const found =
                findContentsArray(
                    child
                );

            if (found) {
                return found;
            }
        }
    }

    return null;
}


export async function getStorageInventoryItems(
    storageUnitId,
    inventoryKeyId
) {
    const field =
        await findDynamicFieldByIdKey(
            storageUnitId,
            inventoryKeyId
        );

    if (!field) {
        console.log(
            "[WORLD] No inventory field found:",
            {
                storageUnitId,
                inventoryKeyId,
            }
        );

        return [];
    }

    const json =
        unwrapFields(
            field.json
        );

    const value =
        unwrapFields(
            json?.value
        );

    console.log(
        "[WORLD] Inventory field value:",
        value
    );

    const contents =
        findContentsArray(
            value
        ) ?? [];

    return contents.map(
        (row) => {

            const fields =
                unwrapFields(
                    row
                );

            const item =
                unwrapFields(
                    fields.value
                );

            return {
                typeId:
                    Number(
                        fields.key
                    ),

                itemId:
                    Number(
                        item.item_id
                    ),

                quantity:
                    Number(
                        item.quantity
                    ),

                volume:
                    Number(
                        item.volume
                    ),

                tenant:
                    item.tenant,
            };
        }
    );
}


export async function getStoreInventoryItems(
    storageUnitId
) {
    const storeInventoryKey =
        await getStorageUnitOwnerCapId(
            storageUnitId
        );

    return await getStorageInventoryItems(
        storageUnitId,
        storeInventoryKey
    );
}


export async function getCharacterInventoryItems(
    storageUnitId,
    characterId
) {
    const character =
        await getJsonObject(
            characterId
        );

    const fields =
        unwrapFields(
            character.json
        );

    const characterInventoryKey =
        extractId(
            fields?.owner_cap_id
        );

    if (!characterInventoryKey) {
        console.log(
            "[WORLD] Character JSON:",
            fields
        );

        throw new Error(
            "Character owner_cap_id not found."
        );
    }

    return await getStorageInventoryItems(
        storageUnitId,
        characterInventoryKey
    );
}


console.log(
    "[WORLD] gRPC world helpers loaded"
);
