import{a as e,d as t,g as n,h as r,l as i,m as a,n as o,p as s,t as c,u as l}from"./sui-client-DM3OdUcG.js";import{i as u,n as d,r as f,t as p}from"./wallet-Cf8AOpik.js";import{a as m,c as h,i as g,n as _,r as v,s as y,t as b}from"./world-wGDV4HZ1.js";var x=n((async()=>{a(),f(),h(),c(),s();var n=9,d=10n**BigInt(n),m=new URLSearchParams(window.location.search).get(`storage`);if(!m)throw Error(`No storage unit supplied in URL.`);var x=document.getElementById(`trade-terminal-output`),S=document.getElementById(`market-output`),C=document.getElementById(`credits`),w=`buy`,T=null;console.log(`[VYLENT TRADE] Config:`,{storageUnit:m,package:t,exchange:l,treasury:i,eveType:e});function E(e){let t=BigInt(e),r=t/d,i=(t%d).toString().padStart(n,`0`).replace(/0+$/,``);return i?`${r}.${i}`:`${r}`}function D(e){x.style.display=`block`,x.innerHTML+=`${e}<br>`}async function O(t){let n=[],r=null;for(;;){let i=await o.listCoins({owner:t,coinType:e,cursor:r,limit:50});if(n.push(...i.objects),!i.hasNextPage)break;r=i.cursor}return console.log(`[VYLENT TRADE] EVE coins:`,n),n}function k(e){return e.reduce((e,t)=>e+BigInt(t.balance),0n)}function A(e,t){let n=[...e].sort((e,t)=>{let n=BigInt(e.balance),r=BigInt(t.balance);return r>n?1:r<n?-1:0}),r=[],i=0n;for(let e of n)if(r.push(e),i+=BigInt(e.balance),i>=t)break;if(i<t)throw Error(`Insufficient EVE. Wallet has ${E(i)} EVE but purchase requires ${E(t)} EVE.`);return r}async function j(){let{object:e}=await o.getObject({objectId:i,include:{json:!0}});if(!e)throw Error(`Vylent EVE treasury was not found.`);let t=e.json?.balance;if(t==null)throw Error(`Could not read Vylent treasury balance.`);return BigInt(t)}async function M(){let{suiAccount:e}=await p(),t=k(await O(e.address));return C.innerHTML=`EVE: ${E(t)}`,t}var N=await g(m),P=`./types-index.json`,F=await Promise.all(N.map(async e=>{let t=Number(e.fields.item_id),n=BigInt(e.fields.buy_from_store),r=BigInt(e.fields.sell_to_store);return{itemId:t,name:await V(t),buyPrice:n,sellPrice:r}}));console.log(`[VYLENT TRADE] Items:`,F),document.getElementById(`buy-tab`).addEventListener(`click`,async()=>{w=`buy`,I(F,await B()),U()}),document.getElementById(`sell-tab`).addEventListener(`click`,async()=>{w=`sell`,I(F,await B()),U()}),U(),C.innerHTML=`EVE: <a href="#" id="connect-credits">[CONNECT WALLET]</a>`,I(F,await z()),document.getElementById(`connect-credits`).addEventListener(`click`,async e=>{e.preventDefault();try{D(`CONNECTING TO EVE VAULT...`),await M(),D(`EVE WALLET CONNECTED.`),I(F,await B())}catch(e){console.error(e),D(`ERROR: WALLET CONNECTION FAILED.`),D(e.message||`UNKNOWN WALLET FAILURE.`)}});function I(e,t){S.innerHTML=`
        <div class="market-header">
            <span>ITEM</span>
            <span>AVAILABLE</span>
            <span>PRICE</span>
            <span>QTY</span>
            <span>TOTAL</span>
            <span></span>
        </div>

        ${e.map(e=>{let n=t.storeByType.get(e.itemId)?.quantity||0,r=t.characterByType.get(e.itemId)?.quantity||0,i=w===`buy`?n:r,a=w===`buy`?e.buyPrice:e.sellPrice,o=w===`buy`?`buy-link`:`sell-link`,s=w===`buy`?`[Buy]`:`[Sell]`,c=E(a);return`
                    <div class="market-row">

                        <span>
                            ${e.name}
                        </span>

                        <span>
                            ${i.toLocaleString()}
                        </span>

                        <span>
                            ${c} EVE
                        </span>

                        <input
                            id="qty-${e.itemId}"
                            data-item="${e.itemId}"
                            data-price="${a.toString()}"
                            class="qty-input"
                            type="number"
                            min="1"
                            max="${i}"
                            value="1"
                        />

                        <span
                            id="total-${e.itemId}"
                        >
                            ${c} EVE
                        </span>

                        <a
                            href="#"
                            data-item="${e.itemId}"
                            class="${o}"
                        >
                            ${s}
                        </a>

                    </div>
                `}).join(``)}
    `,w===`buy`?document.querySelectorAll(`.buy-link`).forEach(e=>e.addEventListener(`click`,L)):document.querySelectorAll(`.sell-link`).forEach(e=>e.addEventListener(`click`,R)),document.querySelectorAll(`.qty-input`).forEach(e=>{e.addEventListener(`input`,()=>{let t=Number(e.dataset.item),n=BigInt(e.dataset.price)*BigInt(e.value||`0`);document.getElementById(`total-${t}`).textContent=`${E(n)} EVE`})})}async function L(e){e.preventDefault(),x.innerHTML=``;let n=Number(e.target.dataset.item),a=Number(document.getElementById(`qty-${n}`).value);try{if(!Number.isInteger(a)||a<=0)throw Error(`Quantity must be greater than zero.`);D(`CONNECTING TO EVE VAULT...`);let{wallet:e,suiAccount:o}=await p(),s=o.address,c=await b(s),d=F.find(e=>e.itemId===n);if(!d)throw Error(`Unknown item ${n}.`);let f=d.buyPrice*BigInt(a);D(`DRIFTER IDENTIFIED: ${s.slice(0,8)}...`),D(`BUYING ${a}x ${d.name}`),D(`PRICE: ${E(f)} EVE`);let h=A(await O(s),f);D(`USING ${h.length} EVE COIN OBJECT(S)...`);let g=new r;g.setSender(s);let _=g.object(h[0].objectId);h.length>1&&g.mergeCoins(_,h.slice(1).map(e=>g.object(e.objectId)));let[v]=g.moveCall({target:`${t}::vylent_free_stuff::buy_item_eve`,arguments:[g.object(m),g.object(c),g.object(l),g.object(i),_,g.pure.u64(n),g.pure.u32(a)]});g.transferObjects([v],g.pure.address(s)),console.log(`[VYLENT TRADE] buy tx:`,await g.toJSON()),D(`SUBMITTING EVE PURCHASE...`);let y=await u(e,o,g);console.log(`[VYLENT TRADE] buy result:`,y),D(`PURCHASE COMPLETE.`),D(`TX: ${y.digest}`),await M(),I(F,await B())}catch(e){console.error(`[VYLENT TRADE] BUY ERROR:`,e),D(`ERROR: PURCHASE FAILED.`),D(e.message||`UNKNOWN FRONTIER FAILURE.`)}}async function R(e){e.preventDefault(),x.innerHTML=``;let n=Number(e.target.dataset.item),a=Number(document.getElementById(`qty-${n}`).value);try{if(!Number.isInteger(a)||a<=0)throw Error(`Quantity must be greater than zero.`);D(`CONNECTING TO EVE VAULT...`);let{wallet:e,suiAccount:o}=await p(),s=o.address,c=await b(s),d=await v(c),f=F.find(e=>e.itemId===n);if(!f)throw Error(`Unknown item ${n}.`);let h=f.sellPrice*BigInt(a),g=await j();if(g<h)throw Error(`Store only has ${E(g)} EVE available. This sale requires ${E(h)} EVE.`);D(`SELLING ${a}x ${f.name}`),D(`PAYOUT: ${E(h)} EVE`),D(`OWNER CAP: ${d.objectId.slice(0,10)}...`);let _=new r;_.setSender(s);let[y]=_.moveCall({target:`${t}::vylent_free_stuff::sell_item_eve`,arguments:[_.object(m),_.object(c),_.receivingRef(d),_.object(l),_.object(i),_.pure.u64(n),_.pure.u32(a)]});_.transferObjects([y],_.pure.address(s)),console.log(`[VYLENT TRADE] sell tx:`,await _.toJSON()),D(`SUBMITTING SALE...`);let x=await u(e,o,_);console.log(`[VYLENT TRADE] sell result:`,x),D(`SALE COMPLETE.`),D(`TX: ${x.digest}`),await M(),I(F,await B())}catch(e){console.error(`[VYLENT TRADE] SELL ERROR:`,e),D(`ERROR: SALE FAILED.`),D(e.message||`UNKNOWN FRONTIER FAILURE.`)}}async function z(){let e=await y(m);return{storeByType:new Map(e.map(e=>[e.typeId,e])),characterByType:new Map}}async function B(){let{suiAccount:e}=await p(),t=e.address,n=await b(t),r=await y(m),i=await _(m,n);return{storeByType:new Map(r.map(e=>[e.typeId,e])),characterByType:new Map(i.map(e=>[e.typeId,e]))}}async function V(e){return(await H())[String(e)]?.name||`ITEM ${e}`}async function H(){if(T)return T;let e=await fetch(P);if(!e.ok)throw Error(`Type index fetch failed: ${e.status}`);return T=await e.json(),T}function U(){document.getElementById(`buy-tab`).innerHTML=w===`buy`?`&gt;[Buy]&lt;`:`[Buy]`,document.getElementById(`sell-tab`).innerHTML=w===`sell`?`&gt;[Sell]&lt;`:`[Sell]`}console.log(`[VYLENT TRADE] initialization complete`)})),S=n((async()=>{a(),f(),h(),s();var e=new URLSearchParams(window.location.search).get(`storage`),n=document.getElementById(`terminal-output`),i=document.getElementById(`claim-kit-button`);e||o(`ERROR: NO STORAGE UNIT SPECIFIED.`);function o(e){n.style.display=`block`,n.innerHTML+=`${e}<br>`}console.log(`loaded`),await m(e),i.addEventListener(`click`,async i=>{i.preventDefault(),n.innerHTML=``;try{o(`CONNECTING TO WALLET...`),o(`VERIFYING YOU ARE NOT A LEDGERMAN...`);let{wallet:n,suiAccount:i}=await d(),a=await b(i.address);o(`DRIFTER IDENTIFIED: ${i.address.slice(0,8)}...`);let s=new r,c=s.object(e),f=s.object(a),p=s.object(l);s.moveCall({target:`${t}::vylent_free_stuff::claim_free_item`,arguments:[c,f,p,s.object(`0x6`)]}),o(`DISPENSING FREE SHAME REDUCTION PACKAGE...`),console.log(`tx json:`,await s.toJSON());let m=await u(n,i,s);console.log(`claim result:`,m),console.log(`effects:`,m.effects),o(`PACKAGE DISPENSED.`),o(`TX: ${m.digest}`),o(`NOW GIT.`)}catch(e){console.error(e),o(`ERROR: DISPENSER JAMMED.`),o(e.message||`UNKNOWN FRONTIER FAILURE.`)}})}));x(),S();