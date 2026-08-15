// UnityGUI Desktop — renderer (free providers · Unity + Roblox · chats · enhance · auto-open)
const $ = (s) => document.querySelector(s);

let PROVIDERS = {}, ENGINES = {}, GENRES = {}, MODIFIERS = [];
let conversationId = null;   // null = new chat
let currentEngine = "unity";
let currentTurns = [];
let activeProvider = "gemini";
let assets = [];             // [{ name, mime, base64, dataUrl }] — reference images/sprites
const MAX_ASSETS = 4;
let allConvos = [];          // cached list for client-side search
let convoQuery = "";

function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),2200);}
function setStatus(el,m,err,busy){el.innerHTML=(busy?'<span class="spinner"></span>':"")+(m||"");el.classList.toggle("err",!!err);}
function esc(s){return String(s==null?"":s).replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));}
function fill(el,items,sel){el.innerHTML=items.map(v=>`<option value="${esc(v)}"${v===sel?" selected":""}>${esc(v)}</option>`).join("");}
function fillKV(el,obj,sel){el.innerHTML=Object.entries(obj).map(([k,v])=>`<option value="${esc(k)}"${k===sel?" selected":""}>${esc(v)}</option>`).join("");}

function currentProvider(){return $("#provider").value;}
function refreshConnectForm(){
  const p=PROVIDERS[currentProvider()]; if(!p)return;
  $("#key-block").classList.toggle("hidden",!p.needsKey);
  $("#ollama-help").classList.toggle("hidden",p.needsKey);
  $("#key-hint").textContent=p.keyHint||"";
  $("#get-key-btn").textContent=p.needsKey?"Get a free key →":"Install Ollama →";
  $("#use-ollama").classList.toggle("hidden",!p.needsKey); // only show the shortcut on key providers
  fill($("#c-model"),p.models,p.defaultModel);
}
async function checkOllama(){
  const s=$("#ollama-status"); s.classList.remove("err");
  s.innerHTML='<span class="spinner"></span>Checking Ollama…';
  const r=await window.api.ollamaStatus();
  if(!r.running){
    s.classList.add("err");
    s.innerHTML="Ollama isn't running. Install it from <b>ollama.com/download</b>, then run <code>ollama pull qwen2.5-coder</code> and click Check again.";
    return;
  }
  if(!r.models.length){
    s.innerHTML="Ollama is running ✓ but no models yet. Run <code>ollama pull qwen2.5-coder</code>, then Connect.";
  }else{
    fill($("#c-model"),r.models,r.models[0]);
    s.innerHTML="Ollama running ✓ — "+r.models.length+" model(s): "+esc(r.models.slice(0,4).join(", "))+". Unlimited & free — pick one and Connect.";
  }
}
function showConnected(connected,provider){
  const chip=$("#conn-chip");
  chip.classList.toggle("off",!connected);
  $("#conn-text").textContent=connected?("Connected · "+(PROVIDERS[provider]?PROVIDERS[provider].label.split("—")[0].trim():"")):"Not connected";
  $("#disconnect-btn").classList.toggle("hidden",!connected);
  $("#connect-view").classList.toggle("hidden",connected);
  $("#app-view").classList.toggle("hidden",!connected);
}

async function init(){
  const meta=await window.api.getProviders(); PROVIDERS=meta.providers; ENGINES=meta.engines; GENRES=meta.genres||{}; MODIFIERS=meta.modifiers||[];
  $("#provider").innerHTML=Object.entries(PROVIDERS).map(([id,p])=>`<option value="${id}">${esc(p.label)}</option>`).join("");
  fillKV($("#engine"),ENGINES,"unity");
  renderModifiers();

  const cfg=await window.api.getConfig();
  $("#provider").value=cfg.provider; activeProvider=cfg.provider;
  $("#engine").value=cfg.engine||"unity"; currentEngine=cfg.engine||"unity";
  $("#style").value=cfg.style||"auto";
  $("#length").value=String(cfg.maxTokens||20000);
  $("#auto-open").checked=cfg.autoOpen!==false;
  renderGenres();
  refreshConnectForm();
  if(cfg.model)$("#c-model").value=cfg.model;
  showConnected(cfg.connected,cfg.provider);

  // connect
  $("#provider").addEventListener("change",()=>{refreshConnectForm();window.api.saveConfig({provider:currentProvider()});});
  $("#get-key-btn").addEventListener("click",()=>window.api.openExternal(PROVIDERS[currentProvider()].keyUrl));
  $("#use-ollama").addEventListener("click",()=>{$("#provider").value="ollama";refreshConnectForm();window.api.saveConfig({provider:"ollama"});checkOllama();});
  $("#ollama-check").addEventListener("click",checkOllama);
  $("#connect-btn").addEventListener("click",onConnect);
  $("#key").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")onConnect();});
  $("#disconnect-btn").addEventListener("click",async()=>{await window.api.disconnect();showConnected(false);toast("Disconnected");});

  // app
  $("#engine").addEventListener("change",()=>{currentEngine=$("#engine").value;window.api.saveConfig({engine:currentEngine});renderGenres();});
  $("#style").addEventListener("change",()=>window.api.saveConfig({style:$("#style").value}));
  $("#length").addEventListener("change",()=>window.api.saveConfig({maxTokens:+$("#length").value}));
  $("#auto-open").addEventListener("change",()=>window.api.saveConfig({autoOpen:$("#auto-open").checked}));
  $("#new-chat").addEventListener("click",newChat);
  $("#library-btn").addEventListener("click",openLibrary);
  $("#library-close").addEventListener("click",()=>$("#library-modal").classList.add("hidden"));
  $("#library-modal").addEventListener("click",e=>{if(e.target.id==="library-modal")$("#library-modal").classList.add("hidden");});
  $("#settings-btn").addEventListener("click",openSettings);
  $("#settings-close").addEventListener("click",()=>$("#settings-modal").classList.add("hidden"));
  $("#settings-modal").addEventListener("click",e=>{if(e.target.id==="settings-modal")$("#settings-modal").classList.add("hidden");});
  $("#set-unity-btn").addEventListener("click",async()=>{const r=await window.api.pickUnityExe();if(r&&r.ok){toast("Unity path set ✓");openSettings();}});
  $("#enhance-btn").addEventListener("click",onEnhance);
  $("#attach-btn").addEventListener("click",onAttach);
  $("#art-btn").addEventListener("click",onArt);
  $("#convo-search").addEventListener("input",e=>{convoQuery=e.target.value;renderConvos();});
  $("#generate-btn").addEventListener("click",onGenerate);
  $("#prompt").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")onGenerate();});

  // global keyboard shortcuts
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){ const open=[...document.querySelectorAll(".modal:not(.hidden)")]; if(open.length){open.forEach(m=>m.classList.add("hidden"));e.preventDefault();} return; }
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey){
      const appVisible=!$("#app-view").classList.contains("hidden");
      const k=e.key.toLowerCase();
      if(k==="k"&&appVisible){ e.preventDefault(); $("#convo-search").focus(); }
      else if(k==="n"&&appVisible){ e.preventDefault(); newChat(); }
    }
  });

  if(cfg.connected){ await refreshConvos(); if(!currentTurns.length) newChat(); }
}

function readKeys(){ return $("#key").value.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean); }
async function onConnect(){
  const provider=currentProvider(),p=PROVIDERS[provider];
  const keys=p.needsKey?readKeys():[];
  const model=$("#c-model").value;
  if(p.needsKey&&!keys.length){setStatus($("#connect-status"),"Paste at least one free API key first.",true);return;}
  const btn=$("#connect-btn");btn.disabled=true;setStatus($("#connect-status"),"Checking…",false,true);
  await window.api.saveConfig({provider,apiKey:keys,model});
  const r=await window.api.testConnect({provider,apiKey:keys,model});
  btn.disabled=false;
  if(!r.ok){setStatus($("#connect-status"),r.error||"Could not connect.",true);return;}
  if(r.model&&r.model!==model){ await window.api.saveConfig({model:r.model}); } // auto-healed model
  setStatus($("#connect-status"),"");$("#key").value="";
  activeProvider=provider; showConnected(true,provider);
  if(keys.length>1) toast("Connected ✓ — "+keys.length+" keys will auto-rotate");
  else toast("Connected ✓");
  await refreshConvos(); newChat();
}

// ---- Prompt modifiers ("spice") --------------------------------------------
function renderModifiers(){
  const box=$("#modifiers"); if(!box)return;
  box.innerHTML=MODIFIERS.map((m,i)=>`<button class="chip-btn spice" data-i="${i}" title="${esc(m.text)}">${esc(m.icon||"✦")} ${esc(m.label)}</button>`).join("");
  box.querySelectorAll(".chip-btn").forEach(b=>b.addEventListener("click",()=>{
    const m=MODIFIERS[+b.dataset.i], t=$("#prompt");
    t.value=(t.value.trim()?t.value.trim()+" ":"")+m.text;
    t.focus();
  }));
}

// ---- Genre quick-starts ----------------------------------------------------
function renderGenres(){
  const list=(GENRES[currentEngine]||GENRES.unity||[]);
  const box=$("#genres"); if(!box)return;
  box.innerHTML=list.map((g,i)=>`<button class="chip-btn" data-i="${i}" title="${esc(g.prompt)}">${esc(g.icon||"🎮")} ${esc(g.label)}</button>`).join("");
  box.querySelectorAll(".chip-btn").forEach(b=>b.addEventListener("click",()=>{
    $("#prompt").value=list[+b.dataset.i].prompt; $("#prompt").focus();
  }));
}

// ---- Conversations ---------------------------------------------------------
async function refreshConvos(){
  allConvos=await window.api.listConvos();
  renderConvos();
}
function renderConvos(){
  const q=convoQuery.trim().toLowerCase();
  const filtered=q?allConvos.filter(c=>((c.title||"")+" "+(ENGINES[c.engine]||c.engine||"")).toLowerCase().includes(q)):allConvos;
  const list=filtered.slice().sort((a,b)=>(b.favorite?1:0)-(a.favorite?1:0)); // favorites first (stable)
  $("#convos").innerHTML=list.length?list.map(c=>`
    <div class="convo ${c.id===conversationId?"active":""}" data-id="${c.id}">
      <button class="convo-star ${c.favorite?"on":""}" data-star="${c.id}" title="Favorite">${c.favorite?"★":"☆"}</button>
      <div class="convo-main">
        <div class="convo-title">${esc(c.title||"Untitled")}</div>
        <div class="convo-meta">${ENGINES[c.engine]?esc(ENGINES[c.engine].split(" ")[0]):esc(c.engine)} · ${c.turns} msg</div>
      </div>
      <button class="convo-del" data-del="${c.id}" title="Delete">✕</button>
    </div>`).join(""):(q?`<div class="convo-empty">No chats match “${esc(convoQuery)}”.</div>`:`<div class="convo-empty">No chats yet. Start one below.</div>`);
  document.querySelectorAll("#convos .convo-star").forEach(b=>b.addEventListener("click",async e=>{
    e.stopPropagation(); const id=b.dataset.star, c=allConvos.find(x=>x.id===id), nv=!(c&&c.favorite);
    await window.api.favoriteConvo(id,nv); if(c)c.favorite=nv; renderConvos();
  }));
  document.querySelectorAll("#convos .convo").forEach(el=>el.addEventListener("click",e=>{
    if(e.target.dataset.del)return; selectConvo(el.dataset.id);
  }));
  document.querySelectorAll("#convos .convo-del").forEach(b=>b.addEventListener("click",async e=>{
    e.stopPropagation(); await window.api.deleteConvo(b.dataset.del);
    if(conversationId===b.dataset.del) newChat();
    refreshConvos();
  }));
  document.querySelectorAll("#convos .convo-title").forEach(t=>t.addEventListener("dblclick",e=>{
    e.stopPropagation(); startRename(t);
  }));
}

function startRename(titleEl){
  const id=titleEl.closest(".convo").dataset.id, old=titleEl.textContent;
  const inp=document.createElement("input"); inp.className="rename-input"; inp.value=old;
  titleEl.replaceWith(inp); inp.focus(); inp.select();
  const commit=async(save)=>{
    const v=inp.value.trim();
    if(save&&v&&v!==old) await window.api.renameConvo(id,v);
    refreshConvos();
  };
  inp.addEventListener("keydown",e=>{if(e.key==="Enter")commit(true);else if(e.key==="Escape")commit(false);});
  inp.addEventListener("blur",()=>commit(true));
}

// ---- Settings (keys + Unity path) ------------------------------------------
async function refreshConnState(){
  const cfg=await window.api.getConfig();
  activeProvider=cfg.provider; showConnected(cfg.connected,cfg.provider);
  if(cfg.connected){ await refreshConvos(); if(!currentTurns.length) newChat(); }
}
async function openSettings(){
  const s=await window.api.getSettings();
  $("#settings-modal").classList.remove("hidden");
  $("#set-unity-path").textContent = s.unityPath || s.unityDetected || "Not found — click Locate";
  $("#settings-providers").innerHTML=s.providers.map(p=>`
    <div class="set-row set-prov">
      <div class="set-main">
        <div class="set-name">${esc(p.label)} ${p.active?'<span class="pill">active</span>':''}</div>
        <div class="convo-meta">${p.needsKey?(p.keyCount+" key"+(p.keyCount===1?"":"s")+" saved"):"no key needed (local)"}</div>
        ${p.needsKey?`<textarea class="set-keys" data-id="${p.id}" rows="2" placeholder="paste key(s), one per line — replaces saved keys"></textarea>`:""}
      </div>
      <div class="set-actions">
        ${p.needsKey?`<button class="btn btn-ghost set-save" data-id="${p.id}">Save keys</button>`:""}
        ${!p.active?`<button class="btn btn-ghost set-active" data-id="${p.id}">Use</button>`:""}
        ${p.keyUrl?`<button class="link set-getkey" data-url="${esc(p.keyUrl)}">Get key →</button>`:""}
      </div>
    </div>`).join("");
  const box=$("#settings-providers");
  box.querySelectorAll(".set-save").forEach(b=>b.addEventListener("click",async()=>{
    const ta=box.querySelector('.set-keys[data-id="'+b.dataset.id+'"]');
    const r=await window.api.setKeys({provider:b.dataset.id,keys:ta.value});
    if(r&&r.ok){toast("Saved "+r.keyCount+" key(s) ✓");await refreshConnState();openSettings();}
    else toast((r&&r.error)||"Couldn't save");
  }));
  box.querySelectorAll(".set-active").forEach(b=>b.addEventListener("click",async()=>{
    await window.api.setKeys({provider:b.dataset.id,makeActive:true});
    toast("Active provider changed ✓");await refreshConnState();openSettings();
  }));
  box.querySelectorAll(".set-getkey").forEach(b=>b.addEventListener("click",()=>window.api.openExternal(b.dataset.url)));
}

// ---- Project library -------------------------------------------------------
async function openLibrary(){
  const modal=$("#library-modal"), listEl=$("#library-list");
  modal.classList.remove("hidden");
  listEl.innerHTML='<div class="convo-empty">Loading…</div>';
  const items=await window.api.listProjects();
  $("#library-sub").textContent=items.length
    ? items.length+" saved project"+(items.length>1?"s":"")+" · in Documents ▸ UnityGUI Games"
    : "No projects yet — generate a game and it'll appear here.";
  if(!items.length){listEl.innerHTML='<div class="convo-empty">Nothing saved yet.</div>';return;}
  listEl.innerHTML=items.map((p,i)=>{
    const eng=ENGINES[p.engine]?ENGINES[p.engine].split(" ")[0]:p.engine;
    const openLbl=p.engine==="web"?"▶ Play":"▶ Open";
    const thumb=p.thumb?`<img class="lib-thumb" src="${p.thumb}" alt="" />`:`<div class="lib-thumb placeholder">${p.engine==="web"?"🌐":p.engine==="roblox"?"🧱":"🎮"}</div>`;
    return `<div class="lib-row">
      ${thumb}
      <div class="lib-main"><div class="lib-name">${esc(p.name)}</div><div class="convo-meta">${esc(eng)}</div></div>
      <div class="lib-actions">
        <button class="btn btn-ghost lib-open" data-i="${i}">${openLbl}</button>
        <button class="btn btn-ghost lib-folder" data-i="${i}" title="Reveal in folder">📂</button>
        <button class="btn btn-ghost lib-zip" data-i="${i}" title="Export as .zip">📦</button>
      </div>
    </div>`;
  }).join("");
  listEl.querySelectorAll(".lib-open").forEach(b=>b.addEventListener("click",()=>{
    const p=items[+b.dataset.i];
    if(p.engine==="web") window.api.previewGame(p.openTarget); else window.api.openPath(p.openTarget);
  }));
  listEl.querySelectorAll(".lib-folder").forEach(b=>b.addEventListener("click",()=>window.api.revealPath(items[+b.dataset.i].openTarget)));
  listEl.querySelectorAll(".lib-zip").forEach(b=>b.addEventListener("click",async()=>{
    const r=await window.api.zipDir(items[+b.dataset.i].path);
    if(r&&r.ok){toast("Zipped ✓");window.api.revealPath(r.zipPath);}else toast((r&&r.error)||"Zip failed");
  }));
}

function newChat(){
  conversationId=null; currentTurns=[]; clearAssets();
  $("#turns").innerHTML=`<div class="turns-empty"><div class="art">🎮</div><h2>New chat</h2><p>Pick an engine, tap a genre or describe a game, then press Generate. Keep chatting to refine it.</p></div>`;
  $("#engine").disabled=false;
  $("#prompt").value=""; $("#prompt").placeholder="Describe your game…"; $("#prompt").focus();
  setStatus($("#gen-status"),"");
  document.querySelectorAll("#convos .convo").forEach(el=>el.classList.remove("active"));
}

async function selectConvo(id){
  const c=await window.api.getConvo(id); if(!c)return;
  conversationId=id; currentEngine=c.engine; currentTurns=c.turns;
  $("#engine").value=c.engine; $("#engine").disabled=true; renderGenres();
  $("#prompt").placeholder="Ask for a change… (e.g. make it faster, add enemies)";
  renderTurns();
  refreshConvos();
}

function renderTurns(){
  const box=$("#turns");
  if(!currentTurns.length){newChat();return;}
  box.innerHTML=currentTurns.map((t,i)=>turnHtml(t,i,i===currentTurns.length-1)).join("");
  // wire per-turn actions
  const last=currentTurns[currentTurns.length-1];
  const openBtn=box.querySelector("#open-btn"), saveBtn=box.querySelector("#save-btn"), regenBtn=box.querySelector("#regen-btn"), zipBtn=box.querySelector("#zip-btn"), previewBtn=box.querySelector("#preview-btn"), htmlBtn=box.querySelector("#html-btn");
  if(openBtn) openBtn.addEventListener("click",()=>openInEngine(last));
  if(htmlBtn) htmlBtn.addEventListener("click",()=>onStandalone(last));
  const checkBtn=box.querySelector("#check-btn");
  if(checkBtn) checkBtn.addEventListener("click",()=>onCheckFix(last));
  if(previewBtn) previewBtn.addEventListener("click",async()=>{
    if(!last._openTarget){toast("Generate first");return;}
    const r=await window.api.previewGame(last._openTarget);
    if(r&&!r.ok) toast(r.error||"Couldn't open preview");
  });
  if(saveBtn) saveBtn.addEventListener("click",()=>onSave(last.result));
  if(zipBtn) zipBtn.addEventListener("click",()=>onShareZip(last.result));
  if(regenBtn) regenBtn.addEventListener("click",onRegenerate);
  // copy buttons — read the <pre> directly (handles quotes/newlines safely)
  box.querySelectorAll(".file .copy").forEach(b=>b.addEventListener("click",()=>{
    const pre=b.closest(".file").querySelector(".code");
    navigator.clipboard.writeText(pre.textContent).then(()=>toast("Copied ✓"));
  }));
  // inline code editor (web games)
  box.querySelectorAll(".file .edit-file").forEach(b=>b.addEventListener("click",e=>{
    e.preventDefault(); const det=b.closest(".file"); det.open=true;
    det.querySelector(".code").classList.add("hidden");
    det.querySelector(".code-editor").classList.remove("hidden");
    det.querySelector(".code-edit").focus();
  }));
  box.querySelectorAll(".file .cancel-edit").forEach(b=>b.addEventListener("click",()=>{
    const det=b.closest(".file");
    det.querySelector(".code-edit").value=det.querySelector(".code").textContent;
    det.querySelector(".code-editor").classList.add("hidden");
    det.querySelector(".code").classList.remove("hidden");
  }));
  box.querySelectorAll(".file .save-file").forEach(b=>b.addEventListener("click",()=>onSaveFile(last,+b.dataset.fi,b.closest(".file"))));
  box.scrollTop=box.scrollHeight;
}

function fileBlock(f,i,editable,engine){
  const name=f.path||f.name||"file";
  const kind=f.kind?` <em>(${esc(f.kind)})</em>`:"";
  const code=f.content||"";
  const saveLabel=engine==="web"?"💾 Save &amp; re-run":"💾 Save";
  return `<details class="file" data-fi="${i}">
    <summary><span class="fname">${esc(name)}</span>${kind}
      ${editable?`<button class="edit-file" data-fi="${i}" title="Edit code">✏️</button>`:""}
      <button class="copy" title="Copy">⧉</button></summary>
    <pre class="code">${esc(code)}</pre>
    ${editable?`<div class="code-editor hidden"><textarea class="code-edit" spellcheck="false">${esc(code)}</textarea><div class="editor-actions"><button class="btn btn-primary save-file" data-fi="${i}">${saveLabel}</button><button class="btn btn-ghost cancel-edit">Cancel</button></div></div>`:""}
  </details>`;
}

function turnHtml(t,idx,isLast){
  const d=t.result||{};
  const editable=isLast&&(d.engine==="web"||d.engine==="unity")&&!!t._root;
  const files=(d.files||[]).map((f,i)=>fileBlock(f,i,editable,d.engine)).join("");
  const engineName=ENGINES[d.engine]||"";
  return `
  <div class="turn">
    <div class="bubble user">${esc(t.prompt)}</div>
    <div class="bubble ai">
      ${t._thumb?`<img class="turn-thumb" src="${t._thumb}" alt="preview" />`:""}
      <div class="res-title">${esc(d.game_name||"Game")} <span class="pill">${esc(engineName.split(" ")[0])}</span></div>
      <div class="res-sum">${esc(d.summary||"")}</div>
      ${d.setup_notes?`<div class="notes">${esc(d.setup_notes)}</div>`:""}
      <div class="files">${files}</div>
      ${isLast?`<div class="actions">
        ${d.engine==="web"?`<button class="btn btn-ember" id="preview-btn">▶ Play preview</button>`:`<button class="btn btn-ember" id="open-btn">▶ Open in ${esc((engineName||"engine").split(" ")[0])}</button>`}
        <button class="btn btn-ghost" id="save-btn">💾 Save to…</button>
        <button class="btn btn-ghost" id="zip-btn" title="Export the whole project as a shareable .zip">📦 Share .zip</button>
        ${d.engine==="web"?`<button class="btn btn-ghost" id="check-btn" title="Run the game and auto-fix any runtime errors">🔧 Check &amp; fix</button>`:""}
        ${d.engine==="web"?`<button class="btn btn-ghost" id="html-btn" title="Export one self-contained .html (itch.io-ready)">📄 Single .html</button>`:""}
        <button class="btn btn-ghost" id="regen-btn" title="Regenerate this from the same prompt">🔁 Regenerate</button>
      </div>`:""}
    </div>
  </div>`;
}

// ---- Reference assets (multiple named images / sprites) --------------------
function defaultAssetName(){ return "asset"+(assets.length+1); }
function addAsset(a){
  if(assets.length>=MAX_ASSETS){toast("Up to "+MAX_ASSETS+" assets");return;}
  assets.push({name:a.name||defaultAssetName(),mime:a.mime,base64:a.base64,dataUrl:a.dataUrl});
  renderAssets();
}
function clearAssets(){ assets=[]; renderAssets(); }
function renderAssets(){
  const box=$("#assets"); if(!box)return;
  box.innerHTML=assets.map((a,i)=>`
    <div class="asset-chip" data-i="${i}">
      <img src="${a.dataUrl}" alt="" />
      <span class="asset-name" title="Double-click to rename">${esc(a.name)}</span>
      <button class="asset-del" data-i="${i}" title="Remove">✕</button>
    </div>`).join("");
  box.querySelectorAll(".asset-del").forEach(b=>b.addEventListener("click",()=>{ assets.splice(+b.dataset.i,1); renderAssets(); }));
  box.querySelectorAll(".asset-name").forEach(s=>s.addEventListener("dblclick",()=>renameAsset(s)));
}
function renameAsset(span){
  const i=+span.closest(".asset-chip").dataset.i, old=assets[i].name;
  const inp=document.createElement("input"); inp.className="asset-rename"; inp.value=old;
  span.replaceWith(inp); inp.focus(); inp.select();
  const commit=(save)=>{ const v=inp.value.trim().replace(/[^\w\-]+/g,""); if(save&&v)assets[i].name=v; renderAssets(); };
  inp.addEventListener("keydown",e=>{if(e.key==="Enter")commit(true);else if(e.key==="Escape")commit(false);});
  inp.addEventListener("blur",()=>commit(true));
}
async function onAttach(){
  const img=await window.api.pickImage();
  if(!img)return;
  if(img.error){toast(img.error);return;}
  addAsset({name:defaultAssetName(),mime:img.mime,base64:img.base64,dataUrl:img.dataUrl});
  toast("Image added ✓ — double-click its name to label it (e.g. player, enemy).");
}
async function onArt(){
  const p=$("#prompt").value.trim();
  if(!p){setStatus($("#gen-status"),"Type what art (or your game idea) you want first.",true);return;}
  const btn=$("#art-btn");btn.disabled=true;
  setStatus($("#gen-status"),"Generating free AI art…",false,true);
  const r=await window.api.generateArt({prompt:p});
  btn.disabled=false;
  if(!r||!r.ok){setStatus($("#gen-status"),(r&&r.error)||"Couldn't generate art.",true);return;}
  addAsset({name:defaultAssetName(),mime:r.mime,base64:r.base64,dataUrl:r.dataUrl});
  setStatus($("#gen-status"),"AI art added ✓ — add more or press Generate.",false);
  toast("AI art added ✓");
}

// ---- Open a finished project in its engine ---------------------------------
async function openInEngine(t){
  const eng=t&&t.result&&t.result.engine;
  if(!t||!t._openTarget){toast("Generate first");return;}
  if(eng==="unity"){
    const r=await window.api.openUnity(t._openTarget);
    if(r&&r.ok){toast("Opening in Unity ✓");return;}
    if(r&&r.needsUnity){
      if(confirm("Unity Editor wasn't found automatically.\n\nLocate your Unity.exe now? (one time)")){
        const pick=await window.api.pickUnityExe();
        if(pick&&pick.ok){ const r2=await window.api.openUnity(t._openTarget); if(r2&&r2.ok){toast("Opening in Unity ✓");return;} }
      }
      window.api.revealPath(t._openTarget); // fallback: show the folder
      return;
    }
    toast((r&&r.error)||"Couldn't open Unity");
  } else if(eng==="web"){
    window.api.previewGame(t._openTarget);
  } else {
    window.api.openPath(t._openTarget);
  }
}

// ---- Enhance / Generate / Regenerate ---------------------------------------
async function onEnhance(){
  const idea=$("#prompt").value.trim();
  if(!idea){setStatus($("#gen-status"),"Type an idea to enhance first.",true);return;}
  const btn=$("#enhance-btn");btn.disabled=true;
  setStatus($("#gen-status"),"Enhancing your idea…",false,true);
  const r=await window.api.enhancePrompt(idea,currentEngine);
  btn.disabled=false;
  if(!r.ok){setStatus($("#gen-status"),r.error||"Could not enhance.",true);return;}
  $("#prompt").value=r.text; setStatus($("#gen-status"),"Enhanced ✓ — review and Generate.",false);
  toast("Enhanced ✓");
}

async function runGenerate(payload,busyMsg){
  const btn=$("#generate-btn");btn.disabled=true;
  setStatus($("#gen-status"),busyMsg,false,true);
  const r=await window.api.generate(payload);
  btn.disabled=false;
  if(!r.ok){setStatus($("#gen-status"),r.error||"Generation failed.",true);return null;}
  setStatus($("#gen-status"),"");
  conversationId=r.conversationId;
  const c=await window.api.getConvo(conversationId); currentTurns=c?c.turns:currentTurns;
  const last=currentTurns[currentTurns.length-1];
  if(last&&r.saved&&r.saved.openTarget){last._openTarget=r.saved.openTarget;}
  if(last&&r.saved&&r.saved.root){last._root=r.saved.root;}
  if(last&&r.saved&&r.saved.thumb){last._thumb=r.saved.thumb;}
  $("#engine").disabled=true;
  $("#prompt").value=""; $("#prompt").placeholder="Ask for a change… (e.g. make it faster, add enemies)";
  renderTurns();
  await refreshConvos();
  // Reflect an automatic provider switch (a key/provider ran out → fell back).
  let switched="";
  if(r.usedProvider&&r.usedProvider!==activeProvider){
    const name=PROVIDERS[r.usedProvider]?PROVIDERS[r.usedProvider].label.split("—")[0].trim():r.usedProvider;
    activeProvider=r.usedProvider; showConnected(true,r.usedProvider);
    switched=" (switched to "+name+")"; toast("Switched to "+name+" ✓");
  }
  if(r.saved&&r.saved.launched==="unity"){ if(!switched)toast("Opening in Unity ✓"); setStatus($("#gen-status"),"Opening the project in Unity…"+switched,false); }
  else if(r.saved&&r.saved.needsUnity){ setStatus($("#gen-status"),"Generated. Unity wasn't found — click ▶ Open in Unity to locate it (one time).",true); }
  else if(r.saved&&r.saved.openTarget){ if(!switched)toast("Generated & opened ✓"); setStatus($("#gen-status"),"Saved & opened: "+r.saved.openTarget+switched,false); }
  else if(r.saved&&r.saved.error){ setStatus($("#gen-status"),"Generated. Auto-open failed: "+r.saved.error,true); }
  else if(!switched){ toast("Generated ✓"); }
  return r;
}

async function onGenerate(){
  const prompt=$("#prompt").value.trim();
  if(!prompt){setStatus($("#gen-status"),"Describe your game (or a change) first.",true);return;}
  const images=assets.map(a=>({name:a.name,mime:a.mime,base64:a.base64}));
  const r=await runGenerate({prompt,conversationId,images},conversationId?"Refining…":"Generating — this can take a minute…");
  if(r&&r.ok) clearAssets();
}

async function onRegenerate(){
  if(!conversationId)return;
  await runGenerate({conversationId,regenerate:true},"Regenerating…");
}

async function onSave(data){
  const dir=await window.api.pickFolder(); if(!dir)return;
  setStatus($("#gen-status"),"Saving…",false,true);
  const r=await window.api.saveProject({engine:data.engine||currentEngine,data,dir});
  if(!r.ok){setStatus($("#gen-status"),r.error||"Could not save.",true);return;}
  setStatus($("#gen-status"),"Saved: "+r.path,false);
  if(confirm("Saved to:\n"+r.path+"\n\nOpen it now?")) window.api.openPath(r.openTarget||r.path);
}

async function onSaveFile(t,i,det){
  if(!t||!t.result||!t.result.files[i]){toast("Nothing to save");return;}
  const f=t.result.files[i];
  const content=det.querySelector(".code-edit").value;
  const r=await window.api.saveFile({root:t._root,engine:t.result.engine,file:{path:f.path,name:f.name,kind:f.kind},content});
  if(!r||!r.ok){toast((r&&r.error)||"Save failed");return;}
  f.content=content; det.querySelector(".code").textContent=content;
  det.querySelector(".code-editor").classList.add("hidden");
  det.querySelector(".code").classList.remove("hidden");
  if(t.result.engine==="web"&&t._openTarget){ window.api.previewGame(t._openTarget); setStatus($("#gen-status"),"Saved & re-launched preview ✓",false); toast("Saved ✓"); }
  else { toast("Saved ✓ — Unity recompiles when you focus it"); setStatus($("#gen-status"),"Saved to the Unity project ✓",false); }
}

async function onCheckFix(t){
  if(!t||!t._openTarget){toast("Generate first");return;}
  const btn=document.querySelector("#check-btn"); if(btn)btn.disabled=true;
  setStatus($("#gen-status"),"Running the game and checking for errors…",false,true);
  const r=await window.api.checkWeb(t._openTarget);
  if(btn)btn.disabled=false;
  if(!r||!r.ok){setStatus($("#gen-status"),(r&&r.error)||"Couldn't run the check.",true);return;}
  if(!r.errors.length){setStatus($("#gen-status"),"No runtime errors found ✓",false);toast("No errors ✓");return;}
  setStatus($("#gen-status"),"Found "+r.errors.length+" runtime error(s).",true);
  if(confirm("Found "+r.errors.length+" runtime error(s):\n\n"+r.errors.slice(0,5).join("\n")+"\n\nLet the AI auto-fix them?")){
    const g=await runGenerate({conversationId,fixErrors:r.errors},"Auto-fixing runtime errors…");
    if(g&&g.ok){ const t2=currentTurns[currentTurns.length-1]; setStatus($("#gen-status"),"Fixed & re-generated ✓ — click 🔧 Check & fix again to verify.",false); }
  }
}

async function onStandalone(t){
  const root=t&&t._root; if(!root){toast("Generate first");return;}
  setStatus($("#gen-status"),"Building single .html…",false,true);
  const r=await window.api.standaloneHtml(root);
  if(!r.ok){setStatus($("#gen-status"),r.error||"Couldn't build the file.",true);return;}
  setStatus($("#gen-status"),"Single-file game saved: "+r.path,false);
  toast("Single .html ready ✓ (share it anywhere / upload to itch.io)");
  window.api.revealPath(r.path);
}

async function onShareZip(data){
  setStatus($("#gen-status"),"Packaging .zip…",false,true);
  const r=await window.api.zipProject({engine:data.engine||currentEngine,data});
  if(!r.ok){setStatus($("#gen-status"),r.error||"Could not create the zip.",true);return;}
  setStatus($("#gen-status"),"Zipped: "+r.zipPath,false);
  toast("Zipped ✓ — sharing folder opened");
  window.api.revealPath(r.zipPath);
}

window.addEventListener("DOMContentLoaded",init);
