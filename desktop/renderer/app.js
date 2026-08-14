// UnityGUI Desktop — renderer (free providers · Unity + Roblox · chats · auto-open)
const $ = (s) => document.querySelector(s);

const IDEAS = [
  "A 2D endless runner where a cube jumps over obstacles. Space to jump, score for distance.",
  "A top-down shooter: WASD to move, click to shoot enemies. Health and score.",
  "A first-person maze: find the glowing exit before the timer ends.",
  "A brick-breaker: bounce the ball to clear all bricks, lives counter.",
  "An obby: jump across floating platforms to reach the goal without falling.",
];

let PROVIDERS = {}, ENGINES = {};
let conversationId = null;   // null = new chat
let currentEngine = "unity";
let currentTurns = [];

function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),2200);}
function setStatus(el,m,err,busy){el.innerHTML=(busy?'<span class="spinner"></span>':"")+(m||"");el.classList.toggle("err",!!err);}
function esc(s){return String(s).replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));}
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
  const meta=await window.api.getProviders(); PROVIDERS=meta.providers; ENGINES=meta.engines;
  $("#provider").innerHTML=Object.entries(PROVIDERS).map(([id,p])=>`<option value="${id}">${esc(p.label)}</option>`).join("");
  fillKV($("#engine"),ENGINES,"unity");
  $("#ideas").innerHTML=IDEAS.map((p,i)=>`<button class="chip-btn" data-i="${i}">${esc(p.slice(0,34))}…</button>`).join("");
  document.querySelectorAll("#ideas .chip-btn").forEach(b=>b.addEventListener("click",()=>{$("#prompt").value=IDEAS[+b.dataset.i];$("#prompt").focus();}));

  const cfg=await window.api.getConfig();
  $("#provider").value=cfg.provider;
  $("#engine").value=cfg.engine||"unity"; currentEngine=cfg.engine||"unity";
  $("#style").value=cfg.style||"auto";
  $("#auto-open").checked=cfg.autoOpen!==false;
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
  $("#engine").addEventListener("change",()=>{currentEngine=$("#engine").value;window.api.saveConfig({engine:currentEngine});});
  $("#style").addEventListener("change",()=>window.api.saveConfig({style:$("#style").value}));
  $("#auto-open").addEventListener("change",()=>window.api.saveConfig({autoOpen:$("#auto-open").checked}));
  $("#new-chat").addEventListener("click",newChat);
  $("#generate-btn").addEventListener("click",onGenerate);
  $("#prompt").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")onGenerate();});

  if(cfg.connected) await refreshConvos();
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
  setStatus($("#connect-status"),"");$("#key").value="";
  showConnected(true,provider);
  await refreshConvos();
  toast("Connected ✓");
}

// ---- Conversations ---------------------------------------------------------
async function refreshConvos(){
  const list=await window.api.listConvos();
  $("#convos").innerHTML=list.length?list.map(c=>`
    <div class="convo ${c.id===conversationId?"active":""}" data-id="${c.id}">
      <div class="convo-main">
        <div class="convo-title">${esc(c.title||"Untitled")}</div>
        <div class="convo-meta">${ENGINES[c.engine]?ENGINES[c.engine].split(" ")[0]:c.engine} · ${c.turns} msg</div>
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
}

function newChat(){
  conversationId=null; currentTurns=[];
  $("#turns").innerHTML=`<div class="turns-empty"><div class="art">🎮</div><h2>New chat</h2><p>Pick an engine, describe a game, and press Generate. Continue chatting to refine it.</p></div>`;
  $("#engine").disabled=false;
  $("#prompt").value=""; $("#prompt").placeholder="Describe your game…"; $("#prompt").focus();
  setStatus($("#gen-status"),"");
  document.querySelectorAll("#convos .convo").forEach(el=>el.classList.remove("active"));
}

async function selectConvo(id){
  const c=await window.api.getConvo(id); if(!c)return;
  conversationId=id; currentEngine=c.engine; currentTurns=c.turns;
  $("#engine").value=c.engine; $("#engine").disabled=true;
  $("#prompt").placeholder="Ask for a change… (e.g. make it faster, add enemies)";
  renderTurns();
  refreshConvos();
}

function renderTurns(){
  const box=$("#turns");
  if(!currentTurns.length){newChat();return;}
  box.innerHTML=currentTurns.map((t,i)=>turnHtml(t,i===currentTurns.length-1)).join("");
  const last=currentTurns[currentTurns.length-1];
  const openBtn=box.querySelector("#open-btn"), saveBtn=box.querySelector("#save-btn");
  if(openBtn) openBtn.addEventListener("click",()=>{ if(last._openTarget) window.api.openPath(last._openTarget); });
  if(saveBtn) saveBtn.addEventListener("click",()=>onSave(last.result));
  box.scrollTop=box.scrollHeight;
}

function turnHtml(t,isLast){
  const d=t.result||{};
  const files=(d.files||[]).map(f=>`<li>• ${esc(f.path||f.name||"file")}${f.kind?` <em>(${esc(f.kind)})</em>`:""}</li>`).join("");
  const engineName=ENGINES[d.engine]||"";
  return `
  <div class="turn">
    <div class="bubble user">${esc(t.prompt)}</div>
    <div class="bubble ai">
      <div class="res-title">${esc(d.game_name||"Game")} <span class="pill">${esc(engineName.split(" ")[0])}</span></div>
      <div class="res-sum">${esc(d.summary||"")}</div>
      ${d.setup_notes?`<div class="notes">${esc(d.setup_notes)}</div>`:""}
      <details class="files-det"><summary>${(d.files||[]).length} file(s)</summary><ul>${files}</ul></details>
      ${isLast?`<div class="actions">
        <button class="btn btn-ember" id="open-btn">▶ Open in ${esc((engineName||"engine").split(" ")[0])}</button>
        <button class="btn btn-ghost" id="save-btn">💾 Save to…</button>
      </div>`:""}
    </div>
  </div>`;
}

// ---- Generate / refine -----------------------------------------------------
async function onGenerate(){
  const prompt=$("#prompt").value.trim();
  if(!prompt){setStatus($("#gen-status"),"Describe your game (or a change) first.",true);return;}
  const btn=$("#generate-btn");btn.disabled=true;
  setStatus($("#gen-status"),conversationId?"Refining…":"Generating — this can take a minute…",false,true);

  const r=await window.api.generate({prompt,conversationId});
  btn.disabled=false;
  if(!r.ok){setStatus($("#gen-status"),r.error||"Generation failed.",true);return;}
  setStatus($("#gen-status"),"");
  conversationId=r.conversationId;
  // attach open target from auto-save
  const turn={prompt,result:r.data};
  if(r.saved&&r.saved.openTarget){turn._openTarget=r.saved.openTarget;}
  currentTurns.push(turn);
  $("#engine").disabled=true;
  $("#prompt").value=""; $("#prompt").placeholder="Ask for a change… (e.g. make it faster, add enemies)";
  renderTurns();
  await refreshConvos();
  if(r.saved&&r.saved.openTarget){ toast("Generated & opened ✓"); setStatus($("#gen-status"),"Saved & opened: "+r.saved.openTarget,false); }
  else if(r.saved&&r.saved.error){ setStatus($("#gen-status"),"Generated. Auto-open failed: "+r.saved.error,true); }
  else { toast("Generated ✓"); }
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
