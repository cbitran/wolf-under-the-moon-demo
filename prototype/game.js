import { ART } from './symbols.js?v=20261011-entry16';
import { createGrid, evaluateGrid, collapseGrid } from './engine.js?v=20261011-entry16';
const $ = id => document.getElementById(id);
const game=$('game'), board=$('board'), spin=$('spin'), result=$('result');
const entry=$('entry'), enter=$('enter'), entryStatus=$('entry-status');
let entering=false;
const openingMorph=$('opening-morph');
const morphWide=matchMedia('(min-aspect-ratio:16/9)');
function selectOpeningArt(){
 for(const [selector,active] of [['.standard-letter-layer',!morphWide.matches],['.ultra-letter-layer',morphWide.matches]]){
  const image=entry.querySelector(selector+' image');
  if(active)image.setAttribute('href',image.dataset.artSrc);
  else image.removeAttribute('href');
 }
}
selectOpeningArt();
morphWide.addEventListener('change',selectOpeningArt);

let openingMorphPlayback=Promise.resolve();
let cancelOpeningMorph=null;
function prepareOpeningMorph(){
 if(entry.hidden||openingMorph.hidden||openingMorph.ended)return;
 // Both registered crops share the same timeline; orientation must not restart it.
 const resumeTime=openingMorph.currentTime||0;
 cancelOpeningMorph?.();
 openingMorph.pause();
 const minimal=matchMedia('(prefers-reduced-motion: reduce)').matches||navigator.connection?.saveData;
 openingMorph.hidden=Boolean(minimal);
 if(minimal){openingMorph.removeAttribute('src');openingMorph.load();openingMorphPlayback=Promise.resolve();return;}
 const variant=morphWide.matches?'ultra':'standard';
 openingMorph.poster=`../assets/runtime/opening-seedance-head-${variant}-poster-v2.webp`;
 openingMorph.src=`../assets/runtime/opening-seedance-head-${variant}-v2.mp4`;
 openingMorph.currentTime=resumeTime;
 openingMorph.playbackRate=1.5;
 openingMorphPlayback=new Promise(resolve=>{
  let done=false,timeout=null,remaining=20000,visibleSince=null;
  const finish=()=>{
   if(done)return;done=true;clearTimeout(timeout);
   document.removeEventListener('visibilitychange',syncMorphVisibility);
   openingMorph.removeEventListener('ended',finish);
   openingMorph.removeEventListener('error',fail);
   if(cancelOpeningMorph===finish)cancelOpeningMorph=null;
   resolve();
  };
  const fail=()=>{if(done)return;openingMorph.hidden=true;openingMorph.pause();finish();};
  const syncMorphVisibility=()=>{
   if(done)return;
   clearTimeout(timeout);
   if(visibleSince!==null){remaining-=performance.now()-visibleSince;visibleSince=null;}
   if(document.hidden){openingMorph.pause();return;}
   if(remaining<=0){fail();return;}
   visibleSince=performance.now();timeout=setTimeout(fail,remaining);
   openingMorph.play().catch(()=>{if(!document.hidden&&!done)fail();});
  };
  document.addEventListener('visibilitychange',syncMorphVisibility);
  cancelOpeningMorph=finish;
  openingMorph.addEventListener('ended',finish,{once:true});
  openingMorph.addEventListener('error',fail,{once:true});
  syncMorphVisibility();
 });
}
prepareOpeningMorph();
morphWide.addEventListener('change',prepareOpeningMorph);

let turbo=false;
const turboButton=$('turbo'),wolf=document.querySelector('.wolf-reference');
const wolfNormal=wolf.getAttribute('src');
const wolfHowl='../assets/runtime/wolf-howl-selected-v7.webp';
const wolfRage='../assets/runtime/wolf-rage-selected-v6.webp';
let wolfReaction=0;
function restoreWolfPose(){
 wolfReaction++;
 game.dataset.wolfState=turbo?'howl':'idle';
 wolf.src=turbo?wolfHowl:wolfNormal;
 wolf.alt=turbo?'Lobisomem agachado uivando para a lua eclipsada.':'Lobisomem agachado, com olhar feroz e a garra apoiada à frente.';
}
async function showRoundReaction(won){
 const reaction=++wolfReaction;
 game.dataset.wolfState=won?'rage':'howl';
 wolf.src=won?wolfRage:wolfHowl;
 if(!won)playWolfHowl();
 wolf.alt=won?'Lobisomem enfurecido com o ganho do jogador.':'Lobisomem em pose de uivo de triunfo após rodada sem ganho.';
 // Static poses provide the result mapping until approved motion clips exist.
 await animate(wolf,[{opacity:1},{opacity:1}],{duration:1800},{keepDuration:true});
 if(reaction===wolfReaction)restoreWolfPose();
}

turboButton.onclick=()=>{
 if(busy)return;
 turbo=!turbo;
 turboButton.setAttribute('aria-pressed',String(turbo));
 game.classList.toggle('turbo-active',turbo);
 restoreWolfPose();
 // Brief opacity easing softens the still-pose swap without stretching either axis.
 for(const motion of wolf.getAnimations())motion.cancel();
 void animate(wolf,[{opacity:.65},{opacity:1}],{duration:180,easing:'ease-out'});
 wolf.alt=turbo?'Lobisomem agachado uivando para a lua eclipsada.':'Lobisomem agachado, com olhar feroz e a garra apoiada à frente.';
 result.textContent=turbo?'Turbo ativado. Rodadas mais rápidas.':'Turbo desativado. Velocidade normal.';
};
const art=new Map(ART.map(item=>[item.id,item]));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let busy=true, total=0, round=0;
const animations=new Set();
function animate(node,frames,options,{keepDuration=false}={}){
 // Static holds preserve reading time even when visible motion is disabled.
 if(reduced.matches&&!keepDuration){return Promise.resolve();}
 const motion=node.animate(frames,options); animations.add(motion);
 if(document.hidden)motion.pause();
 return motion.finished.catch(()=>{}).finally(()=>{animations.delete(motion);motion.cancel();});
}
function cellFor(id,index){
 const cell=document.createElement('div');cell.className='cell';
 cell.setAttribute('aria-label',`Linha ${Math.floor(index/4)+1}, coluna ${index%4+1}: ${art.get(id).label}`);
 const image=new Image();image.src=art.get(id).src;image.alt='';image.draggable=false;cell.append(image);
 return cell;
}
function draw(grid){board.replaceChildren(...grid.map(cellFor));}
let rewardTimer;
function showReward(points){
 clearTimeout(rewardTimer);board.parentElement.querySelectorAll('.win-reward').forEach(node=>node.remove());
 const reward=document.createElement('div');
 reward.className='win-reward';reward.setAttribute('aria-hidden','true');
 const value=document.createElement('strong');value.textContent=`+${points}`;
 const unit=document.createElement('span');unit.textContent='PONTOS';
 reward.append(value,unit);board.parentElement.append(reward);
 if(reduced.matches){rewardTimer=setTimeout(()=>reward.remove(),1400);return;}
 void animate(reward,[
  {opacity:0,transform:'translate(-50%, -35%) scale(.88)',offset:0},
  {opacity:1,transform:'translate(-50%, -50%) scale(1)',offset:.18},
  {opacity:1,transform:'translate(-50%, -65%) scale(1)',offset:.7},
  {opacity:0,transform:'translate(-50%, -85%) scale(1)',offset:1}
 ],{duration:1700,easing:'ease-out',fill:'both'}).then(()=>reward.remove());
}
async function play(){
 if(busy)return;
 restoreWolfPose();
 clearTimeout(rewardTimer);board.parentElement.querySelectorAll('.win-reward').forEach(node=>node.remove());
 busy=true;turboButton.disabled=true;spin.disabled=true;
 game.dataset.phase='spinning';result.textContent='A floresta guarda seus segredos…';$('earned').textContent='—';spin.textContent='GIRANDO…';
 try{
  const speed=turbo?.45:1;
  let grid=createGrid();
  draw(grid);
  // Every symbol lands at its exact resting transform; no second settle animation.
  await Promise.all([...board.children].map((cell,index)=>animate(cell.firstElementChild,[
   {transform:'translateY(-120%) rotate(-5deg)',opacity:0,offset:0},
   {transform:'translateY(-35%) rotate(-2deg)',opacity:1,offset:.55},
   {transform:'translateY(0) rotate(0)',opacity:1,offset:1}
  ],{duration:(380+Math.random()*150)*speed,delay:((index%4)*65+Math.floor(index/4)*42+Math.random()*70)*speed,easing:'cubic-bezier(.25,.65,.3,1)',fill:'both'})));
  round++;$('round').textContent=round;
  let roundPoints=0,chain=0;
  let outcome=evaluateGrid(grid);
  while(outcome.hasWin){
   chain++;roundPoints+=outcome.totalPoints;total+=outcome.totalPoints;
   $('earned').textContent=`+${roundPoints}`;$('score').textContent=total;
   game.dataset.phase='win';
   result.textContent=`Ganho ${chain}: +${outcome.totalPoints} pontos. Rodada: ${roundPoints} pontos.`;
   showReward(outcome.totalPoints);
   // Keep the winning group readable before removing it, while the reward floats.
   await Promise.all(outcome.winningIndices.map(index=>{
    const cell=board.children[index];cell.classList.add('win');
    cell.setAttribute('aria-label',cell.getAttribute('aria-label')+', combinação vencedora');
    return animate(cell.firstElementChild,[{transform:'scale(1)',opacity:1},{transform:'scale(1.12)',opacity:1,offset:.65},{transform:'scale(.35)',opacity:0}],{duration:580*speed,easing:'ease-in',fill:'both'});
   }));
   const collapsed=collapseGrid(grid,outcome.winningIndices);
   grid=collapsed.grid;
   const step=board.children[4].offsetTop-board.children[0].offsetTop;
   draw(grid);board.classList.add('cascading');game.dataset.phase='cascading';
   try{
    await Promise.all([...board.children].map((cell,index)=>{
     const row=Math.floor(index/4),origin=collapsed.origins[index],distance=row-origin;
     if(!distance)return Promise.resolve();
     const fresh=origin<0;
     return animate(cell.firstElementChild,[
      {transform:`translateY(${-distance*step}px)`,opacity:fresh?0:1},
      {transform:`translateY(${-distance*step*.72}px)`,opacity:1,offset:.28},
      {transform:'translateY(0)',opacity:1}
     ],{duration:(310+distance*65+Math.random()*100)*speed,delay:((index%4)*33+Math.random()*90)*speed,easing:'cubic-bezier(.4,0,.65,1)',fill:'both'});
    }));
   }finally{board.classList.remove('cascading');}
   outcome=evaluateGrid(grid);
  }
  $('earned').textContent=roundPoints?`+${roundPoints}`:'0';
  game.dataset.phase=roundPoints?'win':'lose';
  void showRoundReaction(roundPoints>0);
  result.textContent=roundPoints?`Rodada concluída: ${chain} ${chain===1?'ganho':'ganhos'}, ${roundPoints} pontos no total.`:'Nenhuma combinação. A caçada continua.';
 }catch(error){result.textContent='Não foi possível concluir a rodada. Tente novamente.';console.error(error);}
 finally{busy=false;turboButton.disabled=false;spin.disabled=false;spin.textContent='GIRAR';}
}
async function start(){
 turboButton.disabled=true;spin.disabled=true;spin.textContent='CARREGANDO…';busy=true;enter.disabled=true;entryStatus.textContent='Preparando os símbolos…';result.textContent='Preparando os símbolos…';
 const resources=[{label:'Corvo na moldura',src:'../assets/runtime/raven-perched-v1.webp'},{label:'Botão Girar',src:'../assets/runtime/button-spin-v3.svg'},{label:'Botão Turbo',src:'../assets/runtime/button-turbo-v3.svg'},{label:'Botão de acesso',src:'../assets/runtime/button-square-v3.svg'},{label:'Livro do menu',src:'../assets/runtime/menu-book-v1.webp'},...ART,{label:'Lobisomem enfurecido',src:wolfRage},{label:'Lobisomem uivando',src:wolfHowl},{label:'Floresta sob eclipse',src:'../assets/runtime/forest-eclipse-v1.webp'},{label:'Moldura de madeira',src:'../assets/runtime/grid-wood-frame-v2.webp'},{label:'Botão de madeira',src:'../assets/runtime/button-wood-v2.webp'},{label:'Clareira e caçadores',src:'../assets/runtime/forest-stage-v6-canopy.webp'},{label:'Logo',src:'../assets/runtime/logo-moon-ivory-v5.webp'},{label:'Lobisomem',src:'../assets/runtime/wolf-idle-selected-v5.webp'},{label:'Floresta',src:'../assets/runtime/forest-v1.webp'}];

 const openingVariant=morphWide.matches?'ultrawide':'continuous';
 const openingVersion=morphWide.matches?'v4':'v3';
 resources.push({label:'Composição de abertura',src:`../assets/runtime/opening-${openingVariant}-scratched-${openingVersion}.webp`},{label:'Logo intacta da abertura',src:`../assets/runtime/opening-${openingVariant}-intact-${openingVersion}.webp`});
 let ready=0;
 $('loading-progress').hidden=false;enter.textContent='CARREGANDO';
 const updateProgress=()=>{
  const percent=Math.floor(ready/resources.length*100);
  $('asset-progress').value=percent;
 };
 updateProgress();
 const loaded=await Promise.allSettled(resources.map(item=>new Promise((resolve,reject)=>{
  const image=new Image();let settled=false;
  const finish=error=>{
   if(settled)return;settled=true;clearTimeout(timeout);image.onload=null;image.onerror=null;
   if(error){reject(error);return;}
   ready++;updateProgress();resolve();
  };
  const timeout=setTimeout(()=>finish(new Error(`Tempo de carregamento excedido: ${item.label}`)),30000);
  image.onload=async()=>{
   try{await image.decode();finish();}catch(error){finish(error);}
  };
  image.onerror=()=>finish(new Error(item.label));image.src=item.src;
 })));
 const failed=loaded.filter(item=>item.status==='rejected');
 if(failed.length){result.textContent=`${failed.length} artes não carregaram. Tente novamente.`;spin.textContent='TENTAR NOVAMENTE';spin.disabled=false;spin.onclick=start;entryStatus.textContent=result.textContent;enter.textContent='TENTAR NOVAMENTE';enter.disabled=false;enter.onclick=start;return;}
 // Prepare the initial board behind the opening without revealing its symbols.
 board.classList.add('awaiting-entry');
 draw(Array.from({length:16},(_,index)=>ART[index%ART.length].id));
 for(const cell of board.children)cell.firstElementChild.style.visibility='hidden';busy=true;turboButton.disabled=true;spin.disabled=true;spin.textContent='PREPARANDO…';spin.onclick=play;
 game.dataset.phase='ready';result.textContent='A floresta está pronta.';
 entryStatus.textContent='Carregamento concluído. Finalizando a animação…';
 // Assets and animation run independently; both must finish before manual entry.
 await openingScratch;
 entryStatus.textContent='Tudo pronto. Toque em Entrar para começar.';
 enter.textContent='ENTRAR';enter.onclick=openGame;enter.disabled=false;
}
let openingScratch=null;
async function scratchAfterMorph(){
 // Resizing while loading may replace the video; await the current playback.
 let playback;
 do{playback=openingMorphPlayback;await playback;}while(playback!==openingMorphPlayback);
 // Keep the exact decoded final frame; revealing the painted BG head caused a jump.
 const finalStill=$('opening-morph-still');
 if(!openingMorph.hidden&&openingMorph.ended){
  try{
   await finalStill.querySelector('img').decode();
   finalStill.hidden=false;
   openingMorph.hidden=true;
  }catch{
   // The ended video already retains its last frame if the still cannot load.
   openingMorph.pause();
  }
 }else openingMorph.hidden=true;
 playLogoTear();
 const cuts=[...entry.querySelectorAll('.entry-cut')],edges=[...entry.querySelectorAll('.entry-edge')];
 // Linear travel and square mask caps make the cut advance along the letter.
 // The moving highlight uses the same path and timing as the reveal front.
 await Promise.all(cuts.map((cut,i)=>animate(cut,
  [{strokeDashoffset:'650'},{strokeDashoffset:'0'}],
  {duration:260,delay:(i%3)*45,easing:'linear',fill:'forwards'}
 ).then(()=>{cut.style.strokeDashoffset='0';})).concat(edges.map((edge,i)=>animate(edge,[
  {strokeDashoffset:'85',opacity:0},
  {strokeDashoffset:'0',opacity:1,offset:.12},
  {strokeDashoffset:'-650',opacity:1,offset:.78},
  {strokeDashoffset:'-650',opacity:0}
 ],{duration:340,delay:(i%3)*45,easing:'linear',fill:'forwards'}))));
}
async function openGame(){
 if(entering||enter.disabled)return;entering=true;enter.disabled=true;
 startForestAudio();
 enter.textContent='ENTRANDO';
 await openingScratch;
 await animate(entry,[{opacity:1},{opacity:0}],{duration:350,easing:'ease-out',fill:'forwards'});
 entry.hidden=true;openingMorph.pause();game.inert=false;
 game.dataset.phase='entering';result.textContent='Os símbolos estão entrando no tabuleiro.';
 const step=board.children[4].offsetTop-board.children[0].offsetTop;
 board.classList.remove('awaiting-entry');board.classList.add('cascading');
 try{
  // Fill from the lowest row upward so later pieces never pass through settled ones.
  for(let row=3;row>=0;row--){
   for(let column=0;column<4;column++){
    const image=board.children[row*4+column].firstElementChild;
    const distance=(row+1)*step;
    image.style.visibility='visible';
    await animate(image,[
     {transform:`translateY(${-distance}px)`,opacity:0},
     {transform:`translateY(${-distance*.78}px)`,opacity:1,offset:.2},
     {transform:'translateY(0)',opacity:1}
    ],{duration:125+row*15,easing:'cubic-bezier(.35,0,.55,1)',fill:'both'});
   }
  }
 }finally{
  board.classList.remove('cascading');busy=false;spin.disabled=false;turboButton.disabled=false;
  spin.textContent='GIRAR';game.dataset.phase='idle';result.textContent='A lua surgiu. Comece a caçada.';
  spin.focus({preventScroll:true});
 }
}
$('help').onclick=()=>$('music-toggle').click();$('close-rules').onclick=()=>$('rules').close();
function syncVisibility(){
 const hidden=document.hidden;
 game.classList.toggle('paused',hidden);
 entry.classList.toggle('paused',hidden);
 for(const motion of animations){if(hidden)motion.pause();else motion.play();}
}
document.addEventListener('visibilitychange',syncVisibility);
syncVisibility();
openingScratch=scratchAfterMorph();
void start();

// Independent music and sound-effect preferences.
const audioPreferences={music:true,sfx:true};
try{const saved=JSON.parse(localStorage.getItem('wolf-audio-preferences')||'null');for(const key of ['music','sfx'])if(typeof saved?.[key]==='boolean')audioPreferences[key]=saved[key];}catch{}
// Start inside the Enter gesture, so mobile browsers can unlock sound.
const forestTracks=[
 {src:'../assets/runtime/forest-wind.mp3',level:.12,loop:true,channel:'sfx'},
 {src:'../assets/runtime/forest-searchers.mp3',level:.035,loop:true,channel:'sfx'},
 {src:'../assets/runtime/wolf-howl.mp3',level:.18,loop:false,channel:'sfx'},
 {src:'../assets/runtime/forest-music.mp3',level:.14,loop:true,channel:'music'},
 {src:'../assets/runtime/logo-claw-tear.mp3',level:.22,loop:false,channel:'sfx'},
 {src:'../assets/runtime/book-page-turn.mp3',level:.12,loop:false,channel:'sfx'},
 {src:'../assets/runtime/ui-click.mp3',level:.12,loop:false,channel:'sfx'}
].map(config=>{const media=new Audio(config.src);media.loop=config.loop;media.preload='none';media.volume=0;return {...config,media,gain:null};});
let forestAudioStarted=false,forestAudioContext;
const uiClickSound=forestTracks[6];
uiClickSound.media.preload='auto';uiClickSound.media.load();
function playUiClick(){
 if(document.hidden)return;
 if(!forestAudioStarted)startForestAudio();
 if(uiClickSound.gain){
  const time=forestAudioContext.currentTime;
  uiClickSound.gain.gain.cancelScheduledValues(time);
  uiClickSound.gain.gain.setValueAtTime(uiClickSound.level,time);
 }else uiClickSound.media.volume=uiClickSound.level;
 uiClickSound.media.currentTime=0;
 void uiClickSound.media.play().catch(()=>{});
}
document.addEventListener('click',event=>{
 // One sound per real activation, including keyboard; delegated .click() calls are silent.
 if(!event.isTrusted||!(event.target instanceof Element))return;
 const control=event.target.closest('button,a[href],[role="button"],input[type="checkbox"],input[type="radio"]');
 if(!control||control.matches(':disabled,[aria-disabled="true"]')||control.closest('[inert]'))return;
 // The effects switch acknowledges both on and off; subsequent actions obey the saved state.
 if(!audioPreferences.sfx&&control.id!=='sfx-toggle')return;
 setTimeout(playUiClick,0);
},true);
const pageTurnSound=forestTracks[5];
pageTurnSound.media.preload='auto';pageTurnSound.media.load();
function playBookPageTurn(){
 if(!forestAudioStarted||!audioPreferences.sfx||document.hidden)return;
 pageTurnSound.media.currentTime=0;
 void pageTurnSound.media.play().catch(()=>{});
}
const logoTear=forestTracks[4];
logoTear.media.preload='auto';logoTear.media.load();
let logoTearPlayed=false;
function playLogoTear(){
 if(logoTearPlayed)return;
 logoTearPlayed=true;
 if(!audioPreferences.sfx||document.hidden||reduced.matches)return;
 if(logoTear.gain){
  if(forestAudioContext.state!=='running')return;
  logoTear.gain.gain.setValueAtTime(logoTear.level,forestAudioContext.currentTime);
 }else logoTear.media.volume=logoTear.level;
 // A blocked opening sound is skipped, never replayed late after Enter.
 void logoTear.media.play().catch(()=>{});
}

function startForestAudio(){
 if(!forestAudioStarted){
  forestAudioStarted=true;
  const Context=window.AudioContext||window.webkitAudioContext;
  if(Context){
   forestAudioContext=new Context();
   for(const track of forestTracks){
    track.gain=forestAudioContext.createGain();track.gain.gain.value=0;
    forestAudioContext.createMediaElementSource(track.media).connect(track.gain).connect(forestAudioContext.destination);
    track.media.volume=1;
   }
  }
 }
 if(audioPreferences.sfx||audioPreferences.music)void forestAudioContext?.resume().catch(()=>{});
 syncForestAudio();
}
function syncForestAudio(){
 for(const track of forestTracks){
  const audible=forestAudioStarted&&audioPreferences[track.channel]&&!document.hidden;
  if(!audible){track.media.pause();if(!track.loop)track.media.currentTime=0;}
  const level=audible?track.level:0;
  if(track.gain){
   const time=forestAudioContext.currentTime;
   track.gain.gain.cancelScheduledValues(time);
   track.gain.gain.setTargetAtTime(level,time,.3);
  }else track.media.volume=level;
  if(audible&&track.loop)void track.media.play().catch(()=>{});
 }
}
function playWolfHowl(){
 if(!forestAudioStarted||!audioPreferences.sfx||document.hidden)return;
 const track=forestTracks[2];
 // Let an existing howl finish; turbo must never stack copies of the sound.
 if(!track.media.paused)return;
 track.media.currentTime=0;void track.media.play().catch(()=>{});
}
document.addEventListener('visibilitychange',syncForestAudio);
window.addEventListener('pagehide',()=>forestTracks.forEach(track=>track.media.pause()));
window.addEventListener('pageshow',syncForestAudio);
function refreshAudioPreferences(){
 for(const key of ['music','sfx']){
  const button=$(key+'-toggle'),enabled=audioPreferences[key];
  button.setAttribute('aria-pressed',String(enabled));
  button.textContent=key==='music'?(enabled?'LIGADA':'DESLIGADA'):(enabled?'LIGADOS':'DESLIGADOS');
 }
 $('help').setAttribute('aria-pressed',String(audioPreferences.music));
 $('help').setAttribute('aria-label',audioPreferences.music?'Desligar música':'Ligar música');
 $('help').classList.toggle('music-muted',!audioPreferences.music);
 game.dataset.music=String(audioPreferences.music);game.dataset.sfx=String(audioPreferences.sfx);
 syncForestAudio();
 document.dispatchEvent(new CustomEvent('wolf:audio-preferences',{detail:{...audioPreferences}}));
}
for(const key of ['music','sfx'])$(key+'-toggle').onclick=()=>{
 audioPreferences[key]=!audioPreferences[key];
 if(audioPreferences[key])startForestAudio();
 try{localStorage.setItem('wolf-audio-preferences',JSON.stringify(audioPreferences));}catch{}
 refreshAudioPreferences();
};
refreshAudioPreferences();
const gameMenu=$('game-menu');
const localPreview=['localhost','127.0.0.1','[::1]'].includes(location.hostname)||location.protocol==='file:';
const inviteURL=new URL(location.href);inviteURL.search='';inviteURL.hash='';
$('invite-link').value=localPreview?'':inviteURL.href;
$('invite-link').placeholder=localPreview?'Disponível após publicar o jogo':'';
$('invite-copy').disabled=localPreview;
$('invite-status').textContent=localPreview?'Esta versão está no localhost. O convite ficará disponível com o link publicado.':'';
$('menu-open').onclick=()=>openBook(0);
$('menu-close').onclick=()=>gameMenu.close();
$('menu-rules').onclick=()=>turnBook(1);
const bookPages=[...gameMenu.querySelectorAll('[data-book-page]')];
let bookPage=0,bookTurning=false;
function renderBookPage(){
 bookPages.forEach((page,index)=>{page.hidden=index!==bookPage;if(index===bookPage)page.scrollTop=0;});
 $('book-page-number').textContent=`${bookPage+1} / ${bookPages.length}`;
 $('book-prev').disabled=bookPage===0;$('book-next').disabled=bookPage===bookPages.length-1;
}
let bookOpeningId=0;
async function openBook(page=0){
 if(gameMenu.open)return;
 const openingId=++bookOpeningId;
 bookPage=page;renderBookPage();gameMenu.classList.add('book-opening');
 const cover=gameMenu.querySelector('.book-cover');
 openGameDialog(gameMenu);
 await animate(gameMenu,[{transform:'scale(.3)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:420,easing:'cubic-bezier(.2,.75,.2,1)'});
 if(!gameMenu.open||openingId!==bookOpeningId)return;
 gameMenu.classList.add('book-unfolding');
 await animate(cover,[{transform:'perspective(900px) rotateY(0deg)',opacity:1},{transform:'perspective(900px) rotateY(-105deg)',opacity:0}],{duration:560,easing:'cubic-bezier(.3,.1,.2,1)'});
 if(openingId!==bookOpeningId)return;
 gameMenu.classList.remove('book-opening','book-unfolding');
 if(gameMenu.open)$('menu-title').focus({preventScroll:true});
}
gameMenu.addEventListener('close',()=>{bookOpeningId++;gameMenu.classList.remove('book-opening','book-unfolding');});
async function turnBook(next){
 if(bookTurning||next<0||next>=bookPages.length||next===bookPage)return;
 bookTurning=true;const direction=next>bookPage?1:-1;
 playBookPageTurn();
 const leaf=$('book-leaves');
 try{
  await animate(leaf,[{transform:'perspective(700px) rotateY(0deg)',opacity:1},{transform:`perspective(700px) rotateY(${-direction*65}deg)`,opacity:0}],{duration:160,easing:'ease-in'});
  bookPage=next;renderBookPage();
  await animate(leaf,[{transform:`perspective(700px) rotateY(${direction*65}deg)`,opacity:0},{transform:'perspective(700px) rotateY(0deg)',opacity:1}],{duration:220,easing:'ease-out'});
 }finally{bookTurning=false;}
}
$('book-prev').onclick=()=>turnBook(bookPage-1);
$('book-next').onclick=()=>turnBook(bookPage+1);
$('invite-copy').onclick=async()=>{
 try{await navigator.clipboard.writeText($('invite-link').value);$('invite-status').textContent='Link copiado! Envie para seu amigo.';}
 catch{$('invite-link').focus();$('invite-link').select();$('invite-status').textContent='Selecione e copie o link acima.';}
};

// Native modal accessibility, positioned inside the mobile game rather than the desktop.
function positionGameDialog(dialog){
 const rect=game.getBoundingClientRect();
 const viewport=window.visualViewport;
 const viewLeft=viewport?.offsetLeft||0,viewTop=viewport?.offsetTop||0;
 const viewWidth=viewport?.width||window.innerWidth,viewHeight=viewport?.height||window.innerHeight;
 const left=Math.max(rect.left,viewLeft)+12;
 const right=Math.min(rect.right,viewLeft+viewWidth)-12;
 const top=Math.max(rect.top,viewTop)+12;
 const bottom=Math.min(rect.bottom,viewTop+viewHeight)-12;
 dialog.style.left=`${left}px`;dialog.style.top=`${top}px`;
 dialog.style.width=`${Math.max(0,right-left)}px`;
 dialog.style.maxHeight=`${Math.max(0,bottom-top)}px`;
 if(dialog===gameMenu){
  const height=Math.min(Math.max(0,right-left)*4/3,Math.max(0,bottom-top));
  dialog.style.height=`${height}px`;dialog.style.top=`${top+Math.max(0,(bottom-top-height)/2)}px`;
 }
}
function openGameDialog(dialog){positionGameDialog(dialog);dialog.showModal();positionGameDialog(dialog);}
function repositionGameDialogs(){for(const dialog of document.querySelectorAll('dialog[open]'))positionGameDialog(dialog);}
window.addEventListener('resize',repositionGameDialogs);
window.addEventListener('scroll',repositionGameDialogs,{passive:true});
window.visualViewport?.addEventListener('resize',repositionGameDialogs);
window.visualViewport?.addEventListener('scroll',repositionGameDialogs);
new ResizeObserver(repositionGameDialogs).observe(game);
