import{a as e,c as t,d as n,f as r,i,l as a,m as o,o as s,p as c,r as l}from"./sui-client-CMS4i6cL.js";import{a as u,c as d,i as f,l as p,n as m,o as h,r as g,t as _}from"./world-AfzM2nMQ.js";var v=o((async()=>{r(),e(),p(),n();var i=new URLSearchParams(window.location.search).get(`storage`),o=document.getElementById(`trade-terminal-output`),h=document.getElementById(`market-output`),v=document.getElementById(`credits`),y=`buy`;document.getElementById(`buy-tab`).addEventListener(`click`,async()=>{y=`buy`,T(C,await A()),N()}),document.getElementById(`sell-tab`).addEventListener(`click`,async()=>{y=`sell`,T(C,await A()),N()});var b=await u(i),x=`/eve-frontier-vylent-free-stuff-dapp/dist/types-index.json`,S=null,C=await Promise.all(b.map(async e=>{let t=Number(e.fields.item_id);return console.log(`ITEM ID`,t,await j(t)),{itemId:t,name:await j(t),buyPrice:Number(e.fields.buy_from_store),sellPrice:Number(e.fields.sell_to_store)}}));N(),v.innerHTML=`CREDITS: <a href="#" id="connect-credits">[CONNECT WALLET]</a>`,T(C,await k()),document.getElementById(`connect-credits`).addEventListener(`click`,async e=>{e.preventDefault(),await O(),T(C,await A())});function w(e){o.style.display=`block`,o.innerHTML+=`${e}<br>`}function T(e,t){h.innerHTML=`
        <div class="market-header">
            <span>ITEM</span>
            <span>AVAILABLE</span>
            <span>PRICE</span>
            <span>QTY</span>
            <span>TOTAL</span>
            <span></span>
        </div>

        ${e.map(e=>{let n=t.storeByType.get(e.itemId)?.quantity||0,r=t.characterByType.get(e.itemId)?.quantity||0,i=y===`buy`?n:r,a=y===`buy`?e.buyPrice:e.sellPrice,o=y===`buy`?`buy-link`:`sell-link`,s=y===`buy`?`[Buy]`:`[Sell]`;return`
                <div class="market-row">
                    <span>${e.name}</span>
                    <span>${i.toLocaleString()}</span>
                    <span>${a.toLocaleString()}</span>
                    
                    <input
                        id="qty-${e.itemId}"
                        data-item="${e.itemId}"
                        data-price="${a}"
                        class="qty-input"
                        type="number"
                        min="1"
                        max="${i}"
                        value="1"
                    />
                    
                    <span id="total-${e.itemId}">
                        ${a.toLocaleString()}
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
    `,y===`buy`?document.querySelectorAll(`.buy-link`).forEach(e=>e.addEventListener(`click`,E)):document.querySelectorAll(`.sell-link`).forEach(e=>e.addEventListener(`click`,D)),document.querySelectorAll(`.qty-input`).forEach(e=>{e.addEventListener(`input`,()=>{let t=Number(e.dataset.item),n=Number(e.dataset.price),r=Number(e.value||0);document.getElementById(`total-${t}`).textContent=(n*r).toLocaleString()})})}async function E(e){e.preventDefault(),o.innerHTML=``;let n=Number(e.target.dataset.item),r=Number(document.getElementById(`qty-${n}`).value);console.log(n,r);try{w(`CONNECTING TO WALLET...`);let{wallet:e,suiAccount:o}=await l(),u=o.address,d=await _(u);w(`DRIFTER IDENTIFIED: ${u.slice(0,8)}...`),w(`BUYING ${r}x ITEM ${n}...`);let f=new c;f.setSender(u),f.moveCall({target:`${a}::vylent_free_stuff::buy_item`,arguments:[f.object(i),f.object(d),f.object(t),f.pure.u64(n),f.pure.u32(r)]}),console.log(`buy tx json:`,await f.toJSON()),w(`SUBMITTING TRADE...`);let p=await s(e,o,f);console.log(`buy result:`,p),w(`TRADE COMPLETE.`),w(`TX: ${p.digest}`),await O(),T(C,await A())}catch(e){console.error(e),w(`ERROR: PURCHASE FAILED.`),w(e.message||`UNKNOWN FRONTIER FAILURE.`)}}async function D(e){e.preventDefault(),o.innerHTML=``;let n=Number(e.target.dataset.item),r=Number(document.getElementById(`qty-${n}`).value);try{w(`CONNECTING TO WALLET...`);let{wallet:e,suiAccount:o}=await l(),u=o.address,d=await _(u),f=await g(d);console.log(`ownerCapRef:`,f),w(`OWNER CAP: ${f.objectId.slice(0,10)}...`),w(`SELLING ${r}x ITEM ${n}...`);let p=new c;p.setSender(u),p.moveCall({target:`${a}::vylent_free_stuff::sell_item`,arguments:[p.object(i),p.object(d),p.receivingRef(f),p.object(t),p.pure.u64(n),p.pure.u32(r)]});let m=await s(e,o,p);w(`SALE COMPLETE.`),w(`TX: ${m.digest}`),await O(),T(C,await A())}catch(e){console.error(e),w(`ERROR: SALE FAILED.`),w(e.message||`UNKNOWN FRONTIER FAILURE.`)}}async function O(){let{wallet:e,suiAccount:t}=await l(),n=t.address;v.innerHTML=`CREDITS: ${await f(await _(n))}`}async function k(){let e=await d(i);return{storeByType:new Map(e.map(e=>[e.typeId,e])),characterByType:new Map}}async function A(){let{wallet:e,suiAccount:t}=await l(),n=t.address,r=await _(n),a=await d(i),o=await m(i,r);return{storeByType:new Map(a.map(e=>[e.typeId,e])),characterByType:new Map(o.map(e=>[e.typeId,e]))}}async function j(e){let t=await M(),n=String(e);return console.log(`TYPE INDEX LOADED?`,!!t),console.log(`LOOKUP KEY:`,n),console.log(`RAW ENTRY:`,t[n]),console.dir(t[n],{depth:null}),t[n]?.name||`ITEM ${e}`}async function M(){if(S)return S;let e=await fetch(x);if(!e.ok)throw Error(`Type index fetch failed: ${e.status}`);return S=await e.json(),S}function N(){document.getElementById(`buy-tab`).innerHTML=y===`buy`?`&gt;[Buy]&lt;`:`[Buy]`,document.getElementById(`sell-tab`).innerHTML=y===`sell`?`&gt;[Sell]&lt;`:`[Sell]`}})),y=o((async()=>{r(),e(),p(),n();var o=new URLSearchParams(window.location.search).get(`storage`),l=document.getElementById(`terminal-output`),u=document.getElementById(`claim-kit-button`);o||d(`ERROR: NO STORAGE UNIT SPECIFIED.`);function d(e){l.style.display=`block`,l.innerHTML+=`${e}<br>`}console.log(`loaded`),await h(o),u.addEventListener(`click`,async e=>{e.preventDefault(),l.innerHTML=``;try{d(`CONNECTING TO WALLET...`),d(`VERIFYING YOU ARE NOT A LEDGERMAN...`);let{wallet:e,suiAccount:n}=await i(),r=await _(n.address);d(`DRIFTER IDENTIFIED: ${n.address.slice(0,8)}...`);let l=new c,u=l.object(o),f=l.object(r),p=l.object(t);l.moveCall({target:`${a}::vylent_free_stuff::claim_free_item`,arguments:[u,f,p,l.object(`0x6`)]}),d(`DISPENSING FREE SHAME REDUCTION PACKAGE...`),console.log(`tx json:`,await l.toJSON());let m=await s(e,n,l);console.log(`claim result:`,m),console.log(`effects:`,m.effects),d(`PACKAGE DISPENSED.`),d(`TX: ${m.digest}`),d(`NOW GIT.`)}catch(e){console.error(e),d(`ERROR: DISPENSER JAMMED.`),d(e.message||`UNKNOWN FRONTIER FAILURE.`)}})}));v(),y();