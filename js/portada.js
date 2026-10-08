// Portada animada de Launch Studio: el logo entra, la bola estalla y cambia la escena.
// Palabras del centro: MID. Palabras de fondo: BG. Colores: SC.
(function(){
const R=71.1,BX=888.4,BY=572.1,FLOOR=643.2;
const SC=[
 {bg:'#F1F0E8',logo:'#0b0b0b',ball:'#0b0b0b',word:'#D93333',wo:.6},
 {bg:'#D93333',logo:'#F1F0E8',ball:'#F1F0E8',word:'#0b0b0b',wo:.3},
 {bg:'#0b0b0b',logo:'#F1F0E8',ball:'#D93333',word:'#D93333',wo:.8}];
const MID=['stands','eventos','experiencias de marca','diseños','lanzamientos'];
const BG=['crear','stands','experiencias','diseño','eventos','lanzamientos','marca'];
const D=1.1,LEN=3.05,S0=LEN,S1=LEN+D;   // palabra central, escena del logo, duraciones
const $=id=>document.getElementById(id);
const bg=$('bg'),words=$('words'),r1=$('r1'),r2=$('r2'),flood=$('flood'),logo=$('logo'),ball=$('ball'),mid=$('mid');
mid.setAttribute('x',0);mid.setAttribute('y',0);
let w1=7000,w2=7000,cur=-1;
function measure(){try{w1=r1.getComputedTextLength()/2||w1;w2=r2.getComputedTextLength()/2||w2}catch(e){}}
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(measure);
function setScene(n){
  cur=n;const s=SC[n%3],g=i=>BG[(2*n+i)%7];
  const u1=g(1)+' '+g(2)+' '+g(3)+' ',u2=g(4)+' '+g(5)+' '+g(6)+' ';
  r1.textContent=u1+u1;r2.textContent=u2+u2;measure();
  mid.textContent=MID[(n+4)%5];mid.setAttribute('fill',s.logo);
  bg.setAttribute('fill',s.bg);words.setAttribute('stroke',s.word);words.setAttribute('opacity',s.wo);
  logo.setAttribute('fill',s.logo);
  document.documentElement.style.setProperty('--hero-fg',s.logo);   // la cabecera sigue el color de la escena
}
const cl=x=>Math.min(1,Math.max(0,x)),ease=x=>1-Math.pow(1-cl(x),3),io=x=>{x=cl(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2};
const back=x=>{x=cl(x)-1;return 1+2.70158*x*x*x+1.70158*x*x};
function mix(a,b,k){k=cl(k);const p=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16)),A=p(a),B=p(b);
  return'rgb('+A.map((v,i)=>Math.round(v+(B[i]-v)*k)).join(',')+')'}
function fall(t){
  const g=4200,drop=880,rest=.45;let y=-drop,vy=0,tt=t,imp=0;
  if(t<0)return{y:-drop-300,sq:0};
  for(let n=0;n<12;n++){
    const tf=(-vy+Math.sqrt(vy*vy-2*g*y))/g;
    if(tt<tf)return{y:y+vy*tt+.5*g*tt*tt,sq:imp*Math.exp(-15*tt)};
    tt-=tf;const vi=vy+g*tf;imp=Math.min(.2,vi/9000);vy=-vi*rest;y=0;
    if(-vy<100)break;
  }
  return{y:0,sq:imp*Math.exp(-15*tt)};
}
function putL(dx,dy,sc,sq){logo.setAttribute('transform','translate('+(800+dx)+' '+(FLOOR+dy)+') scale('+sc*(1+sq)+' '+sc*(1-sq)+') translate(-800 '+(-FLOOR)+')')}
function putBall(x,y,sq,r){const rx=r*(1+sq),ry=r*(1-sq);ball.setAttribute('cx',x);ball.setAttribute('cy',y+(r-ry));ball.setAttribute('rx',rx);ball.setAttribute('ry',ry)}

let t0=performance.now(),raf=0;
function draw(now,t){
  const n=t<S0?0:1+Math.floor((t-S0)/S1),u=t<S0?t:(t-S0)%S1,v=u-(n?D:0);
  if(n!==cur)setScene(n);
  const a=SC[n%3],b=SC[(n+1)%3],T=now/1000,dir=n%2?1:-1;
  const p1=(T*250)%w1,p2=(T*190)%w2;
  r1.setAttribute('x',dir<0?-p1:-w1+p1);
  r2.setAttribute('x',dir<0?-w2+p2:-p2);

  // Palabra central: tres entradas distintas, y sale antes de que llegue el logo.
  const k=ease(u/.3),out=cl((u-.85)/.25),m=n%3;
  mid.setAttribute('opacity',n?cl(u/.2)*(1-out):0);
  mid.setAttribute('transform',
    m===0?'translate(800 '+(482+26*(1-k)-24*out)+')':
    m===1?'translate('+(800-90*(1-k)+70*out)+' 482)':
          'translate(800 482) scale('+(.8+.2*back(u/.35)+.08*out)+')');

  // Entrada del logo: cuatro variantes.
  let bx=BX,by=BY,bsq=0;const e=n%4;
  if(e===0){const f=fall(v-.05);putL(0,f.y,1,f.sq);by=BY+f.y;bsq=f.sq}
  else if(e===1){putL(0,760*(1-back(v/.7)),1,0);const f=fall(v-.3);by=BY+f.y;bsq=f.sq}
  else if(e===2){putL(-950*(1-ease(v/.7)),0,1,0);bx=BX+950*(1-ease((v-.2)/1.0))}
  else{putL(0,0,v<=0?0:back(v/.6),0);const f=fall(v-.35);by=BY+f.y;bsq=f.sq}
  if(v<0){bx=-400}

  // Salida de la bola: se queda, salta al centro o rueda a un lado; después estalla.
  const x=(n+Math.floor(n/3))%3,w=v-2.0,q=io(w/.5);
  let fill=a.ball;
  if(w>0){
    fill=mix(a.ball,b.bg,w/.35);
    if(x===0){bsq=.18*Math.sin(cl(w/.5)*Math.PI)}
    else if(x===1){bx=BX+(800-BX)*q;by=BY+(450-BY)*q-150*Math.sin(q*Math.PI)}
    else{bx=BX+470*q*q}
  }
  ball.setAttribute('fill',fill);
  if(w<.5){putBall(bx,by,bsq,R);flood.setAttribute('r',0)}
  else{putBall(bx,by,0,0);flood.setAttribute('cx',bx);flood.setAttribute('cy',by);flood.setAttribute('fill',b.bg);flood.setAttribute('r',R+2100*io((w-.5)/.55))}
}
function frame(now){draw(now,(now-t0)/1000);raf=requestAnimationFrame(frame)}
function start(){cancelAnimationFrame(raf);t0=performance.now();cur=-1;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){draw(0,1.9);return}
  raf=requestAnimationFrame(frame)}
// En pantallas verticales se encuadra más abierto para que quepan el logo y la palabra central.
const svgEl=document.querySelector('.ls-hero svg');
function fit(){const r=svgEl.getBoundingClientRect(),ar=r.width/Math.max(1,r.height);
  if(ar<1.2){const w=1150,h=w/ar;svgEl.setAttribute('viewBox',(800-w/2)+' '+(450-h/2)+' '+w+' '+h)}
  else svgEl.setAttribute('viewBox','0 0 1600 900')}
fit();addEventListener('resize',fit);
start();
})();
