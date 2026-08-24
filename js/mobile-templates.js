/* UnityGUI mobile — bundled INSTANT games.
   Self-contained, touch-first HTML5 games that play immediately with no AI and
   work offline. Each is a complete HTML document string; the app loads it into
   the full-screen player iframe. Each sets window.__ready for smoke tests. */
(function (global) {
  "use strict";

  var HEAD =
    '<!doctype html><html><head><meta charset="utf8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,viewport-fit=cover">' +
    '<style>html,body{margin:0;height:100%;background:#0a0d14;overflow:hidden;touch-action:none;' +
    'font-family:-apple-system,system-ui,sans-serif;-webkit-user-select:none;user-select:none}' +
    'canvas{display:block}#h{position:fixed;top:calc(10px + env(safe-area-inset-top));left:0;right:0;' +
    'text-align:center;color:#a68bff;font-weight:800;font-size:19px;text-shadow:0 1px 5px #000;pointer-events:none}</style>' +
    '</head><body><div id="h"></div><canvas id="c"></canvas><script>';
  var TAIL = '<\/script></body></html>';
  var AUDIO =
    'var _ac;function beep(f,d){try{if(!_ac)_ac=new(window.AudioContext||window.webkitAudioContext)();' +
    'var o=_ac.createOscillator(),g=_ac.createGain();o.frequency.value=f;o.type="square";o.connect(g);g.connect(_ac.destination);' +
    'g.gain.value=.05;o.start();o.stop(_ac.currentTime+(d||.08));}catch(e){}}';

  // ---------- SNAKE (swipe) ----------
  var SNAKE = HEAD +
    'var cv=document.getElementById("c"),x=cv.getContext("2d"),H=document.getElementById("h");' +
    'var W,Ht,grid=17,cell,snake,dir,ndir,food,score,dead,speed,acc,ox,oy;' + AUDIO +
    'function fit(){W=cv.width=innerWidth;Ht=cv.height=innerHeight;cell=Math.floor(Math.min(W,Ht-40)/grid);ox=((W-grid*cell)/2)|0;oy=((Ht-grid*cell)/2)|0;}' +
    'addEventListener("resize",fit);fit();' +
    'function spawn(){return{x:(Math.random()*grid)|0,y:(Math.random()*grid)|0};}' +
    'function reset(){snake=[{x:8,y:8}];dir={x:1,y:0};ndir=dir;food=spawn();score=0;dead=false;acc=0;speed=7;H.textContent="0";}' +
    'function step(){dir=ndir;var nx=snake[0].x+dir.x,ny=snake[0].y+dir.y;if(nx<0||ny<0||nx>=grid||ny>=grid||snake.some(function(s){return s.x===nx&&s.y===ny;})){dead=true;beep(110,.2);return;}' +
    'snake.unshift({x:nx,y:ny});if(nx===food.x&&ny===food.y){score++;H.textContent=score;food=spawn();beep(720);if(speed<16)speed+=.4;}else snake.pop();}' +
    'function draw(){x.fillStyle="#0a0d14";x.fillRect(0,0,W,Ht);x.fillStyle="#0f1626";x.fillRect(ox,oy,grid*cell,grid*cell);' +
    'x.fillStyle="#ff4d8d";x.fillRect(ox+food.x*cell+2,oy+food.y*cell+2,cell-4,cell-4);' +
    'for(var i=0;i<snake.length;i++){x.fillStyle=i===0?"#22d3ee":"#7c5cff";x.fillRect(ox+snake[i].x*cell+1,oy+snake[i].y*cell+1,cell-2,cell-2);}' +
    'if(dead){x.fillStyle="rgba(0,0,0,.62)";x.fillRect(0,0,W,Ht);x.fillStyle="#fff";x.textAlign="center";x.font="bold 30px system-ui";x.fillText("Game Over",W/2,Ht/2-8);x.font="16px system-ui";x.fillText("Tap to restart · Score "+score,W/2,Ht/2+26);}}' +
    'function loop(){if(!dead){acc+=1/60;if(acc>=1/speed){acc=0;step();}}draw();requestAnimationFrame(loop);}' +
    'function turn(dx,dy){if(dx===-dir.x&&dy===-dir.y)return;ndir={x:dx,y:dy};}' +
    'addEventListener("keydown",function(e){var k=e.key;if(k==="ArrowUp")turn(0,-1);else if(k==="ArrowDown")turn(0,1);else if(k==="ArrowLeft")turn(-1,0);else if(k==="ArrowRight")turn(1,0);});' +
    'var sx=null,sy=null;' +
    'cv.addEventListener("touchstart",function(e){e.preventDefault();if(dead){reset();return;}var t=e.touches[0];sx=t.clientX;sy=t.clientY;},{passive:false});' +
    'cv.addEventListener("touchend",function(e){if(sx==null)return;var t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;if(Math.abs(dx)<14&&Math.abs(dy)<14){sx=null;return;}if(Math.abs(dx)>Math.abs(dy))turn(dx>0?1:-1,0);else turn(0,dy>0?1:-1);sx=null;},{passive:false});' +
    'cv.addEventListener("click",function(){if(dead)reset();});' +
    'reset();window.__ready=true;requestAnimationFrame(loop);' + TAIL;

  // ---------- FLAPPY (tap) ----------
  var FLAPPY = HEAD +
    'var cv=document.getElementById("c"),x=cv.getContext("2d"),H=document.getElementById("h");' +
    'var W,Ht,by,bv,pipes,score,dead,started,gap,pw,t0;' + AUDIO +
    'function fit(){W=cv.width=innerWidth;Ht=cv.height=innerHeight;gap=Math.max(140,Ht*0.28);pw=Math.max(52,W*0.16);}' +
    'addEventListener("resize",fit);fit();' +
    'function reset(){by=Ht*0.4;bv=0;pipes=[];score=0;dead=false;started=false;H.textContent="Tap to fly";t0=0;}' +
    'function addPipe(px){var top=60+Math.random()*(Ht-gap-140);pipes.push({x:px,top:top,done:false});}' +
    'function flap(){if(dead){reset();return;}started=true;bv=-Math.max(6.5,Ht*0.011);beep(560);}' +
    'function update(){if(!started)return;bv+=Math.max(.35,Ht*0.0006);by+=bv;if(pipes.length===0||pipes[pipes.length-1].x<W-W*0.55)addPipe(W+40);' +
    'for(var i=pipes.length-1;i>=0;i--){var p=pipes[i];p.x-=Math.max(2.6,W*0.006);if(!p.done&&p.x+pw<W*0.28){p.done=true;score++;H.textContent=score;beep(720);}if(p.x+pw<-10)pipes.splice(i,1);}' +
    'var bx=W*0.28,br=Math.max(12,W*0.035);if(by<br||by>Ht-br){die();}' +
    'for(var j=0;j<pipes.length;j++){var q=pipes[j];if(bx+br>q.x&&bx-br<q.x+pw&&(by-br<q.top||by+br>q.top+gap))die();}}' +
    'function die(){if(!dead){dead=true;started=false;beep(120,.2);}}' +
    'function draw(){var g=x.createLinearGradient(0,0,0,Ht);g.addColorStop(0,"#0e1630");g.addColorStop(1,"#1a2340");x.fillStyle=g;x.fillRect(0,0,W,Ht);' +
    'x.fillStyle="#34d399";for(var i=0;i<pipes.length;i++){var p=pipes[i];x.fillRect(p.x,0,pw,p.top);x.fillRect(p.x,p.top+gap,pw,Ht-p.top-gap);}' +
    'var bx=W*0.28,br=Math.max(12,W*0.035);x.fillStyle="#ffd166";x.beginPath();x.arc(bx,by,br,0,7);x.fill();x.fillStyle="#0a0d14";x.beginPath();x.arc(bx+br*0.4,by-br*0.3,br*0.25,0,7);x.fill();' +
    'if(dead){x.fillStyle="rgba(0,0,0,.62)";x.fillRect(0,0,W,Ht);x.fillStyle="#fff";x.textAlign="center";x.font="bold 30px system-ui";x.fillText("Game Over",W/2,Ht/2-8);x.font="16px system-ui";x.fillText("Tap to restart · Score "+score,W/2,Ht/2+26);}}' +
    'function loop(){update();draw();requestAnimationFrame(loop);}' +
    'cv.addEventListener("touchstart",function(e){e.preventDefault();flap();},{passive:false});' +
    'cv.addEventListener("mousedown",function(){flap();});' +
    'addEventListener("keydown",function(e){if(e.key===" "||e.key==="ArrowUp"){e.preventDefault();flap();}});' +
    'reset();window.__ready=true;requestAnimationFrame(loop);' + TAIL;

  // ---------- BREAKOUT (drag) ----------
  var BREAKOUT = HEAD +
    'var cv=document.getElementById("c"),x=cv.getContext("2d"),H=document.getElementById("h");' +
    'var W,Ht,px,pw,ph,bx,by,bvx,bvy,br,bricks,cols,rows,bw,bh,score,lives,dead,won,started,r0;' + AUDIO +
    'function fit(){W=cv.width=innerWidth;Ht=cv.height=innerHeight;pw=Math.max(70,W*0.24);ph=14;cols=Math.max(5,Math.min(8,Math.floor(W/60)));rows=4;bw=(W-20)/cols;bh=Math.max(20,Ht*0.03);br=Math.max(8,W*0.02);}' +
    'addEventListener("resize",fit);fit();' +
    'function reset(){px=(W-pw)/2;bricks=[];for(var r=0;r<rows;r++)for(var c=0;c<cols;c++)bricks.push({c:c,r:r,a:true});score=0;lives=3;dead=false;won=false;started=false;launch();H.textContent="Tap to start";}' +
    'function launch(){bx=W/2;by=Ht*0.7;var a=(Math.random()*0.6-0.3);bvx=Math.sin(a)*Math.max(4,W*0.009);bvy=-Math.max(4.5,Ht*0.007);started=false;}' +
    'function update(){if(!started||dead||won)return;bx+=bvx;by+=bvy;if(bx<br||bx>W-br){bvx=-bvx;bx=Math.max(br,Math.min(W-br,bx));beep(400);}if(by<br+ (30)){bvy=-bvy;by=br+30;beep(400);}' +
    'var pyt=Ht-40;if(by+br>=pyt&&by+br<=pyt+ph+12&&bx>px&&bx<px+pw&&bvy>0){bvy=-Math.abs(bvy);bvx=((bx-(px+pw/2))/(pw/2))*Math.max(5,W*0.01);beep(560);}' +
    'if(by-br>Ht){lives--;if(lives<=0){dead=true;beep(120,.2);}else launch();}' +
    'for(var i=0;i<bricks.length;i++){var b=bricks[i];if(!b.a)continue;var X=10+b.c*bw,Y=70+b.r*(bh+6);if(bx+br>X&&bx-br<X+bw-4&&by+br>Y&&by-br<Y+bh){b.a=false;bvy=-bvy;score+=10;H.textContent=score;beep(680);if(!bricks.some(function(z){return z.a;}))won=true;break;}}}' +
    'function draw(){x.fillStyle="#0a0d14";x.fillRect(0,0,W,Ht);' +
    'var pal=["#7c5cff","#22d3ee","#ff4d8d","#34d399"];for(var i=0;i<bricks.length;i++){var b=bricks[i];if(!b.a)continue;x.fillStyle=pal[b.r%pal.length];x.fillRect(10+b.c*bw,70+b.r*(bh+6),bw-4,bh);}' +
    'x.fillStyle="#eaf0fb";x.fillRect(px,Ht-40,pw,ph);x.fillStyle="#ffd166";x.beginPath();x.arc(bx,by,br,0,7);x.fill();' +
    'x.fillStyle="#9aa6bd";x.textAlign="right";x.font="15px system-ui";x.fillText("♥ "+lives,W-14,Ht-14);' +
    'if(dead||won){x.fillStyle="rgba(0,0,0,.62)";x.fillRect(0,0,W,Ht);x.fillStyle="#fff";x.textAlign="center";x.font="bold 30px system-ui";x.fillText(won?"You win!":"Game Over",W/2,Ht/2-8);x.font="16px system-ui";x.fillText("Tap to restart · Score "+score,W/2,Ht/2+26);}}' +
    'function loop(){update();draw();requestAnimationFrame(loop);}' +
    'function move(cx){px=Math.max(0,Math.min(W-pw,cx-pw/2));}' +
    'cv.addEventListener("touchstart",function(e){e.preventDefault();if(dead||won){reset();return;}started=true;move(e.touches[0].clientX);},{passive:false});' +
    'cv.addEventListener("touchmove",function(e){e.preventDefault();move(e.touches[0].clientX);},{passive:false});' +
    'cv.addEventListener("mousemove",function(e){move(e.clientX);});' +
    'cv.addEventListener("mousedown",function(e){if(dead||won){reset();return;}started=true;});' +
    'reset();window.__ready=true;requestAnimationFrame(loop);' + TAIL;

  global.MOBILE_TEMPLATES = [
    { id: "snake", name: "Snake", icon: "🐍", html: SNAKE },
    { id: "flappy", name: "Flappy", icon: "🐤", html: FLAPPY },
    { id: "breakout", name: "Breakout", icon: "🧱", html: BREAKOUT },
  ];
})(typeof window !== "undefined" ? window : this);
