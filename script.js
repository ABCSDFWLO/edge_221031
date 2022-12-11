const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let raf = null;

const consoleP = document.getElementById('console');

const SQRT3 = 1.732050807568877;
const TILESIZE = 5;
const TILEW = TILESIZE;
const TILEH = TILESIZE * SQRT3;
const tileViewPivot = {
  x: 0,
  y: 0,
  scale: 1,
}
let uiScale = 1;


const renderManager = (function() {
  var renderLayer=[];
  //closure라는 거 생각보다 마법같네용!
  return {
    add:function(obj,layer){
      if (!Array.isArray(renderLayer[layer])) renderLayer[layer]=[];
      renderLayer[layer].push(obj);
    },
    remove:function(obj){
      let rid=-1;
      for(let i=0;i<renderLayer.length;i++){
        if(Array.isArray(renderLayer[i]))renderLayer[i].forEach(e=>{
          if(e===obj) rid=renderLayer[i].indexOf(e);
        });
        if(rid>-1){
          renderLayer.splice(rid,1);
          i=renderLayer.length;
        }
      }
      return rid;
    },
    drawAll:function(){
      for(let i=0;i<renderLayer.length;i++){
        if(Array.isArray(renderLayer[i]))renderLayer[i].forEach(e=>{
          e.draw();
        });
      }
    },
    clear:function(){
      renderLayer=[];
    }
  }
})();

const inputManager = new function() {
  this.keyPressOrigin = {};
  this.keyPressMap = {
    "north": "w",
    "northeast": "e",
    "northwest": "q",
    "south": "s",
    "southeast": "d",
    "southwest": "a",
    "left": "ArrowLeft",
    "right": "ArrowRight",
    "up": "ArrowUp",
    "down": "ArrowDown",
    "select": "Space",
    "escape": "Escape", //system
    "moreinfo":"Tab"
  };
  this.keyPressResult = { };
  this.mousePosition={
    x:0, y:0,
  };
  this.mouseDown={
    initx:0,inity:0,isDown:false,
  };
}();
inputManager.setKey = function(action, key) {
  if (action !== undefined && action !== null) this.keyPressMap[action] = key;
}
inputManager.keyPressUpdate = function() {
  for (const [key, value] of Object.entries(this.keyPressMap)) {
    if (this.keyPressOrigin[value]) { this.keyPressResult[key] = true; }
    else { this.keyPressResult[key] = false; }
  }
}
const MapGenerator = new function() {
  this.footstep = function(min, max, tries) {
    let taskQueue = [];
    let tempQueue = [];
    const initTile = new Tile(0, 0, 0);
    TileManager.tiles[0] = initTile;
    taskQueue.push(initTile);
    for (let i = 0; i<tries; i++) {
      while (taskQueue.length > 0) {
        const tempTile = taskQueue.pop();
        const jj = Math.trunc(Math.random() * (max - min + 1) + 6 - max);
        const dirList = [0, 1, 2, 3, 4, 5];
        for (let j = 0; j<jj; j++) {
          dirList.splice(Math.trunc(Math.random() * dirList.length), 1);
        }
        dirList.forEach(v => {
          switch (v) {
            case 0:
              if (TileManager.tiles[tempTile.q * 1024 + tempTile.r - 1] == null) {
                const newTile = new Tile(tempTile.q, tempTile.r - 1, tempTile.s + 1);
                TileManager.tiles[tempTile.q * 1024 + tempTile.r - 1] = newTile;
                tempQueue.push(newTile);
              }
              break;
            case 1:
              if (TileManager.tiles[(tempTile.q + 1) * 1024 + tempTile.r - 1] == null) {
                const newTile = new Tile(tempTile.q + 1, tempTile.r - 1, tempTile.s);
                TileManager.tiles[(tempTile.q + 1) * 1024 + tempTile.r - 1] = newTile;
                tempQueue.push(newTile);
              }
              break;
            case 2:
              if (TileManager.tiles[(tempTile.q + 1) * 1024 + tempTile.r] == null) {
                const newTile = new Tile(tempTile.q + 1, tempTile.r, tempTile.s - 1);
                TileManager.tiles[(tempTile.q + 1) * 1024 + tempTile.r] = newTile;
                tempQueue.push(newTile);
              }
              break;
            case 3:
              if (TileManager.tiles[tempTile.q * 1024 + tempTile.r + 1] == null) {
                const newTile = new Tile(tempTile.q, tempTile.r + 1, tempTile.s - 1);
                TileManager.tiles[tempTile.q * 1024 + tempTile.r + 1] = newTile;
                tempQueue.push(newTile);
              }
              break;
            case 4:
              if (TileManager.tiles[(tempTile.q - 1) * 1024 + tempTile.r + 1] == null) {
                const newTile = new Tile(tempTile.q - 1, tempTile.r + 1, tempTile.s);
                TileManager.tiles[(tempTile.q - 1) * 1024 + tempTile.r + 1] = newTile;
                tempQueue.push(newTile);
              }
              break;
            case 5:
              if (TileManager.tiles[(tempTile.q - 1) * 1024 + tempTile.r] == null) {
                const newTile = new Tile(tempTile.q - 1, tempTile.r, tempTile.s + 1);
                TileManager.tiles[(tempTile.q - 1) * 1024 + tempTile.r] = newTile;
                tempQueue.push(newTile);
              }
              break;
          }
        });
      }
      taskQueue=tempQueue;
      tempQueue=[];
    }
  }
}();
const TileManager = new function() {
  this.tiles = {};
  this.initialize=function(){
    Object.values(this.tiles).forEach(v=>{
      v.adjacents[0]=this.tiles[v.q * 1024 + v.r - 1]?this.tiles[v.q * 1024 + v.r - 1]:null;
      v.adjacents[1]=this.tiles[(v.q + 1) * 1024 + v.r - 1]?this.tiles[(v.q + 1) * 1024 + v.r - 1]:null;
      v.adjacents[2]=this.tiles[(v.q + 1) * 1024 + v.r]?this.tiles[(v.q + 1) * 1024 + v.r]:null;
      v.adjacents[3]=this.tiles[v.q * 1024 + v.r + 1]?this.tiles[v.q * 1024 + v.r + 1]:null;
      v.adjacents[4]=this.tiles[(v.q - 1) * 1024 + v.r + 1]?this.tiles[(v.q - 1) * 1024 + v.r + 1]:null;
      v.adjacents[5]=this.tiles[(v.q - 1) * 1024 + v.r]?this.tiles[(v.q - 1) * 1024 + v.r]:null;
      renderManager.add(v,1);
    });
  }
  //q*1024 + r == index
  this.getTile = function(q, r, s) {
    if (q + r + s !== 0) return null;
    else return this.tiles[q*1024+r]??null;
  }
}();




function viewPointToScreenPoint(point, viewType, align) {
  //point == [x,y]
  //therfore, point.x=>point[0],point.y=>point[1]
  const result = [0, 0];
  switch (viewType) {
    case "tile":
      result[0] = (point[0] + tileViewPivot.x) * tileViewPivot.scale + canvas.width * 0.5 ;
      result[1] = (point[1] + tileViewPivot.y) * tileViewPivot.scale + canvas.height * 0.5;
      return result;
    case "ui":
      if (align?.upper == null) return null;
      result[0] = point[0];
      result[1] = point[1];
      let al = align;
      while (al.upper !== canvas) {
        result[0] += al.upper.align[al.x];
        result[1] += al.upper.align[al.y];
        al = al.upper.align;
      }
      result[0] *= uiScale;
      result[1] *= uiScale;
      switch (al.x) {
        case "xcenter":
          result[0] += canvas.width * 0.5;
          break;
        case "right":
          result[0] += canvas.width;
          break;
      }
      switch (al.y) {
        case "ycenter":
          result[1] += canvas.height * 0.5;
          break;
        case "bottom":
          result[1] += canvas.height;
          break;
      }
      return result;
    default:

      break;
  }
}
function isInsidePolygon(x, y, v) {
  // vertices is list / 221122:polygon?.vertices-->v , v0->v
  if (v?.length == null || v.length === 0) return false;
  const v1 = [[v[0][1] - v[v.length - 1][1], v[v.length - 1][0] - v[0][0]]];
  const v2 = [[x - v[0][0], y - v[0][1]]];
  const v3 = [v1[0][0] * v2[0][0] + v1[0][1] * v2[0][1]];
  for (let i = 1; i < v.length; i++) {
    v1.push([v[i][1] - v[i - 1][1], v[i - 1][0] - v[i][0]]);
    v2.push([x - v[i][0], y - v[i][1]]);
    v3.push([v1[i][0] * v2[i][0] + v1[i][1] * v2[i][1]]);
  }
  return (v3.every(v => v >= 0) || v3.every(v => v <= 0));
}
function isInsideCircumcircle(ax,ay,bx,by,cx,cy,x,y){
  sx=[[ax*ax+ay*ay],]
}

function Tile(q, r, s) {
  if (q + r + s !== 0) return null;

  this.q = q;
  this.r = r;
  this.s = s;

  this.adjacents = { //since the canvas has opposite y axis, we need to flip the y axis
    0: null, //north ; -r +s
    1: null, //northeast ; +q -r 
    2: null, //southeast ; +q -s
    3: null, //south ; +r -s
    4: null, //southwest ; -q +r
    5: null //northwest ; -q +s
  };

  this.vertices = [[TILEW * 2, 0], [TILEW, -TILEH], [-TILEW, -TILEH], [-TILEW * 2, 0], [-TILEW, TILEH], [TILEW, TILEH]];
  this.vertices = this.vertices.map(v => [v[0] + this.q * 3 * TILEW, v[1] + (this.s * 2 + this.q) * TILEH]);

  this.draw = function(e) {
    ctx.save();
    ctx.translate(canvas.width * 0.5 + tileViewPivot.x * tileViewPivot.scale, canvas.height * 0.5 + tileViewPivot.y * tileViewPivot.scale);
    ctx.scale(tileViewPivot.scale, tileViewPivot.scale);

    if (e == null || !isInsidePolygon(e.x, e.y, this.vertices.map(v => viewPointToScreenPoint(v, "tile")))) ctx.fillStyle = "#AAAAAA";
    else ctx.fillStyle = "#00FF00";
    ctx.strokeStyle = "#000000";

    ctx.beginPath();
    ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
    this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
const ui_mainPanel = new function() {
  this.align = {
    upper: canvas,
    x: "xcenter",
    y: "bottom",
    "left": -140,
    "right": 140,
    "top": -65 * SQRT3,
    "bottom": 0,
    "xcenter": 0,
    "ycenter": -32.5,
  };

  this.originVertices = [[115, 0], [140, -25 * SQRT3], [100, -65 * SQRT3], [-100, -65 * SQRT3], [-140, -25 * SQRT3], [-115, 0]];

  this.draw = function(e) {
    ctx.save();
    //ctx.scale(uiScale,uiScale);

    this.vertices = this.originVertices.map(v => viewPointToScreenPoint(v, "ui", this.align));

    if (e == null || !isInsidePolygon(e.x, e.y, this.vertices)) ctx.fillStyle = "#FFFFFF";
    else ctx.fillStyle = "#00FF00";
    ctx.strokeStyle = "#000000";

    ctx.beginPath();
    ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
    this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    ctx.restore();
  }

  renderManager.add(this,10);
}();
const ui_mainPanel_playerSPBar = new function() {
  this.align = {
    upper: ui_mainPanel,
    x: "xcenter",
    y: "top",
    "left": -105,
    "right": 105,
    "top": 5 * SQRT3,
    "bottom": 15 * SQRT3,
    "xcenter": 0,
    "ycenter": 10 * SQRT3,
  };

  this.originVertices = [[95, 5 * SQRT3], [105, 15 * SQRT3], [-105, 15 * SQRT3], [-95, 5 * SQRT3]];

  this.draw = function(e) {
    ctx.save();

    this.vertices = this.originVertices.map(v => viewPointToScreenPoint(v, "ui", this.align));

    if (e == null || !isInsidePolygon(e.x, e.y, this.vertices)) ctx.fillStyle = "#FFFFFF";
    else ctx.fillStyle = "#000000";
    ctx.strokeStyle = "#000000";

    ctx.beginPath();
    ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
    this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    ctx.restore();
  }

  renderManager.add(this,11);
}();
const ui_mainPanel_playerSPValueText = new function() {
  this.align = {
    upper: ui_mainPanel_playerSPBar,
    x: "xcenter",
    y: "bottom",
    //"left":-105,
    //"right":105,
    //"top":5*SQRT3,
    //"bottom":15*SQRT3,
    //"xcenter":0,
    //"ycenter":5*SQRT3,
  };

  this.draw = function() {
    ctx.save();

    const fontSize = 10;
    const text = "5/22";
    const pivot = viewPointToScreenPoint([-fontSize * text.length * 0.275, fontSize * 0.5 - 5 * SQRT3], "ui", this.align);

    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = (fontSize * uiScale) + "px Monospace";
    ctx.fillText(text, pivot[0], pivot[1]);

    ctx.restore();
  }

  renderManager.add(this,12);
}();
const ui_mainPanel_mainButton = new function() {
  this.align = {
    upper: ui_mainPanel,
    x: "xcenter",
    y: "bottom",
    "left": -40,
    "right": 40,
    "top": -45 * SQRT3,
    "bottom": -5 * SQRT3,
    "xcenter": 0,
    "ycenter": -25 * SQRT3,
  };

  this.originVertices = [[20, -5 * SQRT3], [40, -25 * SQRT3], [20, -45 * SQRT3], [-20, -45 * SQRT3], [-40, -25 * SQRT3], [-20, -5 * SQRT3]];

  this.draw = function(e) {
    ctx.save();

    this.vertices = this.originVertices.map(v => viewPointToScreenPoint(v, "ui", this.align));

    if (e == null || !isInsidePolygon(e.x, e.y, this.vertices)) ctx.fillStyle = "#FFFFFF";
    else ctx.fillStyle = "#00FF00";
    ctx.strokeStyle = "#000000";

    ctx.beginPath();
    ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
    this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    ctx.restore();
  }

  renderManager.add(this,11);
}();
const ui_mainPanel_leftUpperButton = new function() {
  this.align = {
    upper: ui_mainPanel,
    x: "xcenter",
    y: "bottom",
    "left": -127.5,
    "right": -30,
    "top": -45 * SQRT3,
    "bottom": -27.5 * SQRT3,
    "xcenter": -87.5,
    "ycenter": -36.25 * SQRT3,
  };

  this.originVertices = [[-30, -45 * SQRT3], [-110, -45 * SQRT3], [-127.5, -27.5 * SQRT3], [-47.5, -27.5 * SQRT3]];

  this.draw = function(e) {
    ctx.save();

    this.vertices = this.originVertices.map(v => viewPointToScreenPoint(v, "ui", this.align));

    if (e == null || !isInsidePolygon(e.x, e.y, this.vertices)) ctx.fillStyle = "#FFFFFF";
    else ctx.fillStyle = "#00FF00";
    ctx.strokeStyle = "#000000";

    ctx.beginPath();
    ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
    this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    ctx.restore();
  }

  renderManager.add(this,11);
}();
const ui_mainPanel_rightUpperButton = new function() {
  this.align = {
    upper: ui_mainPanel,
    x: "xcenter",
    y: "bottom",
    "left": 127.5,
    "right": 30,
    "top": -45 * SQRT3,
    "bottom": -27.5 * SQRT3,
    "xcenter": 87.5,
    "ycenter": -36.25 * SQRT3,
  };

  this.originVertices = [[30, -45 * SQRT3], [110, -45 * SQRT3], [127.5, -27.5 * SQRT3], [47.5, -27.5 * SQRT3]];

  this.draw = function(e) {
    ctx.save();

    this.vertices = this.originVertices.map(v => viewPointToScreenPoint(v, "ui", this.align));

    if (e == null || !isInsidePolygon(e.x, e.y, this.vertices)) ctx.fillStyle = "#FFFFFF";
    else ctx.fillStyle = "#00FF00";
    ctx.strokeStyle = "#000000";

    ctx.beginPath();
    ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
    this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    ctx.restore();
  }

  renderManager.add(this,11);
}();
const ui_mainPanel_leftLowerButton = new function() {
  this.align = {
    upper: ui_mainPanel,
    x: "xcenter",
    y: "bottom",
    "left": -127.5,
    "right": -30,
    "top": -5 * SQRT3,
    "bottom": -22.5 * SQRT3,
    "xcenter": -87.5,
    "ycenter": -13.75 * SQRT3,
  };

  this.originVertices = [[-30, -5 * SQRT3], [-110, -5 * SQRT3], [-127.5, -22.5 * SQRT3], [-47.5, -22.5 * SQRT3]];

  this.draw = function(e) {
    ctx.save();

    this.vertices = this.originVertices.map(v => viewPointToScreenPoint(v, "ui", this.align));

    if (e == null || !isInsidePolygon(e.x, e.y, this.vertices)) ctx.fillStyle = "#FFFFFF";
    else ctx.fillStyle = "#00FF00";
    ctx.strokeStyle = "#000000";

    ctx.beginPath();
    ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
    this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    ctx.restore();
  }

  renderManager.add(this,11);
}();
const ui_mainPanel_rightLowerButton = new function() {
  this.align = {
    upper: ui_mainPanel,
    x: "xcenter",
    y: "bottom",
    "left": 127.5,
    "right": 30,
    "top": -5 * SQRT3,
    "bottom": -22.5 * SQRT3,
    "xcenter": 87.5,
    "ycenter": -13.75 * SQRT3,
  };

  this.originVertices = [[30, -5 * SQRT3], [110, -5 * SQRT3], [127.5, -22.5 * SQRT3], [47.5, -22.5 * SQRT3]];

  this.draw = function(e) {
    ctx.save();

    this.vertices = this.originVertices.map(v => viewPointToScreenPoint(v, "ui", this.align));

    if (e == null || !isInsidePolygon(e.x, e.y, this.vertices)) ctx.fillStyle = "#FFFFFF";
    else ctx.fillStyle = "#00FF00";
    ctx.strokeStyle = "#000000";

    ctx.beginPath();
    ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
    this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    ctx.restore();
  }

  renderManager.add(this,11);
}();

function ui_onTile_SPFrame (obj) {
  if (!obj) return null;
  this.onTileObj=obj;
  
  
  this.draw = function() {
    this.vertices = [ [TILEW*1.5, -TILEH*0.5],[TILEW * 2, 0], [TILEW, TILEH], [-TILEW, TILEH], [-TILEW * 2, 0], [-TILEW*1.5, -TILEH*0.5] ];
    this.vertices = this.vertices.map(v => [v[0] + this.onTileObj.q * 3 * TILEW, v[1] + (this.onTileObj.s * 2 + this.onTileObj.q) * TILEH]);
    
    ctx.save();
    ctx.translate(canvas.width * 0.5 + tileViewPivot.x * tileViewPivot.scale, canvas.height * 0.5 + tileViewPivot.y * tileViewPivot.scale);
    ctx.scale(tileViewPivot.scale, tileViewPivot.scale);
    
    ctx.fillStyle = "#000000";

    ctx.beginPath();
    ctx.arc(this.onTileObj.q * 3 * TILEW,(this.onTileObj.s * 2 + this.onTileObj.q) * TILEH,0.75*TILEH,Math.PI*1.1666666,-Math.PI*0.1666666,true);
    this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  renderManager.add(this,3);
}
function ui_onTile_SPBar (obj) {
  if (!obj) return null;
  this.onTileObj=obj;
  
  
  this.draw = function() {
    this.pivot = [this.onTileObj.q * 3 * TILEW, (this.onTileObj.s * 2 + this.onTileObj.q) * TILEH];
    
    ctx.save();
    ctx.translate(canvas.width * 0.5 + tileViewPivot.x * tileViewPivot.scale, canvas.height * 0.5 + tileViewPivot.y * tileViewPivot.scale);
    ctx.scale(tileViewPivot.scale, tileViewPivot.scale);

    ctx.lineWidth=1.6;
    ctx.strokeStyle = "#FFFFFF";

    ctx.beginPath();
    ctx.arc(this.pivot[0],this.pivot[1],0.875*TILEH,Math.PI*1.15,Math.PI*1.3*(this.onTileObj.sp/this.onTileObj.maxsp)-Math.PI*0.15,true);
    ctx.stroke();

    ctx.restore();
  }

  renderManager.add(this,4);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);  
  renderManager.drawAll();
  console.log(raf);
  raf=window.requestAnimationFrame(draw);
}


canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

MapGenerator.footstep(1,3,30);
TileManager.initialize();


const onTile_flyingFrog=new function(tile){
  this.q=tile.q;
  this.r=tile.r;
  this.s=tile.s;
  this.sp=10;
  this.maxsp=30;
  const sprites = [];
  sprites[0]=new Image();
  sprites[0].src="resources/ontileobjs/flying_frog_1.png";

  this.move=function(dq,dr,ds){
    const moveTile=TileManager.getTile(this.q+dq,this.r+dr,this.s+ds);
    if (moveTile) {
      this.q=moveTile.q;
      this.r=moveTile.r;
      this.s=moveTile.s;
      return 0;
    }else{
      return -1;
    }
      
  }
  
  this.draw = function() {
    ctx.save();
    ctx.translate(canvas.width * 0.5 + tileViewPivot.x * tileViewPivot.scale, canvas.height * 0.5 + tileViewPivot.y * tileViewPivot.scale);
    ctx.scale(tileViewPivot.scale, tileViewPivot.scale);
    
    ctx.drawImage(sprites[0],this.q * 3 * TILEW-TILEH*0.75, (this.s * 2 + this.q) * TILEH-TILEH*0.75,TILEH*1.5,TILEH*1.5);

    ctx.restore();
  }

  renderManager.add(this,2);
}(TileManager.getTile(0,0,0));

const newspf=new ui_onTile_SPFrame(onTile_flyingFrog);
const newspb=new ui_onTile_SPBar(onTile_flyingFrog);



raf=window.requestAnimationFrame(draw);
//const tile1=new Tile(0,0,0);
//const tile2=new Tile(1,-1,0);
//const tile3=new Tile(1,0,-1);
//const tile4=new Tile(-1,1,0);





window.addEventListener('keydown', e => { inputManager.keyPressOrigin[e.key] = true; inputManager.keyPressUpdate(); });
window.addEventListener('keyup', e => { inputManager.keyPressOrigin[e.key] = false; inputManager.keyPressUpdate(); });
window.addEventListener('resize', e => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
window.addEventListener('mousemove', e => {
  consoleP.textContent = `x: ${e.x} y: ${e.y}`;
consoleP.textContent=consoleP.textContent+" "+Object.keys(TileManager.tiles).length;
consoleP.textContent=consoleP.textContent+"\r\n"+tileViewPivot.scale;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  Object.values(TileManager.tiles).forEach(v=>{v.draw(e);});
  
  ui_mainPanel.draw(e);
  ui_mainPanel_playerSPBar.draw(e);
  ui_mainPanel_playerSPValueText.draw();
  ui_mainPanel_mainButton.draw(e);
  ui_mainPanel_leftUpperButton.draw(e);
  ui_mainPanel_rightUpperButton.draw(e);
  ui_mainPanel_leftLowerButton.draw(e);
  ui_mainPanel_rightLowerButton.draw(e);
  onTile_flyingFrog.draw();
  newspf.draw();
  newspb.draw();
});
window.addEventListener('click', e => {
  window.cancelAnimationFrame(raf);
});
window.addEventListener('wheel', e => {

});