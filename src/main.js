import { Transaction } from "@mysten/sui/transactions";
import { getWalletAndAccount, signAndExecute } from "./wallet.js";
import {getCharacterIdForWallet, getCreditBalanceForCharacter, getStorageUnitContents} from "./world.js";
import { VYLENT_PACKAGE_ID, VYLENT_EXCHANGE_ID } from "./config.js";

const params = new URLSearchParams(window.location.search);

const STORAGE_UNIT_ID = params.get("storage");

const output = document.getElementById("terminal-output");
const button = document.getElementById("claim-kit-button");

if (!STORAGE_UNIT_ID) {
    terminal("ERROR: NO STORAGE UNIT SPECIFIED.");
}

function terminal(message) {
    output.style.display = "block";
    output.innerHTML += `${message}<br>`;
}

console.log("loaded");

let contents = await getStorageUnitContents(STORAGE_UNIT_ID);
//console.log(contents);

button.addEventListener("click", async (event) => {
    event.preventDefault();
    output.innerHTML = "";

    try {
        terminal("CONNECTING TO WALLET...");
        terminal("VERIFYING YOU ARE NOT A LEDGERMAN...");

        const { wallet, suiAccount } = await getWalletAndAccount();

        const characterId =
            await getCharacterIdForWallet(suiAccount.address);

        terminal(`DRIFTER IDENTIFIED: ${suiAccount.address.slice(0, 8)}...`);

        const tx = new Transaction();

        const storageUnit = tx.object(STORAGE_UNIT_ID);
        const character = tx.object(characterId);
        const exchange = tx.object(VYLENT_EXCHANGE_ID);

        tx.moveCall({
            target: `${VYLENT_PACKAGE_ID}::vylent_free_stuff::claim_free_item`,
            arguments: [
                storageUnit,
                character,
                exchange,
                tx.object("0x6"),
            ],
        });

        terminal("DISPENSING FREE SHAME REDUCTION PACKAGE...");

        console.log("tx json:", await tx.toJSON());

        const result = await signAndExecute(wallet, suiAccount, tx);

        console.log("claim result:", result);
        console.log("effects:", result.effects);

        terminal("PACKAGE DISPENSED.");
        terminal(`TX: ${result.digest}`);
        terminal("NOW GIT.");
    } catch (error) {
        console.error(error);
        terminal("ERROR: DISPENSER JAMMED.");
        terminal(error.message || "UNKNOWN FRONTIER FAILURE.");
    }
});











