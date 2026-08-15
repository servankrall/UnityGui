// =============================================================================
//  Bundled starter games — complete, self-contained Web (HTML5) games you can
//  create instantly (no AI, no wait, no quota) and then play, edit or refine.
//  Each `html` is a full standalone document; kept free of backticks / ${ so it
//  can live inside this template literal safely.
// =============================================================================

const SNAKE = `<!doctype html><html><head><meta charset="utf8"><title>Snake</title>
<style>html,body{margin:0;height:100%;background:#0b1020;display:grid;place-items:center;font:16px system-ui;color:#eaf0fb;overflow:hidden}
#hud{position:fixed;top:10px;left:12px}#msg{position:fixed;top:50%;left:0;right:0;text-align:center;transform:translateY(-50%);font-size:20px}</style></head>
<body><div id="hud">Score: <b id="s">0</b></div><div id="msg">Press an arrow key to start</div><canvas id="c" width="420" height="420"></canvas>
<script>
var cv=document.getElementById("c"),x=cv.getContext("2d"),N=21,CELL=cv.width/N;
var snake,dir,food,score,alive,timer,ac;
function beep(f){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();var o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f||440;o.connect(g);g.connect(ac.destination);g.gain.value=.05;o.start();o.stop(ac.currentTime+.05);}catch(e){}}
function reset(){snake=[{x:10,y:10}];dir={x:1,y:0};score=0;alive=true;placeFood();document.getElementById("s").textContent=0;document.getElementById("msg").style.display="none";}
function placeFood(){food={x:(Math.random()*N)|0,y:(Math.random()*N)|0};}
function step(){if(!alive)return;var h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
 if(h.x<0||h.y<0||h.x>=N||h.y>=N||snake.some(function(s){return s.x==h.x&&s.y==h.y})){alive=false;document.getElementById("msg").innerHTML="Game over — score "+score+"<br>Press an arrow to restart";document.getElementById("msg").style.display="block";beep(140);return;}
 snake.unshift(h);
 if(h.x==food.x&&h.y==food.y){score++;document.getElementById("s").textContent=score;placeFood();beep(660);}else{snake.pop();}
 draw();}
function draw(){var g=x.createLinearGradient(0,0,0,cv.height);g.addColorStop(0,"#12203a");g.addColorStop(1,"#0b1020");x.fillStyle=g;x.fillRect(0,0,cv.width,cv.height);
 x.fillStyle="#22d3ee";x.fillRect(food.x*CELL+2,food.y*CELL+2,CELL-4,CELL-4);
 x.fillStyle="#7c5cff";snake.forEach(function(s){x.fillRect(s.x*CELL+1,s.y*CELL+1,CELL-2,CELL-2);});window.__tick=(window.__tick||0)+1;}
addEventListener("keydown",function(e){var d={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}}[e.key];if(!d)return;e.preventDefault();
 if(!alive){reset();}else if(d.x!=-dir.x||d.y!=-dir.y){dir=d;}});
reset();draw();timer=setInterval(step,110);window.__ready=true;
</script></body></html>`;

const PONG = `<!doctype html><html><head><meta charset="utf8"><title>Pong</title>
<style>html,body{margin:0;height:100%;background:#0b1020;display:grid;place-items:center;font:16px system-ui;color:#eaf0fb;overflow:hidden}
#hud{position:fixed;top:10px;left:0;right:0;text-align:center;font-size:22px}</style></head>
<body><div id="hud"><b id="p">0</b> : <b id="a">0</b></div><canvas id="c" width="640" height="400"></canvas>
<script>
var cv=document.getElementById("c"),x=cv.getContext("2d"),W=cv.width,H=cv.height;
var py=H/2-40,ay=H/2-40,PH=80,bx=W/2,by=H/2,vx=4,vy=2,ps=0,as=0,ac;
function beep(f){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();var o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f||400;o.connect(g);g.connect(ac.destination);g.gain.value=.05;o.start();o.stop(ac.currentTime+.05);}catch(e){}}
addEventListener("mousemove",function(e){var r=cv.getBoundingClientRect();py=Math.max(0,Math.min(H-PH,e.clientY-r.top-PH/2));});
addEventListener("keydown",function(e){if(e.key=="w")py=Math.max(0,py-24);if(e.key=="s")py=Math.min(H-PH,py+24);});
function serve(d){bx=W/2;by=H/2;vx=d*4;vy=(Math.random()*4-2);}
function loop(){var t=ay+PH/2;ay+=Math.max(-4,Math.min(4,(by-t)*.09));ay=Math.max(0,Math.min(H-PH,ay));
 bx+=vx;by+=vy;if(by<6||by>H-6){vy=-vy;beep(300);}
 if(bx<24&&by>py&&by<py+PH){vx=Math.abs(vx)+.3;vy+=(by-(py+PH/2))*.05;beep(520);}
 if(bx>W-24&&by>ay&&by<ay+PH){vx=-Math.abs(vx)-.3;vy+=(by-(ay+PH/2))*.05;beep(520);}
 if(bx<0){as++;document.getElementById("a").textContent=as;beep(160);serve(1);}
 if(bx>W){ps++;document.getElementById("p").textContent=ps;beep(660);serve(-1);}
 var g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,"#12203a");g.addColorStop(1,"#0b1020");x.fillStyle=g;x.fillRect(0,0,W,H);
 x.fillStyle="#7c5cff";x.fillRect(8,py,10,PH);x.fillStyle="#ff7a45";x.fillRect(W-18,ay,10,PH);
 x.fillStyle="#eaf0fb";x.beginPath();x.arc(bx,by,6,0,7);x.fill();
 window.__tick=(window.__tick||0)+1;requestAnimationFrame(loop);}
serve(1);requestAnimationFrame(loop);window.__ready=true;
</script></body></html>`;

const FLAPPY = `<!doctype html><html><head><meta charset="utf8"><title>Flappy</title>
<style>html,body{margin:0;height:100%;background:#0b1020;display:grid;place-items:center;font:16px system-ui;color:#eaf0fb;overflow:hidden;cursor:pointer}
#hud{position:fixed;top:10px;left:12px}#msg{position:fixed;top:46%;left:0;right:0;text-align:center;font-size:20px}</style></head>
<body><div id="hud">Score: <b id="s">0</b></div><div id="msg">Click / Space to flap</div><canvas id="c" width="400" height="520"></canvas>
<script>
var cv=document.getElementById("c"),x=cv.getContext("2d"),W=cv.width,H=cv.height;
var y,vy,pipes,score,alive,started,ac,GAP=140;
function beep(f){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();var o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f||500;o.connect(g);g.connect(ac.destination);g.gain.value=.05;o.start();o.stop(ac.currentTime+.05);}catch(e){}}
function reset(){y=H/2;vy=0;pipes=[];score=0;alive=true;started=false;for(var i=0;i<3;i++)pipes.push({x:W+i*200,h:80+Math.random()*(H-GAP-160)});document.getElementById("s").textContent=0;document.getElementById("msg").style.display="block";}
function flap(){if(!alive){reset();return;}started=true;vy=-6;beep(680);}
addEventListener("mousedown",flap);addEventListener("keydown",function(e){if(e.key==" "){e.preventDefault();flap();}});
function loop(){var g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,"#12305a");g.addColorStop(1,"#0b1020");x.fillStyle=g;x.fillRect(0,0,W,H);
 if(started&&alive){vy+=.4;y+=vy;document.getElementById("msg").style.display="none";
  pipes.forEach(function(p){p.x-=2.4;if(p.x<-60){p.x=Math.max.apply(null,pipes.map(function(q){return q.x;}))+200;p.h=80+Math.random()*(H-GAP-160);p.scored=false;}
   if(!p.scored&&p.x+60<80){p.scored=true;score++;document.getElementById("s").textContent=score;beep(880);}});
  if(y>H-10||y<0){alive=false;}
  pipes.forEach(function(p){if(80+18>p.x&&80-18<p.x+60&&(y-18<p.h||y+18>p.h+GAP)){alive=false;}});
  if(!alive){document.getElementById("msg").innerHTML="Crashed — score "+score+"<br>Click to try again";document.getElementById("msg").style.display="block";beep(150);}
 }
 x.fillStyle="#34d399";pipes.forEach(function(p){x.fillRect(p.x,0,60,p.h);x.fillRect(p.x,p.h+GAP,60,H-p.h-GAP);});
 x.fillStyle="#ffca3a";x.beginPath();x.arc(80,y,16,0,7);x.fill();
 window.__tick=(window.__tick||0)+1;requestAnimationFrame(loop);}
reset();requestAnimationFrame(loop);window.__ready=true;
</script></body></html>`;

const TEMPLATES = [
  { id: "snake", name: "Snake", icon: "🐍", engine: "web", summary: "Grid snake — eat food to grow, don't hit the walls or yourself.", setup: "Arrow keys to turn.", html: SNAKE },
  { id: "pong", name: "Pong", icon: "🏓", engine: "web", summary: "Classic pong vs a simple AI paddle.", setup: "Move the mouse (or W/S) to control the left paddle.", html: PONG },
  { id: "flappy", name: "Flappy", icon: "🐤", engine: "web", summary: "Flap between pipes for as long as you can.", setup: "Click or press Space to flap.", html: FLAPPY },
];

function list() { return TEMPLATES.map(t => ({ id: t.id, name: t.name, icon: t.icon, engine: t.engine, summary: t.summary })); }
function byId(id) { return TEMPLATES.find(t => t.id === id) || null; }

module.exports = { TEMPLATES, list, byId };
