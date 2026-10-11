// RGB + matte in one H.264 frame; compatible with mobile video decoders.
export function createBookMotion(dialog){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=682;canvas.className='book-motion';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');dialog.prepend(canvas);
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false});
 if(!gl)return null;
 const make=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);return shader;};
 const program=gl.createProgram();
 gl.attachShader(program,make(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 uv;void main(){uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);gl_Position=vec4(p,0.,1.);}'));
 gl.attachShader(program,make(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 uv;uniform sampler2D t;void main(){vec3 c=texture2D(t,vec2(uv.x*.5,uv.y)).rgb;float a=texture2D(t,vec2(.5+uv.x*.5,uv.y)).r;gl_FragColor=vec4(c,a);}'));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const pos=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
 const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
 for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);
 for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
 const video=document.createElement('video');video.src='../assets/runtime/book-opening-packed-v1.mp4';video.muted=true;video.playsInline=true;video.preload='none';
 let frame=0,finish=null,active=false,pageSound=false;
 function draw(){
  if(!active||document.hidden)return;
  if(video.readyState>=2){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);gl.drawArrays(gl.TRIANGLES,0,6);canvas.hidden=false;dialog.classList.add('book-film-playing');}
  frame=requestAnimationFrame(draw);
 }
 video.addEventListener('ended',()=>finish?.());video.addEventListener('error',()=>finish?.());
 document.addEventListener('visibilitychange',()=>{if(!active)return;cancelAnimationFrame(frame);if(document.hidden)video.pause();else{void video.play().catch(()=>finish?.());draw();}});
 canvas.addEventListener('webglcontextlost',()=>finish?.());
 return {
  async play(onTurn){
   finish?.();dialog.classList.add('book-film');video.currentTime=0;pageSound=false;active=true;
   const final=new Image();final.src='../assets/runtime/book-opening-final-v1-delivery.webp';void final.decode().catch(()=>{});
   const cue=()=>{if(!pageSound&&video.currentTime>=1.2){pageSound=true;onTurn?.();}};
   video.addEventListener('timeupdate',cue);
   return new Promise(resolve=>{
    const timeout=setTimeout(()=>finish?.(),15000);
    finish=()=>{if(!active)return;active=false;clearTimeout(timeout);cancelAnimationFrame(frame);video.pause();video.removeEventListener('timeupdate',cue);canvas.hidden=true;dialog.classList.remove('book-film-playing');finish=null;resolve();};
    void video.play().then(draw).catch(()=>finish?.());
   });
  },stop(){finish?.();}
 };
}
