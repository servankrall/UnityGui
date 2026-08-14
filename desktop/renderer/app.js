// UnityGUI Desktop — renderer (free providers · Unity + Roblox · chats · enhance · auto-open)
const $ = (s) => document.querySelector(s);

let PROVIDERS = {}, ENGINES = {}, GENRES = {};
let conversationId = null;   // null = new chat
let currentEngine = "unity";
let currentTurns = [];

function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),2200);}
function setStatus(el,m,err,busy){el.innerHTML=(busy?'<span class="spinner"></span>':"")+(m||"");el.classList.toggle("err",!!err);}
function esc(s){return String(s==null?"":s).replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));}
function fill(el,items,sel){el.innerHTML=items.map(v=>`<option value="${esc(v)}"${v===sel?" selected":""}>${esc(v)}</option>`).join("");}
function fillKV(el,obj,sel){el.innerHTML=Object.entries(obj).map(([k,v])=>`<option value="${esc(k)}"${k===sel?" selected":""}>${esc(v)}</option>`).join("");}

function currentProvider(){return $("#provider").value;}
function refreshConnectForm(){
  const p=PROVIDERS[currentProvider()]; if(!p)return;
  $("#key-block").classList.toggle("hidden",!p.needsKey);
  $("#key-hint").textContent=p.keyHint||"";
  $("#get-key-btn").textContent=p.needsKey?"Get a free key →":"Install Ollama →";
  fill($("#c-model"),p.models,p.defaultModel);
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
  const meta=await window.api.getProviders(); PROVIDERS=meta.providers; ENGINES=meta.engines; GENRES=meta.genres||{};
  $("#provider").innerHTML=Object.entries(PROVIDERS).map(([id,p])=>`<option value="${id}">${esc(p.label)}</option>`).join("");
  fillKV($("#engine"),ENGINES,"unity");

  const cfg=await window.api.getConfig();
  $("#provider").value=cfg.provider;
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
  $("#connect-btn").addEventListener("click",onConnect);
  $("#key").addEventListener("keydown",e=>{if(e.key==="Enter")onConnect();});
  $("#disconnect-btn").addEventListener("click",async()=>{await window.api.disconnect();showConnected(false);toast("Disconnected");});

  // app
  $("#engine").addEventListener("change",()=>{currentEngine=$("#engine").value;window.api.saveConfig({engine:currentEngine});renderGenres();});
  $("#style").addEventListener("change",()=>window.api.saveConfig({style:$("#style").value}));
  $("#length").addEventListener("change",()=>window.api.saveConfig({maxTokens:+$("#length").value}));
  $("#auto-open").addEventListener("change",()=>window.api.saveConfig({autoOpen:$("#auto-open").checked}));
  $("#new-chat").addEventListener("click",newChat);
  $("#enhance-btn").addEventListener("click",onEnhance);
  $("#generate-btn").addEventListener("click",onGenerate);
  $("#prompt").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")onGenerate();});

  if(cfg.connected){ await refreshConvos(); if(!currentTurns.length) newChat(); }
}

async function onConnect(){
  const provider=currentProvider(),p=PROVIDERS[provider];
  const key=p.needsKey?$("#key").value.trim():"";
  const model=$("#c-model").value;
  if(p.needsKey&&!key){setStatus($("#connect-status"),"Paste your free API key first.",true);return;}
  const btn=$("#connect-btn");btn.disabled=true;setStatus($("#connect-status"),"Checking…",false,true);
  await window.api.saveConfig({provider,apiKey:key,model});
  const r=await window.api.testConnect({provider,apiKey:key,model});
  btn.disabled=false;
  if(!r.ok){setStatus($("#connect-status"),r.error||"Could not connect.",true);return;}
  if(r.model&&r.model!==model){ await window.api.saveConfig({model:r.model}); } // auto-healed model
  setStatus($("#connect-status"),"");$("#key").value="";
  showConnected(true,provider);
  await refreshConvos(); newChat();
  toast("Connected ✓");
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
  const openBtn=box.querySelector("#open-btn"), saveBtn=box.querySelector("#save-btn"), regenBtn=box.querySelector("#regen-btn");
  if(openBtn) openBtn.addEventListener("click",()=>{ if(last._openTarget) window.api.openPath(last._openTarget); });
  if(saveBtn) saveBtn.addEventListener("click",()=>onSave(last.result));
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
      <div class="res-title">${esc(d.game_name||"Game")} <span class="pill">${esc(engineName.split(" ")[0])}</span></div>
      <div class="res-sum">${esc(d.summary||"")}</div>
      ${d.setup_notes?`<div class="notes">${esc(d.setup_notes)}</div>`:""}
      <div class="files">${files}</div>
      ${isLast?`<div class="actions">
        <button class="btn btn-ember" id="open-btn">▶ Open in ${esc((engineName||"engine").split(" ")[0])}</button>
        <button class="btn btn-ghost" id="save-btn">💾 Save to…</button>
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
  $("#engine").disabled=true;
  $("#prompt").value=""; $("#prompt").placeholder="Ask for a change… (e.g. make it faster, add enemies)";
  renderTurns();
  await refreshConvos();
  if(r.saved&&r.saved.openTarget){ toast("Generated & opened ✓"); setStatus($("#gen-status"),"Saved & opened: "+r.saved.openTarget,false); }
  else if(r.saved&&r.saved.error){ setStatus($("#gen-status"),"Generated. Auto-open failed: "+r.saved.error,true); }
  else { toast("Generated ✓"); }
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

window.addEventListener("DOMContentLoaded",init);
