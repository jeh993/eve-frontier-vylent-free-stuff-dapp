import{C as e,S as t,_ as n,a as r,b as i,c as a,f as o,h as s,i as c,l,m as u,n as d,o as f,p,r as m,t as h,v as g,x as _}from"./world-0VWNJrQF.js";var v=e((async()=>{_(),u(),l(),i();var e=new URLSearchParams(window.location.search).get(`storage`),f=document.getElementById(`trade-terminal-output`),p=document.getElementById(`market-output`),v=document.getElementById(`credits`),y=`buy`;document.getElementById(`buy-tab`).addEventListener(`click`,async()=>{y=`buy`,T(C,await k()),M()}),document.getElementById(`sell-tab`).addEventListener(`click`,async()=>{y=`sell`,T(C,await k()),M()});var b=await r(e),x=`/eve-frontier-vylent-free-stuff-dapp/dist/types-index.json`,S=null,C=await Promise.all(b.map(async e=>{let t=Number(e.fields.item_id);return console.log(`ITEM ID`,t,await A(t)),{itemId:t,name:await A(t),buyPrice:Number(e.fields.buy_from_store),sellPrice:Number(e.fields.sell_to_store)}}));O(),M(),T(C,await k());function w(e){f.style.display=`block`,f.innerHTML+=`${e}<br>`}function T(e,t){p.innerHTML=`
        <div class="market-header">
            <span>ITEM</span>
            <span>AVAILABLE</span>
            <span>PRICE</span>
            <span>QTY</span>
            <span></span>
        </div>

        ${e.map(e=>{let n=t.storeByType.get(e.itemId)?.quantity||0,r=t.characterByType.get(e.itemId)?.quantity||0,i=y===`buy`?n:r,a=y===`buy`?e.buyPrice:e.sellPrice,o=y===`buy`?`buy-link`:`sell-link`,s=y===`buy`?`[Buy]`:`[Sell]`;return`
                <div class="market-row">
                    <span>${e.name}</span>
                    <span>${i.toLocaleString()}</span>
                    <span>${a}</span>

                    <input
                        id="qty-${e.itemId}"
                        type="number"
                        min="1"
                        max="${i}"
                        value="1"
                    />

                    <a
                        href="#"
                        data-item="${e.itemId}"
                        class="${o}"
                    >
                        ${s}
                    </a>
                </div>
            `}).join(``)}
    `,y===`buy`?document.querySelectorAll(`.buy-link`).forEach(e=>e.addEventListener(`click`,E)):document.querySelectorAll(`.sell-link`).forEach(e=>e.addEventListener(`click`,D))}async function E(r){r.preventDefault(),f.innerHTML=``;let i=Number(r.target.dataset.item),a=Number(document.getElementById(`qty-${i}`).value);console.log(i,a);try{w(`CONNECTING TO WALLET...`);let{wallet:r,suiAccount:c}=await o(),l=c.address,u=await h(l);w(`DRIFTER IDENTIFIED: ${l.slice(0,8)}...`),w(`BUYING ${a}x ITEM ${i}...`);let d=new t;d.setSender(l),d.moveCall({target:`${g}::vylent_free_stuff::buy_item`,arguments:[d.object(e),d.object(u),d.object(n),d.pure.u64(i),d.pure.u32(a)]}),console.log(`buy tx json:`,await d.toJSON()),w(`SUBMITTING TRADE...`);let f=await s(r,c,d);console.log(`buy result:`,f),w(`TRADE COMPLETE.`),w(`TX: ${f.digest}`),await O(),T(C,await k())}catch(e){console.error(e),w(`ERROR: PURCHASE FAILED.`),w(e.message||`UNKNOWN FRONTIER FAILURE.`)}}async function D(r){r.preventDefault(),f.innerHTML=``;let i=Number(r.target.dataset.item),a=Number(document.getElementById(`qty-${i}`).value);try{w(`CONNECTING TO WALLET...`);let{wallet:r,suiAccount:c}=await o(),l=c.address,u=await h(l),d=await m(u);console.log(`ownerCapRef:`,d),w(`OWNER CAP: ${d.objectId.slice(0,10)}...`),w(`SELLING ${a}x ITEM ${i}...`);let f=new t;f.setSender(l),f.moveCall({target:`${g}::vylent_free_stuff::sell_item`,arguments:[f.object(e),f.object(u),f.receivingRef(d),f.object(n),f.pure.u64(i),f.pure.u32(a)]});let p=await s(r,c,f);w(`SALE COMPLETE.`),w(`TX: ${p.digest}`),await O(),T(C,await k())}catch(e){console.error(e),w(`ERROR: SALE FAILED.`),w(e.message||`UNKNOWN FRONTIER FAILURE.`)}}async function O(){let{wallet:e,suiAccount:t}=await o(),n=t.address;v.innerHTML=`CREDITS: ${await c(await h(n))}`}async function k(){let{wallet:t,suiAccount:n}=await o(),r=n.address,i=await h(r),s=await a(e),c=await d(e,i);return{storeByType:new Map(s.map(e=>[e.typeId,e])),characterByType:new Map(c.map(e=>[e.typeId,e]))}}async function A(e){let t=await j(),n=String(e);return console.log(`TYPE INDEX LOADED?`,!!t),console.log(`LOOKUP KEY:`,n),console.log(`RAW ENTRY:`,t[n]),console.dir(t[n],{depth:null}),t[n]?.name||`ITEM ${e}`}async function j(){if(S)return S;let e=await fetch(x);if(!e.ok)throw Error(`Type index fetch failed: ${e.status}`);return S=await e.json(),S}function M(){document.getElementById(`buy-tab`).innerHTML=y===`buy`?`&gt;[Buy]&lt;`:`[Buy]`,document.getElementById(`sell-tab`).innerHTML=y===`sell`?`&gt;[Sell]&lt;`:`[Sell]`}})),y=e((async()=>{_(),u(),l(),i();var e=new URLSearchParams(window.location.search).get(`storage`),r=document.getElementById(`terminal-output`),a=document.getElementById(`claim-kit-button`);e||o(`ERROR: NO STORAGE UNIT SPECIFIED.`);function o(e){r.style.display=`block`,r.innerHTML+=`${e}<br>`}console.log(`loaded`),await f(e),a.addEventListener(`click`,async i=>{i.preventDefault(),r.innerHTML=``;try{o(`CONNECTING TO WALLET...`),o(`VERIFYING YOU ARE NOT A LEDGERMAN...`);let{wallet:r,suiAccount:i}=await p(),a=await h(i.address);o(`DRIFTER IDENTIFIED: ${i.address.slice(0,8)}...`);let c=new t,l=c.object(e),u=c.object(a),d=c.object(n);c.moveCall({target:`${g}::vylent_free_stuff::claim_free_item`,arguments:[l,u,d,c.object(`0x6`)]}),o(`DISPENSING FREE SHAME REDUCTION PACKAGE...`),console.log(`tx json:`,await c.toJSON());let f=await s(r,i,c);console.log(`claim result:`,f),console.log(`effects:`,f.effects),o(`PACKAGE DISPENSED.`),o(`TX: ${f.digest}`),o(`NOW GIT.`)}catch(e){console.error(e),o(`ERROR: DISPENSER JAMMED.`),o(e.message||`UNKNOWN FRONTIER FAILURE.`)}})}));v(),y();