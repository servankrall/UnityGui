// UnityGUI Desktop — renderer (free providers · Unity + Roblox · chats · enhance · auto-open)
const $ = (s) => document.querySelector(s);

let PROVIDERS = {}, ENGINES = {}, GENRES = {}, MODIFIERS = [];
let conversationId = null;   // null = new chat
let currentEngine = "unity";
let currentTurns = [];
let activeProvider = "gemini";

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
  $("#length").value=String(cfg.maxTokens||16000);
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
  $("#enhance-btn").addEventListener("click",onEnhance);
  $("#generate-btn").addEventListener("click",onGenerate);
  $("#prompt").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")onGenerate();});

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
  const list=await window.api.listConvos();
  $("#convos").innerHTML=list.length?list.map(c=>`
    <div class="convo ${c.id===conversationId?"active":""}" data-id="${c.id}">
      <div class="convo-main">
        <div class="convo-title">${esc(c.title||"Untitled")}</div>
        <div class="convo-meta">${ENGINES[c.engine]?esc(ENGINES[c.engine].split(" ")[0]):esc(c.engine)} · ${c.turns} msg</div>
      </div>
      <button class="convo-del" data-del="${c.id}" title="Delete">✕</button>
    </div>`).join(""):`<div class="convo-empty">No chats yet. Start one below.</div>`;
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
  conversationId=null; currentTurns=[];
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
  const openBtn=box.querySelector("#open-btn"), saveBtn=box.querySelector("#save-btn"), regenBtn=box.querySelector("#regen-btn"), zipBtn=box.querySelector("#zip-btn"), previewBtn=box.querySelector("#preview-btn");
  if(openBtn) openBtn.addEventListener("click",()=>{ if(last._openTarget) window.api.openPath(last._openTarget); });
  if(previewBtn) previewBtn.addEventListener("click",async()=>{
    if(!last._openTarget){toast("Generate first");return;}
    const r=await window.api.previewGame(last._openTarget);
    if(r&&!r.ok) toast(r.error||"Couldn't open preview");
  });
  if(saveBtn) saveBtn.addEventListener("click",()=>onSave(last.result));
  if(zipBtn) zipBtn.addEventListener("click",()=>onShareZip(last.result));
  if(regenBtn) regenBtn.addEventListener("click",onRegenerate);
  // copy buttons for code files
  box.querySelectorAll("[data-copy]").forEach(b=>b.addEventListener("click",()=>{
    navigator.clipboard.writeText(b.getAttribute("data-copy")).then(()=>toast("Copied ✓"));
  }));
  box.scrollTop=box.scrollHeight;
}

function fileBlock(f){
  const name=f.path||f.name||"file";
  const kind=f.kind?` <em>(${esc(f.kind)})</em>`:"";
  const code=f.content||"";
  return `<details class="file"><summary><span class="fname">${esc(name)}</span>${kind}<button class="copy" data-copy="${esc(code)}" title="Copy">⧉</button></summary><pre class="code">${esc(code)}</pre></details>`;
}

function turnHtml(t,idx,isLast){
  const d=t.result||{};
  const files=(d.files||[]).map(fileBlock).join("");
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
        <button class="btn btn-ghost" id="regen-btn" title="Regenerate this from the same prompt">🔁 Regenerate</button>
      </div>`:""}
    </div>
  </div>`;
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
  if(r.saved&&r.saved.openTarget){ if(!switched)toast("Generated & opened ✓"); setStatus($("#gen-status"),"Saved & opened: "+r.saved.openTarget+switched,false); }
  else if(r.saved&&r.saved.error){ setStatus($("#gen-status"),"Generated. Auto-open failed: "+r.saved.error,true); }
  else if(!switched){ toast("Generated ✓"); }
  return r;
}

async function onGenerate(){
  const prompt=$("#prompt").value.trim();
  if(!prompt){setStatus($("#gen-status"),"Describe your game (or a change) first.",true);return;}
  await runGenerate({prompt,conversationId},conversationId?"Refining…":"Generating — this can take a minute…");
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

async function onShareZip(data){
  setStatus($("#gen-status"),"Packaging .zip…",false,true);
  const r=await window.api.zipProject({engine:data.engine||currentEngine,data});
  if(!r.ok){setStatus($("#gen-status"),r.error||"Could not create the zip.",true);return;}
  setStatus($("#gen-status"),"Zipped: "+r.zipPath,false);
  toast("Zipped ✓ — sharing folder opened");
  window.api.revealPath(r.zipPath);
}

window.addEventListener("DOMContentLoaded",init);
