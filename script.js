const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let renderLayer = []; //씬이랑 UI 배치를 그냥 한 캔버스 내에서 처리하고 싶었음
let raf=null;

const consoleP = document.getElementById('console');

const TILESIZE=5;
const TILEW=TILESIZE;
const TILEH=TILESIZE*1.732050807568877;
const tileViewPivot={
  x:0,
  y:0,
  scale:1,
}
const uiViewPivot={
  
  scale:1,
}

function viewPointToScreenPoint(point,viewType,align){
  //point == [x,y]
  //therfore, point.x=>point[0],point.y=>point[1]
  const result=[0,0];
  switch (viewType){
    case "tile" :
      result[0]=point[0]*tileViewPivot.scale+canvas.width*0.5+tileViewPivot.x;
      result[1]=point[1]*tileViewPivot.scale+canvas.height*0.5+tileViewPivot.y;
      return result;
    case "ui" :
      
      break;
    default:

      break;
  }
}

function isInsidePolygon(x,y,v,isFixed){
  // vertices is list / 221122:polygon?.vertices-->v , v0->v
  if (v?.length==null || v.length===0) return false;
  const v1=[[v[0][1]-v[v.length-1][1],v[v.length-1][0]-v[0][0]]];
  const v2=[[x-v[0][0],y-v[0][1]]];
  const v3=[v1[0][0]*v2[0][0]+v1[0][1]*v2[0][1]];
  for(let i=1;i<v.length;i++){
    v1.push([v[i][1]-v[i-1][1],v[i-1][0]-v[i][0]]);
    v2.push([x-v[i][0],y-v[i][1]]);
    v3.push([v1[i][0]*v2[i][0]+v1[i][1]*v2[i][1]]);
  }
  return (v3.every(v=>v>=0) || v3.every(v=>v<=0));
}
  
function Tile(q,r,s){
  if (q+r+s!==0) return null;
  
  this.q=q;
  this.r=r;
  this.s=s;

  this.adjacents={ //since the canvas has opposite y axis, we need to flip the y axis
    0:null, //north ; -r +s
    1:null, //northeast ; +q -r 
    2:null, //southeast ; +q -s
    3:null, //south ; +r -s
    4:null, //southwest ; -q +r
    5:null //northwest ; -q +s
  };
  
  this.vertices= [[TILEW*2,0],[TILEW,-TILEH],[-TILEW,-TILEH],[-TILEW*2,0],[-TILEW,TILEH],[TILEW,TILEH]];
  this.vertices= this.vertices.map(v=>[v[0]+this.q*3*TILEW,v[1]+(this.s*2+this.q)*TILEH]);
  
  this.draw=function(e){
    ctx.save();
    ctx.translate(canvas.width*0.5+tileViewPivot.x*tileViewPivot.scale,canvas.height*0.5+tileViewPivot.y*tileViewPivot.scale);
    ctx.scale(tileViewPivot.scale,tileViewPivot.scale);

    if (e==null || !isInsidePolygon(e.x,e.y,this.vertices.map(v=>viewPointToScreenPoint(v,"tile")))) ctx.fillStyle="#FFFFFF";
    else ctx.fillStyle="#00FF00";
    ctx.strokeStyle="#000000";
    
    ctx.beginPath();
    ctx.moveTo(this.vertices[0][0],this.vertices[0][1]);
    this.vertices.forEach(v=>ctx.lineTo(v[0],v[1]));
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    
    ctx.restore();
  }
}


const keyEventManager = new function() {
  this.keyPressOrigin = {}
  this.keyPressMap = {
    "moveLeft": "j",
    "moveRight": "l",
    "moveUp": "i",
    "moveDown": "k",
    "action0": "z",
    "escape": "Escape",
  }
  this.keyPressResult = {
    "moveLeft": false,
    "moveRight": false,
    "moveUp": false,
    "moveDown": false,
  }
}();
keyEventManager.setKey = function(action,key) {
  if (action!==undefined && action!==null) this.keyPressMap[action]=key;
}
keyEventManager.keyPressUpdate = function() {
  for (const [key, value] of Object.entries(this.keyPressMap)) {
    if (this.keyPressOrigin[value]) { this.keyPressResult[key] = true; }
    else { this.keyPressResult[key] = false; }
  }
}
window.addEventListener('keydown', e => { keyEventManager.keyPressOrigin[e.key] = true; keyEventManager.keyPressUpdate(); });
window.addEventListener('keyup', e => { keyEventManager.keyPressOrigin[e.key] = false; keyEventManager.keyPressUpdate(); });
window.addEventListener('resize', e => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  //draw();
});
window.addEventListener('mousemove', e => {
  consoleP.textContent='x: ${e.x} y: ${e.y}';
  
});
window.addEventListener('mouseclick',e=>{
  
});
window.addEventListener('wheel',e=>{
  
});

const UI_MainPanel = new function() {
  
}();

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < renderLayer.length; i++) {
    renderLayer[i]?.draw();
  }
  requestAnimationFrame(draw);
}

const tile1=new Tile(0,0,0);
const tile2=new Tile(1,-1,0);
const tile3=new Tile(1,0,-1);
const tile4=new Tile(-1,1,0);