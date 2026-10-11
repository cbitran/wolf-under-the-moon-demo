import { createBookMotion } from './book-motion.js?v=20261011-book-film1';
import { createWolfMotion } from './wolf-motion.js?v=20261011-fallback1';
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

let introStarted=false,releaseIntro;
const introReady=new Promise(resolve=>{releaseIntro=resolve;});
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
   if(document.hidden||!introStarted){openingMorph.pause();return;}
   if(remaining<=0){fail();return;}
   visibleSince=performance.now();timeout=setTimeout(fail,remaining);
   openingMorph.play().then(()=>{entry.dataset.morphPlayback='playing';}).catch(error=>{entry.dataset.morphPlayback=error.name;if(!document.hidden&&!done)fail();});
  };
  document.addEventListener('visibilitychange',syncMorphVisibility);
  cancelOpeningMorph=finish;
  openingMorph.addEventListener('ended',finish,{once:true});
  openingMorph.addEventListener('error',fail,{once:true});
  syncMorphVisibility();
  void introReady.then(syncMorphVisibility);
 });
}
// Decode the actual art and human poster before displaying or starting the morph.
// SVG embedded rasters use data URLs, avoiding partially decoded external SVG images on mobile.
async function decodeOpeningArt(){
 const wide=morphWide.matches;
 const base=entry.querySelector('.opening-art');
 const poster=`../assets/runtime/opening-seedance-head-${wide?'ultra':'standard'}-poster-v2.webp`;
 openingMorph.poster=poster;
 const posterImage=new Image();posterImage.src=poster;
 const layer=entry.querySelector(wide?'.ultra-letter-layer image':'.standard-letter-layer image');
 const embedded=fetch(layer.dataset.artSrc).then(response=>{if(!response.ok)throw new Error('Arte de abertura indisponível');return response.blob();}).then(blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{layer.setAttribute('href',reader.result);resolve();};reader.onerror=reject;reader.readAsDataURL(blob);}));
 const portrait=matchMedia('(max-width:760px) and (max-aspect-ratio:1/1)').matches;
 const backdrop=new Image();
 if(portrait)backdrop.src='../assets/runtime/opening-vertical-expansion-v1.webp';
 await Promise.all([base.decode(),posterImage.decode(),embedded,...(portrait?[backdrop.decode()]:[])]);
 entry.classList.add('art-ready');
 prepareOpeningMorph();
}
const openingVisuals=decodeOpeningArt().catch(error=>{
 console.error(error);entry.classList.add('art-ready');openingMorph.hidden=true;
});
morphWide.addEventListener('change',prepareOpeningMorph);

let turbo=false;
const turboButton=$('turbo'),wolf=document.querySelector('.wolf-reference');
const wolfMotion=createWolfMotion(wolf,game);
const wolfNormal=wolf.getAttribute('src');
const wolfHowl='../assets/runtime/wolf-howl-selected-v7.webp';
const wolfRage='../assets/runtime/wolf-rage-selected-v6.webp';
let wolfReaction=0;
function restoreWolfPose(){
 if(wolfMotion?.available)return;
 wolfReaction++;
 game.dataset.wolfState=turbo?'howl':'idle';
 wolf.src=turbo?wolfHowl:wolfNormal;
 wolf.alt=turbo?'Lobisomem agachado uivando para a lua eclipsada.':'Lobisomem agachado, com olhar feroz e a garra apoiada à frente.';
}
async function showRoundReaction(won){
 if(wolfMotion?.available)return;
 if(!won){restoreWolfPose();return;}
 const reaction=++wolfReaction;
 game.dataset.wolfState='rage';
 wolf.src=wolfRage;
 wolf.alt='Lobisomem enfurecido com o ganho do jogador.';
 // Static poses provide the result mapping until approved motion clips exist.
 await animate(wolf,[{opacity:1},{opacity:1}],{duration:1800},{keepDuration:true});
 if(reaction===wolfReaction)restoreWolfPose();
}

turboButton.onclick=()=>{
 if(busy)return;
 turbo=!turbo;
 syncForestAudio(true);
 turboButton.setAttribute('aria-pressed',String(turbo));
 game.classList.toggle('turbo-active',turbo);
 restoreWolfPose();
 if(wolfMotion?.available){if(turbo)wolfMotion.howl();else wolfMotion.idle();}
 else if(turbo)playWolfHowl();
 else{forestTracks[2].media.pause();forestTracks[2].media.currentTime=0;}
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
 playPointsSound();
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
 game.dataset.phase='spinning';result.textContent='A floresta guarda seus segredos…';$('earned').textContent='—';spin.textContent='RODANDO…';
 try{
  const speed=turbo?.45:1;
  let grid=createGrid();
  draw(grid);
  playCardLanding({grouped:true});
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
   playCardLanding({grouped:true});
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
 finally{busy=false;turboButton.disabled=false;spin.disabled=false;spin.textContent='RODAR';}
}
async function start(){
 turboButton.disabled=true;spin.disabled=true;spin.textContent='CARREGANDO…';busy=true;enter.disabled=true;entryStatus.textContent='Preparando os símbolos…';result.textContent='Preparando os símbolos…';
 const resources=[{label:'Corvo na moldura',src:'../assets/runtime/raven-perched-v1.webp'},{label:'Botão Rodar',src:'../assets/runtime/button-spin-v3.svg'},{label:'Botão Turbo',src:'../assets/runtime/button-turbo-v3.svg'},{label:'Botão de acesso',src:'../assets/runtime/button-square-v3.svg'},{label:'Livro do menu',src:'../assets/runtime/menu-book-v1.webp'},...ART,{label:'Lobisomem enfurecido',src:wolfRage},{label:'Lobisomem uivando',src:wolfHowl},{label:'Floresta sob eclipse',src:'../assets/runtime/forest-eclipse-v1.webp'},{label:'Moldura de madeira',src:'../assets/runtime/grid-wood-frame-v2.webp'},{label:'Botão de madeira',src:'../assets/runtime/button-wood-v2.webp'},{label:'Clareira e caçadores',src:'../assets/runtime/forest-stage-v6-canopy.webp'},{label:'Logo',src:'../assets/runtime/logo-moon-ivory-v5.webp'},{label:'Lobisomem',src:'../assets/runtime/wolf-idle-selected-v5.webp'},{label:'Floresta',src:'../assets/runtime/forest-v1.webp'}];

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
 entryStatus.textContent=introStarted?'Carregamento concluído. Finalizando a animação…':'Toque em Entrar para iniciar a apresentação.';
 // Assets and animation run independently; both must finish before manual entry.
 await openingScratch;
 entryStatus.textContent='Tudo pronto. Toque em Entrar para começar.';
 enter.textContent='ENTRAR';enter.onclick=openGame;enter.disabled=false;
}
let openingScratch=null;
async function scratchAfterMorph(){
 await introReady;
 await openingVisuals;
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
 // Start media inside the actual Enter gesture, before any awaited transition.
 wolfMotion?.start(forestAudioContext);
 enter.textContent='ENTRANDO';
 await openingScratch;
 await animate(entry,[{opacity:1},{opacity:0}],{duration:350,easing:'ease-out',fill:'forwards'});
 entry.hidden=true;openingMorph.pause();game.hidden=false;game.inert=false;document.body.classList.remove('opening-active');
 syncForestAudio(true);
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
    playCardLanding();
   }
  }
 }finally{
  board.classList.remove('cascading');busy=false;spin.disabled=false;turboButton.disabled=false;
  spin.textContent='RODAR';game.dataset.phase='idle';result.textContent='A lua surgiu. Comece a caçada.';
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
void openingVisuals.then(()=>{if(!introStarted&&!introBeginning){enter.textContent='ENTRAR';enter.disabled=false;enter.onclick=beginIntroduction;}});

// Independent music and sound-effect preferences.
const audioPreferences={music:true,sfx:true};
// A fresh visit starts with both channels on; game toggles last for this visit only.
// Intro always enables both channels; game-only preferences apply after Enter.
function audioChannelEnabled(channel){return !entry.hidden||audioPreferences[channel];}
// A real gesture unlocks sound when the browser requires it.
const forestTracks=[
 {src:'../assets/runtime/forest-wind.mp3',level:.12,loop:true,channel:'sfx'},
 {src:'../assets/runtime/forest-searchers.mp3',level:.035,loop:true,channel:'sfx'},
 {src:'../assets/runtime/wolf-howl.mp3',level:.18,loop:false,channel:'sfx'},
 {src:'../assets/runtime/forest-music-loop-v2.mp3',level:.14,loop:true,channel:'music',mode:'normal'},
 {src:'../assets/runtime/logo-claw-tear.mp3',level:.22,loop:false,channel:'sfx'},
 {src:'../assets/runtime/book-page-turn.mp3',level:.12,loop:false,channel:'sfx'},
 {src:'../assets/runtime/ui-click.mp3',level:.12,loop:false,channel:'sfx'},
 {src:'../assets/runtime/turbo-music-loop-v2.mp3',level:.14,loop:true,channel:'music',mode:'turbo'},
 {src:'../assets/runtime/collect-points.mp3',level:.32,loop:false,channel:'sfx'},
 {src:'../assets/runtime/opening-wolf-grunt-v1.mp3',level:.3,loop:false,channel:'sfx',introOnly:true}
].map(config=>{const media=new Audio(config.src);media.loop=config.loop;media.preload='none';media.volume=0;return {...config,media,gain:null};});
let forestAudioStarted=false,forestAudioContext;
const introEffectBytes=Promise.all([2,4,5,6,8,9].map(async index=>{
 const response=await fetch(forestTracks[index].src);
 if(!response.ok)throw new Error('Efeito da introdução indisponível');
 return {index,bytes:await response.arrayBuffer()};
})).catch(error=>{console.warn(error);return [];});
let introEffectsReady=Promise.resolve();
let introBeginning=false;
async function beginIntroduction(){
 if(introStarted||introBeginning)return;
 introBeginning=true;
 enter.disabled=true;enter.textContent='CARREGANDO';
 entryStatus.textContent='Preparando áudio e apresentação…';
 startForestAudio();
 try{
  if(forestAudioContext)await forestAudioContext.resume();
  await introEffectsReady;
  introStarted=true;releaseIntro();
 }catch(error){introBeginning=false;entry.dataset.audioError=error.name;enter.textContent='ENTRAR';enter.disabled=false;}
}
function playBufferedEffect(track,offset=0){
 if(!track.buffer||forestAudioContext?.state!=='running')return false;
 if(track.voice){track.voice.stop();track.voice=null;}
 const voice=forestAudioContext.createBufferSource();voice.buffer=track.buffer;
 voice.connect(track.gain);track.gain.gain.setValueAtTime(track.level,forestAudioContext.currentTime);
 track.voice=voice;voice.onended=()=>{voice.disconnect();if(track.voice===voice)track.voice=null;};
 voice.start(0,Math.min(offset,Math.max(0,track.buffer.duration-.01)));return true;
}
function pauseIntroGrunt(){if(openingGrunt.voice){openingGrunt.voice.stop();openingGrunt.voice=null;}openingGrunt.media.pause();}

function beginWhenOpeningAudioPlays(){
 if(entry.hidden||introStarted||introBeginning||document.hidden)return;
 if(forestAudioContext&&forestAudioContext.state!=='running')return;
 if(forestTracks[7].media.paused||forestTracks[7].media.readyState<3)return;
 void beginIntroduction();
}
forestTracks[7].media.addEventListener('playing',()=>{entry.dataset.musicPlayback='playing';beginWhenOpeningAudioPlays();});
let rewardMusicLevel=1,rewardMusicTimer;
let cardLandingBuffer=null,cardLandingBus=null;
const cardLandingVoices=new Set();
let cardMovement=null;
const cardLandingBytes=fetch('../assets/runtime/card-landing.mp3').then(response=>{
 if(!response.ok)throw new Error('Efeito de queda indisponível');
 return response.arrayBuffer();
}).catch(error=>{console.warn(error);return null;});
function prepareCardLanding(context){
 cardLandingBus=context.createGain();cardLandingBus.gain.value=.065;
 const limiter=context.createDynamicsCompressor();limiter.threshold.value=-15;limiter.knee.value=12;limiter.ratio.value=4;
 cardLandingBus.connect(limiter).connect(context.destination);
 void cardLandingBytes.then(bytes=>bytes?context.decodeAudioData(bytes):null).then(buffer=>{cardLandingBuffer=buffer;}).catch(error=>console.warn('Efeito de queda:',error));
}
function stopCardLandings(){
 for(const voice of cardLandingVoices)voice.stop();
 cardLandingVoices.clear();cardMovement=null;
}
function playCardLanding({grouped=false}={}){
 if(!audioPreferences.sfx||document.hidden||!cardLandingBuffer||forestAudioContext?.state!=='running')return;
 const now=forestAudioContext.currentTime;
 if(grouped&&cardMovement){
  // Retire the previous movement gently; repeated spins never accumulate tails.
  const old=cardMovement;old.gain.gain.cancelScheduledValues(now);
  old.gain.gain.setValueAtTime(old.gain.gain.value,now);
  old.gain.gain.linearRampToValueAtTime(0,now+.02);old.voice.stop(now+.025);
 }
 const voice=forestAudioContext.createBufferSource();voice.buffer=cardLandingBuffer;
 const gain=forestAudioContext.createGain();gain.gain.value=1;
 // Same timbre in normal and Turbo; one movement cue per whole falling group.
 voice.playbackRate.value=1.4;voice.connect(gain).connect(cardLandingBus);cardLandingVoices.add(voice);
 const movement={voice,gain};if(grouped)cardMovement=movement;
 voice.onended=()=>{voice.disconnect();gain.disconnect();cardLandingVoices.delete(voice);if(cardMovement===movement)cardMovement=null;};
 voice.start();
}
const pointsSound=forestTracks[8];
pointsSound.media.preload='auto';pointsSound.media.load();
function playPointsSound(){
 game.dataset.pointsAudio=JSON.stringify({enabled:audioPreferences.sfx,context:forestAudioContext?.state,ready:pointsSound.media.readyState,gain:pointsSound.gain?.gain.value});
 if(!forestAudioStarted||!audioPreferences.sfx||document.hidden)return;
 clearTimeout(rewardMusicTimer);rewardMusicLevel=.5;syncForestAudio();
 rewardMusicTimer=setTimeout(()=>{rewardMusicLevel=1;syncForestAudio();},800);
 if(playBufferedEffect(pointsSound)){game.dataset.pointsAudioResult='playing';return;}
 pointsSound.media.currentTime=0;
 void pointsSound.media.play().then(()=>{game.dataset.pointsAudioResult='playing';}).catch(error=>{game.dataset.pointsAudioResult=error.name;console.warn('Não foi possível reproduzir o efeito de ganho:',error);});
}
pointsSound.media.addEventListener('ended',()=>{game.dataset.pointsAudioResult='ended';});
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
 if(playBufferedEffect(uiClickSound))return;
 uiClickSound.media.currentTime=0;
 void uiClickSound.media.play().catch(()=>{});
}
document.addEventListener('click',event=>{
 // One sound per real activation, including keyboard; delegated .click() calls are silent.
 if(!event.isTrusted||!(event.target instanceof Element))return;
 const control=event.target.closest('button,a[href],[role="button"],input[type="checkbox"],input[type="radio"]');
 if(!control||control.matches(':disabled,[aria-disabled="true"]')||control.closest('[inert]'))return;
 // The effects switch acknowledges both on and off; subsequent actions obey the saved state.
 if(!audioChannelEnabled('sfx')&&control.id!=='sfx-toggle')return;
 setTimeout(playUiClick,0);
},true);
const pageTurnSound=forestTracks[5];
pageTurnSound.media.preload='auto';pageTurnSound.media.load();
function playBookPageTurn(){
 if(!forestAudioStarted||!audioPreferences.sfx||document.hidden)return;
 if(playBufferedEffect(pageTurnSound))return;
 pageTurnSound.media.currentTime=0;
 void pageTurnSound.media.play().catch(()=>{});
}
// Small standalone growl follows the transformation, never a full character video.
const openingGrunt=forestTracks[9];
openingGrunt.media.preload='auto';openingGrunt.media.load();
let openingGruntStarted=false,openingGruntFinished=false;
function syncOpeningGrunt(){
 const elapsed=(openingMorph.currentTime-2)/openingMorph.playbackRate;
 if(entry.hidden||openingMorph.hidden||openingMorph.ended||elapsed>=1.45){
  openingGrunt.media.pause();
  if(elapsed>=1.45||entry.hidden)openingGruntFinished=true;
  return;
 }
 if(document.hidden||openingMorph.paused){openingGrunt.media.pause();return;}
 if(elapsed<0||openingGruntFinished||reduced.matches)return;
 // Browsers requiring a gesture must not replay this cue after the morph is over.
 if(!forestAudioStarted||(forestAudioContext&&forestAudioContext.state!=='running'))return;
 if(openingGrunt.voice||(openingGruntStarted&&!openingGrunt.media.paused))return;
 openingGruntStarted=true;
 if(playBufferedEffect(openingGrunt,Math.max(0,elapsed))){entry.dataset.gruntPlayback='playing';return;}
 openingGrunt.media.currentTime=Math.max(0,elapsed);
 if(openingGrunt.gain)openingGrunt.gain.gain.setValueAtTime(openingGrunt.level,forestAudioContext.currentTime);
 else openingGrunt.media.volume=openingGrunt.level;
 void openingGrunt.media.play().then(()=>{entry.dataset.gruntPlayback='playing';}).catch(error=>{entry.dataset.gruntPlayback=error.name;openingGruntStarted=false;});
}
openingMorph.addEventListener('timeupdate',syncOpeningGrunt);
openingMorph.addEventListener('playing',syncOpeningGrunt);
openingMorph.addEventListener('pause',pauseIntroGrunt);
openingMorph.addEventListener('ended',()=>{openingGruntFinished=true;openingGrunt.media.pause();});

const logoTear=forestTracks[4];
logoTear.media.preload='auto';logoTear.media.load();
let logoTearPlayed=false;
function playLogoTear(){
 if(logoTearPlayed)return;
 logoTearPlayed=true;
 if(!audioChannelEnabled('sfx')||document.hidden||reduced.matches)return;
 if(logoTear.gain){
  if(forestAudioContext.state!=='running')return;
  logoTear.gain.gain.setValueAtTime(logoTear.level,forestAudioContext.currentTime);
 }else logoTear.media.volume=logoTear.level;
 if(playBufferedEffect(logoTear)){entry.dataset.scratchPlayback='playing';return;}
 void logoTear.media.play().catch(()=>{});
}

function startForestAudio(){
 if(!forestAudioStarted){
  forestAudioStarted=true;
  const Context=window.AudioContext||window.webkitAudioContext;
  if(Context){
   forestAudioContext=new Context();
   forestAudioContext.addEventListener('statechange',()=>{
    entry.dataset.audioContext=forestAudioContext.state;
    if(forestAudioContext.state==='running'){syncForestAudio();syncOpeningGrunt();beginWhenOpeningAudioPlays();}
   });
   introEffectsReady=introEffectBytes.then(items=>Promise.all(items.map(async ({index,bytes})=>{forestTracks[index].buffer=await forestAudioContext.decodeAudioData(bytes);}))).catch(error=>console.warn(error));
   prepareCardLanding(forestAudioContext);
   for(const track of forestTracks){
    track.gain=forestAudioContext.createGain();track.gain.gain.value=0;
    forestAudioContext.createMediaElementSource(track.media).connect(track.gain).connect(forestAudioContext.destination);
    track.media.volume=1;
   }
  }
 }
 if(audioChannelEnabled('sfx')||audioChannelEnabled('music'))void forestAudioContext?.resume().catch(()=>{});
 syncForestAudio();
 // Unlock each ambient element during the gesture, including the game's normal track.
 if(navigator.userActivation?.isActive)for(const track of forestTracks.filter(t=>t.loop)){
  void track.media.play().then(()=>syncForestAudio()).catch(error=>{game.dataset.audioUnlockError=error.name;});
 }
}
function syncForestAudio(fadeMusic=false){
 // DOM event listeners also call this function; only an explicit true requests a crossfade.
 const crossfade=fadeMusic===true;
 wolfMotion?.sound(entry.hidden&&audioPreferences.sfx&&!document.hidden);
 if(!audioPreferences.sfx||document.hidden)stopCardLandings();
 for(const track of forestTracks){
  clearTimeout(track.pauseTimer);
  const enabled=forestAudioStarted&&audioChannelEnabled(track.channel)&&!document.hidden;
  const selected=track.channel==='music'
   ?track.mode===(!entry.hidden||turbo?'turbo':'normal')
   :track.introOnly?!entry.hidden:!track.loop||entry.hidden;
  const audible=enabled&&selected;
  const fadingOut=crossfade&&enabled&&!selected&&track.gain&&!track.media.paused;
  if(!audible&&!fadingOut){track.media.pause();if(!track.loop)track.media.currentTime=0;}
  const level=audible?track.level*(track.channel==='music'?rewardMusicLevel:1):0;
  if(track.gain){
   const time=forestAudioContext.currentTime;
   const gain=track.gain.gain;
   if(typeof gain.cancelAndHoldAtTime==='function')gain.cancelAndHoldAtTime(time);
   else{const current=gain.value;gain.cancelScheduledValues(time);gain.setValueAtTime(current,time);}
   if(crossfade&&track.channel==='music'&&enabled)gain.linearRampToValueAtTime(level,time+.8);
   else gain.setTargetAtTime(level,time,.3);
  }else track.media.volume=level;
  if(fadingOut)track.pauseTimer=setTimeout(()=>track.media.pause(),850);
  if(audible&&track.loop)void track.media.play().catch(error=>{if(track.channel==='music')entry.dataset.musicPlayback=error.name;});
 }
}
function playWolfHowl(){
 if(!forestAudioStarted||!audioPreferences.sfx||document.hidden)return;
 const track=forestTracks[2];
 if(playBufferedEffect(track))return;
 // Reuse one player: every Turbo activation starts one howl without stacking.
 track.media.pause();
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
 refreshAudioPreferences();
};
refreshAudioPreferences();
// Opening soundtrack runs alongside loading; playback policy may require a real gesture.
function unlockOpeningAudio(event){
 if(!event.isTrusted)return;
 // Retry silently on ordinary interaction; never block the intro behind a prompt.
 startForestAudio();
 if(!entry.hidden)syncOpeningGrunt();
}
document.addEventListener('pointerup',unlockOpeningAudio,{passive:true});
document.addEventListener('keydown',unlockOpeningAudio);
// Try on every browser; retain the existing Enter fallback only if playback is blocked.
startForestAudio();
const gameMenu=$('game-menu');
const bookMotion=createBookMotion(gameMenu);
const localPreview=['localhost','127.0.0.1','[::1]'].includes(location.hostname)||location.protocol==='file:';
const inviteURL=new URL(location.href);inviteURL.search='';inviteURL.hash='';
$('invite-link').value=localPreview?'':inviteURL.href;
$('invite-link').placeholder=localPreview?'Disponível após publicar o jogo':'';
$('invite-copy').disabled=localPreview;
$('invite-status').textContent='';
$('menu-open').onclick=()=>openBook(0);
$('menu-close').onclick=()=>gameMenu.close();
$('menu-rules').onclick=()=>turnBook(1);
const bookPages=[...gameMenu.querySelectorAll('[data-book-page]')];
let bookPage=0,bookTurning=false;
function updateBookScroll(){
 const page=bookPages[bookPage],track=$('book-scroll-track'),thumb=$('book-scroll-thumb');
 const overflow=page.scrollHeight-page.clientHeight;
 const scrollable=page.clientHeight>0&&overflow>2;
 track.hidden=!scrollable;
 $('book-scroll-hint').classList.toggle('has-more',scrollable&&page.scrollTop<overflow-2);
 if(!scrollable)return;
 const rail=track.clientHeight;
 const height=Math.min(rail,Math.max(24,rail*page.clientHeight/page.scrollHeight));
 thumb.style.height=`${height}px`;
 thumb.style.transform=`translateY(${(rail-height)*Math.max(0,Math.min(1,page.scrollTop/overflow))}px)`;
}
for(const page of bookPages)page.addEventListener('scroll',updateBookScroll,{passive:true});
const bookScrollObserver=new ResizeObserver(updateBookScroll);
for(const page of bookPages)bookScrollObserver.observe(page);

function renderBookPage(){
 $('menu-rules').hidden=bookPage!==0;
 $('book-scroll-hint').hidden=bookPage===0;
 bookPages.forEach((page,index)=>{page.hidden=index!==bookPage;if(index===bookPage)page.scrollTop=0;});
 $('book-page-number').textContent=`${bookPage+1} / ${bookPages.length}`;
 $('book-prev').disabled=bookPage===0;$('book-next').disabled=bookPage===bookPages.length-1;
 requestAnimationFrame(updateBookScroll);
}
let bookOpeningId=0;
async function openBook(page=0){
 if(gameMenu.open)return;
 const openingId=++bookOpeningId;
 bookPage=page;renderBookPage();gameMenu.classList.add('book-opening');
 gameMenu.querySelector('.book-content').inert=true;
 if(bookMotion&&!reduced.matches)gameMenu.classList.add('book-film');
 const cover=gameMenu.querySelector('.book-cover');
 openGameDialog(gameMenu);
 await animate(gameMenu,[{transform:'scale(.3)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:420,easing:'cubic-bezier(.2,.75,.2,1)'});
 if(!gameMenu.open||openingId!==bookOpeningId)return;
 if(bookMotion&&!reduced.matches){
  await bookMotion.play(playBookPageTurn);
 }else{
  gameMenu.classList.add('book-unfolding');
  await animate(cover,[{transform:'perspective(900px) rotateY(0deg)',opacity:1},{transform:'perspective(900px) rotateY(-105deg)',opacity:0}],{duration:560,easing:'cubic-bezier(.3,.1,.2,1)'});
 }
 if(openingId!==bookOpeningId)return;
 gameMenu.classList.remove('book-opening','book-unfolding');
 gameMenu.querySelector('.book-content').inert=false;
 if(gameMenu.open)$('menu-title').focus({preventScroll:true});
}
gameMenu.addEventListener('close',()=>{bookOpeningId++;bookMotion?.stop();gameMenu.querySelector('.book-content').inert=false;gameMenu.classList.remove('book-opening','book-unfolding');});
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
 if(dialog===gameMenu&&viewWidth<=760){
  // The book uses the phone's available area independently of the narrower game.
  const width=Math.max(0,Math.min(480,viewWidth-16,(viewHeight-16)*.75));
  const height=width*4/3;
  dialog.style.left=`${viewLeft+(viewWidth-width)/2}px`;
  dialog.style.top=`${viewTop+(viewHeight-height)/2}px`;
  dialog.style.width=`${width}px`;dialog.style.height=`${height}px`;
  dialog.style.maxHeight=`${height}px`;return;
 }
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
