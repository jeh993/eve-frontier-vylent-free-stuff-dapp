import { PLAYER_PROFILE_TYPE, VYLENT_EXCHANGE_ID } from "./config";
import {suiClient} from "./sui-client";

const PLAYER_PROFILE_TYPES = [
    "0x8b8a46ed766fa1358ce7c5c51f6a164b13d627a63e45343f69ed0ba0446c1aa1::character::PlayerProfile",
    "0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c::character::PlayerProfile",
];

export async function getExchangeObject() {
    return await suiClient.getObject({
        id: VYLENT_EXCHANGE_ID,
        options: {
            showContent: true,
            showType: true,
        },
    });
}

export async function getExchangeTableIds() {
    const exchange = await getExchangeObject();

    const fields = exchange.data?.content?.fields;

    if (!fields) {
        throw new Error("Exchange object fields not found.");
    }

    console.dir(fields, { depth: null });

    return {
        pricesTableId: fields.prices_by_storage_unit?.fields?.id?.id,
        balancesTableId: fields.balances_by_character?.fields?.id?.id,
        freebiesTableId: fields.freebies_by_storage_unit?.fields?.id?.id,
        timeoutsTableId: fields.timeouts_by_storage_unit?.fields?.id?.id,
        cooldownsTableId: fields.cooldowns_by_storage_unit?.fields?.id?.id,
    };
}

export async function getPriceDynamicFields() {
    const { pricesTableId } = await getExchangeTableIds();

    const fields = await suiClient.getDynamicFields({
        parentId: pricesTableId,
    });

    console.log("price dynamic fields:", fields);

    return fields.data;
}

export async function getPricesForStorageUnit(storageUnitId) {
    const { pricesTableId } = await getExchangeTableIds();

    const field = await suiClient.getDynamicFieldObject({
        parentId: pricesTableId,
        name: {
            type: "0x2::object::ID",
            value: storageUnitId,
        },
    });

    console.log("prices field object:", field);

    const value = field.data?.content?.fields?.value;

    if (!value) {
        throw new Error("No prices found for this storage unit.");
    }

    return value;
}

export async function getStorageUnitContents(storageUnitId) {
    const fields = await suiClient.getDynamicFields({
        parentId: storageUnitId,
    });

    const inventoryIds = fields.data
        .filter(f => f.objectType.includes('::inventory::Inventory'))
        .map(f => f.objectId);

    const inventories = await Promise.all(
        inventoryIds.map(id =>
            suiClient.getObject({
                id,
                options: {
                    showContent: true,
                    showType: true,
                    showOwner: true,
                },
            })
        )
    );

    for (const inv of inventories) {
        const content = inv.data?.content;

        if (content?.dataType === 'moveObject') {
            console.log('Inventory object:', inv.data.objectId);
            console.log('Type:', content.type);
            console.dir(content.fields, { depth: null });
        }
    }
    return inventories;

}

export async function getCharacterIdForWallet(walletAddress) {
    const allObjects = await suiClient.getOwnedObjects({
        owner: walletAddress,
        options: {
            showContent: true,
            showType: true,
        },
    });

    const profile = allObjects.data.find((obj) =>
        PLAYER_PROFILE_TYPES.includes(obj.data?.type)
    );

    if (!profile) {
        throw new Error("No PlayerProfile found for connected wallet.");
    }

    return profile.data.content.fields.character_id;
}

export async function getStorageUnitOwnerCapId(storageUnitId) {
    const storageUnit = await suiClient.getObject({
        id: storageUnitId,
        options: {
            showContent: true,
        },
    });

    const ownerCapId = storageUnit.data?.content?.fields?.owner_cap_id;

    if (!ownerCapId) {
        throw new Error("Storage unit owner_cap_id not found.");
    }

    return ownerCapId;
}

export async function getCharacterOwnerCapRef(characterId) {
    const character = await suiClient.getObject({
        id: characterId,
        options: { showContent: true },
    });

    const ownerCapId = character.data?.content?.fields?.owner_cap_id;

    if (!ownerCapId) {
        throw new Error("Character owner_cap_id not found.");
    }

    const ownerCap = await suiClient.getObject({
        id: ownerCapId,
        options: { showOwner: true },
    });

    return {
        objectId: ownerCap.data.objectId,
        version: ownerCap.data.version,
        digest: ownerCap.data.digest,
    };
}

export async function debugCharacterOwnedObjects(characterId) {
    const owned = await suiClient.getOwnedObjects({
        owner: characterId,
        options: {
            showContent: true,
            showType: true,
            showOwner: true,
        },
        limit: 50,
    });

    console.log("character owned objects:", owned.data.map(o => ({
        objectId: o.data?.objectId,
        type: o.data?.type,
        owner: o.data?.owner,
        content: o.data?.content,
        version: o.data?.version,
        digest: o.data?.digest,
    })));

    return owned;
}

export async function getCreditBalanceForCharacter(characterId) {
    const exchange = await suiClient.getObject({
        id: VYLENT_EXCHANGE_ID,
        options: { showContent: true },
    });

    const balancesTableId =
        exchange.data?.content?.fields?.balances_by_character?.fields?.id?.id;

    if (!balancesTableId) {
        throw new Error("Balances table not found.");
    }

    const result = await suiClient.getDynamicFieldObject({
        parentId: balancesTableId,
        name: {
            type: "0x2::object::ID",
            value: characterId,
        },
    });

    const value = result.data?.content?.fields?.value;

    return Number(value || 0);
}

export async function getStorageInventoryItems(storageUnitId, inventoryKeyId) {
    const result = await suiClient.getDynamicFieldObject({
        parentId: storageUnitId,
        name: {
            type: "0x2::object::ID",
            value: inventoryKeyId,
        },
    });

    const items =
        result.data?.content?.fields?.value?.fields?.items?.fields?.contents || [];

    return items.map(row => ({
        typeId: Number(row.fields.key),
        itemId: Number(row.fields.value.fields.item_id),
        quantity: Number(row.fields.value.fields.quantity),
        volume: Number(row.fields.value.fields.volume),
        tenant: row.fields.value.fields.tenant,
    }));
}

export async function getStoreInventoryItems(storageUnitId) {
    const storageUnit = await suiClient.getObject({
        id: storageUnitId,
        options: { showContent: true },
    });

    const storeInventoryKey =
        storageUnit.data?.content?.fields?.owner_cap_id;

    if (!storeInventoryKey) {
        throw new Error("Storage unit owner_cap_id not found.");
    }

    return await getStorageInventoryItems(storageUnitId, storeInventoryKey);
}

export async function getCharacterInventoryItems(storageUnitId, characterId) {
    const character = await suiClient.getObject({
        id: characterId,
        options: { showContent: true },
    });

    const characterInventoryKey =
        character.data?.content?.fields?.owner_cap_id;

    if (!characterInventoryKey) {
        throw new Error("Character owner_cap_id not found.");
    }

    return await getStorageInventoryItems(storageUnitId, characterInventoryKey);
}