// RGB and its precomputed matte share one H.264 frame, including on iOS.
export function createWolfMotion(fallback, host) {
 const canvas=document.createElement('canvas');canvas.width=448;canvas.height=498;
 canvas.className='wolf-reference wolf-motion';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false});
 if(!gl||matchMedia('(prefers-reduced-motion: reduce)').matches||navigator.connection?.saveData)return null;
 fallback.after(canvas);
 fallback.src='../assets/runtime/wolf-idle-motion-poster-v1.webp';fallback.classList.add('wolf-motion-poster');
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 uv;void main(){uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);gl_Position=vec4(p,0.,1.);}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 uv;uniform sampler2D a;uniform sampler2D b;uniform float blend;vec4 unpack(sampler2D t){vec3 c=texture2D(t,vec2(uv.x*.5,uv.y)).rgb;float m=texture2D(t,vec2(.5+uv.x*.5,uv.y)).r;return vec4(c*m,m);}void main(){vec4 c=mix(unpack(a),unpack(b),blend);gl_FragColor=vec4(c.rgb/max(c.a,.001),c.a);}'));
 gl.linkProgram(program);gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const pos=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
 gl.uniform1i(gl.getUniformLocation(program,'a'),0);gl.uniform1i(gl.getUniformLocation(program,'b'),1);
 const blend=gl.getUniformLocation(program,'blend');
 const urls={idle:'../assets/runtime/wolf-idle-motion-v1.mp4',howl:'../assets/runtime/wolf-howl-motion-v1.mp4'};
 const clips=Object.fromEntries(Object.entries(urls).map(([name,src])=>{
  const video=document.createElement('video');video.src=src;video.preload='none';video.playsInline=true;video.muted=true;video.loop=name==='idle';
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  return [name,{video,texture,gain:null}];
 }));
 let failed=false,running=false,current='idle',transition=null,token=0,frame=0,last=0,audioEnabled=false,context=null;
 function fail(error){
  failed=true;running=false;token++;transition=null;cancelAnimationFrame(frame);
  for(const c of Object.values(clips))c.video.pause();
  canvas.hidden=true;fallback.style.visibility='';host.dataset.wolfMotion='fallback';
  if(error)host.dataset.wolfMotionError=error.name||'MediaError';
 }
 for(const c of Object.values(clips))c.video.addEventListener('error',()=>fail(c.video.error));
 const volume=(name,value)=>{const c=clips[name];const level=value*(name==='howl'?.14:.22)*(audioEnabled&&!document.hidden?1:0);if(c.gain)c.gain.gain.setTargetAtTime(level,context.currentTime,.025);};
 function draw(time){
  if(!running||document.hidden)return;
  frame=requestAnimationFrame(draw);if(time-last<32)return;last=time;
  const from=transition?.from||current,to=transition?.to||current;
  host.dataset.wolfMotionTime=clips[to].video.currentTime.toFixed(1);
  const mix=transition?Math.min(1,(time-transition.start)/280):0;
  if(clips[from].video.readyState<2||clips[to].video.readyState<2)return;
  for(const [index,name] of [from,to].entries()){
   gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,clips[name].texture);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,clips[name].video);
  }
  gl.uniform1f(blend,mix);gl.drawArrays(gl.TRIANGLES,0,6);
  canvas.hidden=false;fallback.style.visibility='hidden';
  volume(from,transition?1-mix:1);if(to!==from)volume(to,mix);
  if(transition&&mix===1){clips[from].video.pause();volume(from,0);current=to;transition=null;host.dataset.wolfMotion=current;}
 }
 async function change(name){
  if(!running)return;
  const request=++token;
  if(transition){clips[transition.from].video.pause();volume(transition.from,0);current=transition.to;transition=null;}
  if(name===current)return;
  const target=clips[name].video;target.currentTime=0;
  try{await target.play();if(request!==token){if(name!==current&&name!==transition?.to)target.pause();return;}transition={from:current,to:name,start:performance.now()};host.dataset.wolfMotion=`${current}-to-${name}`;}
  catch(error){host.dataset.wolfMotionError=error.name;}
 }
 clips.howl.video.addEventListener('ended',()=>void change('idle'));
 function visibility(){
  cancelAnimationFrame(frame);
  if(document.hidden){for(const c of Object.values(clips))c.video.pause();return;}
  if(running){if(transition)transition.start=performance.now();for(const name of new Set([current,transition?.to].filter(Boolean)))void clips[name].video.play().catch(()=>{});frame=requestAnimationFrame(draw);}
 }
 document.addEventListener('visibilitychange',visibility);
 window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);for(const c of Object.values(clips))c.video.pause();});
 window.addEventListener('pageshow',visibility);
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail();});
 return {
  get available(){return !failed;},
  start(audioContext){
   if(running||failed)return;running=true;context=audioContext;
   if(context)for(const c of Object.values(clips)){c.gain=context.createGain();c.gain.gain.value=0;context.createMediaElementSource(c.video).connect(c.gain).connect(context.destination);c.video.muted=false;}
   host.dataset.wolfMotion='idle';clips.howl.video.preload='auto';clips.howl.video.load();
   void clips.idle.video.play().then(()=>{frame=requestAnimationFrame(draw);}).catch(fail);
  },
  sound(enabled){audioEnabled=enabled;if(!enabled)for(const name of Object.keys(clips))volume(name,0);},
  howl(){void change('howl');},idle(){void change('idle');},
 };
}
