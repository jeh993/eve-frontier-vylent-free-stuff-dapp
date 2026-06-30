import { Transaction } from "@mysten/sui/transactions";

export function buildAuthorizeStorageUnitTx({
                                                worldPackageId,
                                                storageUnitId,
                                                characterId,
                                                storageUnitOwnerCapId,
                                                vylentAuthType,
                                            }) {
    const tx = new Transaction();

    const [storageUnitOwnerCap, returnReceipt] = tx.moveCall({
        target: `${worldPackageId}::character::borrow_owner_cap`,
        typeArguments: [`${worldPackageId}::storage_unit::StorageUnit`],
        arguments: [
            tx.object(characterId),
            tx.object(storageUnitOwnerCapId),
        ],
    });

    tx.moveCall({
        target: `${worldPackageId}::storage_unit::authorize_extension`,
        typeArguments: [vylentAuthType],
        arguments: [
            tx.object(storageUnitId),
            storageUnitOwnerCap,
        ],
    });

    tx.moveCall({
        target: `${worldPackageId}::character::return_owner_cap`,
        typeArguments: [`${worldPackageId}::storage_unit::StorageUnit`],
        arguments: [
            tx.object(characterId),
            storageUnitOwnerCap,
            returnReceipt,
        ]
    });

    return tx;
}

export function buildExchangeEntryTx(adminCapId, storageUnitId, typeId, quanity){
    const tx = new Transaction();

    tx.moveCall({
        target: `${VYLENT_PACKAGE_ID}::vylent_free_stuff::set_single_freebie`,
        arguments: [
            tx.object(adminCapId),
            tx.object(VYLENT_EXCHANGE_ID),
            tx.pure.id(storageUnitId),
            tx.pure.u64(typeId),
            tx.pure.u32(quanity),
        ]
    })

    return tx;
}

/*export function buildTestSale(storageUnitId, characterId, ownerCapId, exchangeId, typeId, quantity){
    const tx = new Transaction();

    tx.moveCall({
        target: `${VYLENT_PACKAGE_ID}::vylent_free_stuff::sell_item`,
        arguments: [
            tx.object(storageUnitId),
            tx.object(characterId),
            tx.object(ownerCapId),
            tx.object(exchange),
            tx.pure.u64(typeId),
            tx.pure.u32(quantity),
        ],
   });
}*/