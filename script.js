
import { Delaunay } from "./delaunay.js";

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let raf = null;

const consoleP = document.getElementById('console');
const loadingScreen = document.getElementById('loading');
const ccc = {};

const SQRT3 = 1.732050807568877;
const TILESIZE = 5;
const TILEW = TILESIZE;
const TILEH = TILESIZE * SQRT3;

const sprites = {
  "tile_proto": "resources/tile/tile_p_0.png",
  "ui_ontile_selected": "resources/ui/ontile/selected1.png",
};

const fps = [0, 0];

//▲ consts
//▼ managements

const renderManager = (function() {
  const renderLayer = [];
  const tileViewPivot = {
    x: 0,
    y: 0,
    scale: 0.2,
    MINSCALE: 1,
    MAXSCALE: 50,
  }
  let uiScale = 1;
  return {
    add: function(obj, layer) {
      if (!Array.isArray(renderLayer[layer])) renderLayer[layer] = [];
      renderLayer[layer].push(obj);
    },
    remove: function(obj) {
      let rid = -1;
      for (let i = 0; i < renderLayer.length; i++) {
        if (Array.isArray(renderLayer[i]))
          rid = renderLayer[i].indexOf(obj);
        if (rid > -1) {
          renderLayer[i].splice(rid, 1);
          break;
        }
      }
      return rid;
    },
    drawAll: function() {
      for (let i = 0; i < renderLayer.length; i++) {
        if (Array.isArray(renderLayer[i])) renderLayer[i].forEach(e => {
          e.draw();
        });
      }
    },
    clear: function() {
      renderLayer = [];
    },

    viewPointToScreenPoint: function(point, viewType, align) {
      //point == [x,y]
      //therfore, point.x=>point[0],point.y=>point[1]
      const result = [0, 0];
      switch (viewType) {
        case "tile":
          result[0] = (point[0] + tileViewPivot.x) * tileViewPivot.scale + canvas.width * 0.5;
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
    },
    screenPointToTileViewPoint: function(point) {
      const x = point[0];
      const y = point[1];
      const result = [0, 0, 0];
      result[0] = ((x - canvas.width * 0.5) / tileViewPivot.scale - tileViewPivot.x) / (3 * TILEW);
      result[2] = (((y - canvas.height * 0.5) / tileViewPivot.scale - tileViewPivot.y) / TILEH - result[0]) * 0.5;
      result[1] = -result[0] - result[2];

      return result;
    },
    tileViewPointRound(fq, fr, fs) {
      if (Array.isArray(fq)) {
        fr = fq[1];
        fs = fq[2];
        fq = fq[0];
      }
      let q = Math.round(fq);
      let r = Math.round(fr);
      let s = Math.round(fs);
      const dq = Math.abs(q - fq);
      const dr = Math.abs(r - fr);
      const ds = Math.abs(s - fs);
      if (dq > dr && dq > ds) {
        q = -r - s;
      } else if (ds > dr) {
        s = -q - r;
      } else {
        r = -q - s;
      }
      return [q, r, s];
    },
    tileViewScroll: function(ds, dx, dy) {
      if ((tileViewPivot.scale + ds >= tileViewPivot.MINSCALE && ds < 0) || (tileViewPivot.scale + ds <= tileViewPivot.MAXSCALE && ds > 0)) tileViewPivot.scale += ds;
      if (dx) tileViewPivot.x += dx;
      if (dy) tileViewPivot.y += dy;
    },

    tileVertex: function(q, r, s) {
      const v0 = [[TILEW * 2, 0], [TILEW, -TILEH], [-TILEW, -TILEH], [-TILEW * 2, 0], [-TILEW, TILEH], [TILEW, TILEH]];
      const v1 = v0.map(v => this.viewPointToScreenPoint([v[0] + q * 3 * TILEW, v[1] + (s * 2 + q) * TILEH], "tile"));
      return v1;
    },
    tileSpriteRender: function(q, r, s) {
      const ss = s ?? -q - r;
      const tx = canvas.width * 0.5 + tileViewPivot.x * tileViewPivot.scale;
      const ty = canvas.height * 0.5 + tileViewPivot.y * tileViewPivot.scale;
      const ts = tileViewPivot.scale;
      const x = q * 3 * TILEW - TILEW * 2;
      const y = (ss * 2 + q) * TILEH - TILEH;
      const dx = TILEW * 4;
      const dy = TILEH * 2;
      const rx = tx + x * ts;
      const ry = ty + y * ts;
      return { tx: tx, ty: ty, ts: ts, x: x, y: y, dx: dx, dy: dy, rx: rx, ry: ry };
    },
    isInsidePolygon: function(x, y, v) {
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
    },

    getTileViewPivot: function() {
      return {
        x: tileViewPivot.x,
        y: tileViewPivot.y,
        scale: tileViewPivot.scale,
      }
    },

    zRaycast: function(x, y) {
      const tempLayer = renderLayer.slice(0).reverse();
      for (const i of tempLayer) {
        if (Array.isArray(i)) {
          if (!i[0]?.uid ?? -1 > 0) break;
          for (const j of i) {
            if ((j?.uid ?? -1 > 0) && this.isInsidePolygon(x, y, j.vertices)) {
              return j;
            }
          }
        }
      }
      const tmpqrs = this.tileViewPointRound(this.screenPointToTileViewPoint([x, y]));
      return tm.getTile(tmpqrs[0], tmpqrs[1], tmpqrs[2]);
    },
  }
})();

const inputManager = new function() {
  this.inputConsts = {
    mouseWheelToScreenWheel: -0.005,
  };
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
    "moreinfo": "Tab"
  };
  this.keyPressResult = {};
  this.mouse = {
    x: 0, y: 0,
    prevx: 0, prevy: 0, dprevx: 0, dprevy: 0,
    initx: 0, inity: 0, isDown: 0,
    wdx: 0, wdy: 0, wdz: 0,
  }
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

const mapManager = (function() {
  const enemies = [];
  const mapConsts = [
    {
      VERTEX_NUMBER: 12,
      INIT_MIN_R: 60,
      INIT_MAX_R: 120,
      SEED_RANGE: 4,
      
    },
    {

    },
  ];

  return {
    footstep: function(min, max, tries, seed) {
      let taskQueue = [];
      let tempQueue = [];
      const initTile = new Tile(0, 0, 0, "tile_proto");
      if (Array.isArray(seed)) {
        taskQueue = seed;
      } else {
        tm.setTile(0, 0, 0, initTile);
        taskQueue.push(initTile);
      }
      for (let i = 0; i < tries; i++) {
        while (taskQueue.length > 0) {
          const tempTile = taskQueue.pop();
          const jj = Math.trunc(Math.random() * (max - min + 1) + 6 - max);
          const dirList = [0, 1, 2, 4, 5, 6];
          for (let j = 0; j < jj; j++) {
            dirList.splice(Math.trunc(Math.random() * dirList.length), 1);
          }
          const adjs = tm.tileRelation('adj', tempTile, null);
          dirList.forEach(v => {
            if (!tm.getTile(adjs[v][0], adjs[v][1], adjs[v][2])) {
              const ttile = tm.setTile(adjs[v][0], adjs[v][1], adjs[v][2]);
              tempQueue.push(ttile);
            }
          });
        }
        taskQueue = tempQueue;
        tempQueue = [];
      }
    },
    generate: function(level) {

      const initVertices = []; //seeds
      const tmpdir = [0, 0, 0]; //pillar direction
      for (let i = 0; i < 3; i++) {
        const mmm = Math.trunc(Math.random() * 3);
        i > 1 ? (tmpdir[mmm] === 0 ? i-- : tmpdir[mmm]++) : (tmpdir[mmm] >= 1 ? i-- : tmpdir[mmm]++);
      }
      for (let i = 0; i < mapConsts[level].VERTEX_NUMBER; i++) {
        const tmpq = Math.trunc((Math.random() - 0.5) * mapConsts[level].INIT_MIN_R * 2);
        const tmpmax = Math.min(mapConsts[level].INIT_MAX_R - tmpq, mapConsts[level].INIT_MAX_R);
        const tmpmin = Math.max(-mapConsts[level].INIT_MAX_R - tmpq, -mapConsts[level].INIT_MAX_R);
        const tmpr = Math.trunc((Math.random() * (tmpmax - tmpmin)) + tmpmin);
        const ttmpqrs = [tmpq, tmpr, -tmpq - tmpr];
        const [qq, rr, ss] = [ttmpqrs[tmpdir[0]], ttmpqrs[tmpdir[1]], ttmpqrs[tmpdir[2]]];
        let tmpflag = true;
        for (const j of initVertices) {
          if (j?.q === qq && j?.r === rr) {
            i--;
            tmpflag = false;
            break;
          }
        }
        if (tmpflag) initVertices.push(tm.setTile(qq, rr, ss));
      }
      console.log(tmpdir);
      //▲ hexagonal pillar -> seed

      
      const tmp_StartOrEnd=Math.random()-0.5>0;
      const tmp_StartSeedCoord=
        tmp_StartOrEnd?
        Math.max(...initVertices.map(e=>tmpdir[0]===0?e?.r:e?.q)):
        Math.min(...initVertices.map(e=>tmpdir[0]===0?e?.r:e?.q));
      const tmp_EndSeedCoord=
        (!tmp_StartOrEnd)?
        Math.max(...initVertices.map(e=>tmpdir[0]===0?e?.r:e?.q)):
        Math.min(...initVertices.map(e=>tmpdir[0]===0?e?.r:e?.q));
      let startSeed,endSeed=null;
      //▲ seed classification(structure allocating)

      const tmp_dv=[];
      for (const i of initVertices) tmp_dv.push([i?.q*3*TILEW,(i?.s*2+i?.q)*TILEH]);
      const tmpd = Delaunay.triangulate(tmp_dv);
      const edges = [];
      for (let i = 0; i<tmpd.length;i++){
        switch(i%3){
          case 0:
            (initVertices[tmpd[i+1]]
          case 1:
          case 2:
            tmpd[i-2]
        }
      }
      //▲ delaunay

      //▲ mst

      //▲ bonus (not yet)

      //▲ stroke paths
      
      for (const i of initVertices){
        const widen = tm.tileRelation("range",i,null,mapConsts[level].SEED_RANGE);
        if ((tmpdir[0]===0?i?.r:i?.q)===tmp_StartSeedCoord) startSeed=i;
        if ((tmpdir[0]===0?i?.r:i?.q)===tmp_EndSeedCoord) endSeed=i;
        for (const j of widen) {
          if (!tm.getTile(j[0],j[1],j[2])) tm.setTile(j[0],j[1],j[2]);
        }
      }
      //▲ seed widening
      
    },
  };
})();
const tileManager = (function() {
  //221212 closure implement
  const tiles = {};
  return {
    initialize: function() {
      Object.values(tiles).forEach(v => {
        rm.add(v, 1);
      });
    },
    //q*1024 + r == index
    getTile: function(q, r, s) {
      if (q + r + s !== 0) return null;
      else return tiles[q * 1024 + r] ?? null;
    },
    setTile: function(q, r, s, tile) {
      if (!s) s = -q - r;
      if (q + r + s !== 0) return null;
      if (tile) tiles[q * 1024 + r] = tile;
      else tiles[q * 1024 + r] = new Tile(q, r, s, "tile_proto");
      return tiles[q * 1024 + r];
      //DISCLAIMER:do not call this method except mapGenerator
    },

    tileRelation: function(type, seed, isthis, arg0, arg1, arg2) {
      const result = [];
      switch (type) {
        case 'a':
        case 'adj':
        case 'adjacent':
          arg0 = 1;
        case 'range':
          // arg0:range
          if (isthis) {
            if (Array.isArray(isthis)) {
              if (isthis[0] <= arg0 && isthis[0] >= -arg0 &&
                isthis[1] <= arg0 && isthis[1] >= -arg0 &&
                isthis[2] <= arg0 && isthis[2] >= -arg0) {
                return true;
              } else {
                return false;
              }
            } else if (isthis instanceof Tile) {
              if (isthis.q <= arg0 && isthis.q >= -arg0 &&
                isthis.r <= arg0 && isthis.r >= -arg0 &&
                isthis.s <= arg0 && isthis.s >= -arg0) {
                return true;
              } else {
                return false;
              }
            } else {
              return null;
            }
          } else {
            let s=true;
            if (seed){
              if (Array.isArray(seed)){ s=true; }
              else if (seed instanceof Tile){ s=false; }
              else { return null; }
            } else { return null; }
            for (let iq = -arg0; iq <= arg0; iq++) {
              for (let ir = Math.max(-arg0, -arg0 - iq); ir <= Math.min(arg0, arg0 - iq); ir++) {
                const is = -iq - ir;
                result.push([(s?s[0]:seed?.q) + iq, (s?s[1]:seed?.r) + ir, (s?s[2]:seed?.s) + is]);
              }
            }
          }
          //console.log(result);
          return result;
          break;
        case 'line':
          let s,t=true;
          if (isthis){
              if (Array.isArray(isthis)){ t=true; }
              else if (isthis instanceof Tile){ t=false; }
              else { return null; }
          } else { return null; }
          if (seed){
              if (Array.isArray(seed)){ s=true; }
              else if (seed instanceof Tile){ s=false; }
              else { return null; }
          } else { return null; }
          const cstart=[(s?seed[0]:seed.q)*3*TILEW,((s?seed[2]:seed.s)*2+(s?seed[0]:seed.q))*TILEH];
          const cend=[(s?isthis[0]:isthis.q)*3*TILEW,((s?isthis[2]:isthis.s)*2+(s?isthis[0]:isthis.q))*TILEH];
          return result;
          break;
      }
    },
    isInDistance: function(from, to, dist) {
      
    },
    getCoordsInDistance: function(from, to, dist){
      
    },
    
    
    console: (arg) => {
      switch (arg) {
        case "len":
          return Object.keys(tiles).length;
      }
    }
  }
})();
const uiManager = (function() {
  let uid = 1;
  const yard = [];
  const pool = {
    single: [],
    ontile_hoveredTile: [],
  };

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
    this.uid = uid++;
    this.layer = 10;
    this.originVertices = [[115, 0], [140, -25 * SQRT3], [100, -65 * SQRT3], [-100, -65 * SQRT3], [-140, -25 * SQRT3], [-115, 0]];
    this.draw = function() {
      ctx.save();

      this.vertices = this.originVertices.map(v => rm.viewPointToScreenPoint(v, "ui", this.align));
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#000000";
      ctx.beginPath();
      ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
      this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      ctx.restore();
    };
    pool.single[this.uid] = this;
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
    this.uid = uid++;
    this.layer = 11;
    this.originVertices = [[20, -5 * SQRT3], [40, -25 * SQRT3], [20, -45 * SQRT3], [-20, -45 * SQRT3], [-40, -25 * SQRT3], [-20, -5 * SQRT3]];
    this.draw = function() {
      ctx.save();

      this.vertices = this.originVertices.map(v => rm.viewPointToScreenPoint(v, "ui", this.align));

      ctx.strokeStyle = "#000000";

      ctx.beginPath();
      ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
      this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      ctx.restore();
    };
    pool.single[this.uid] = this;
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
    this.uid = uid++;
    this.layer = 11;
    this.originVertices = [[-30, -45 * SQRT3], [-110, -45 * SQRT3], [-127.5, -27.5 * SQRT3], [-47.5, -27.5 * SQRT3]];
    this.draw = function() {
      ctx.save();

      this.vertices = this.originVertices.map(v => rm.viewPointToScreenPoint(v, "ui", this.align));

      ctx.strokeStyle = "#000000";

      ctx.beginPath();
      ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
      this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      ctx.restore();
    };
    pool.single[this.uid] = this;
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
    this.uid = uid++;
    this.layer = 11;
    this.originVertices = [[30, -45 * SQRT3], [110, -45 * SQRT3], [127.5, -27.5 * SQRT3], [47.5, -27.5 * SQRT3]];
    this.draw = function() {
      ctx.save();

      this.vertices = this.originVertices.map(v => rm.viewPointToScreenPoint(v, "ui", this.align));

      ctx.strokeStyle = "#000000";

      ctx.beginPath();
      ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
      this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      ctx.restore();
    };
    pool.single[this.uid] = this;
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
    this.uid = uid++;
    this.layer = 11;
    this.originVertices = [[-30, -5 * SQRT3], [-110, -5 * SQRT3], [-127.5, -22.5 * SQRT3], [-47.5, -22.5 * SQRT3]];
    this.draw = function() {
      ctx.save();

      this.vertices = this.originVertices.map(v => rm.viewPointToScreenPoint(v, "ui", this.align));

      ctx.strokeStyle = "#000000";

      ctx.beginPath();
      ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
      this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      ctx.restore();
    };
    pool.single[this.uid] = this;
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
    this.uid = uid++;
    this.layer = 11;
    this.originVertices = [[30, -5 * SQRT3], [110, -5 * SQRT3], [127.5, -22.5 * SQRT3], [47.5, -22.5 * SQRT3]];
    this.draw = function() {
      ctx.save();

      this.vertices = this.originVertices.map(v => rm.viewPointToScreenPoint(v, "ui", this.align));

      ctx.strokeStyle = "#000000";

      ctx.beginPath();
      ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
      this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      ctx.restore();
    };
    pool.single[this.uid] = this;
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
    this.uid = uid++;
    this.layer = 11;
    this.originVertices = [[95, 5 * SQRT3], [105, 15 * SQRT3], [-105, 15 * SQRT3], [-95, 5 * SQRT3]];
    this.draw = function() {
      ctx.save();

      this.vertices = this.originVertices.map(v => rm.viewPointToScreenPoint(v, "ui", this.align));
      ctx.strokeStyle = "#000000";

      ctx.beginPath();
      ctx.moveTo(this.vertices[0][0], this.vertices[0][1]);
      this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      ctx.restore();
    };
    pool.single[this.uid] = this;
  }();
  /*const ui_mainPanel_playerSPValueText = new function() {
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
  
    rm.add(this, 12);
  }();*/

  //▲ single
  //▼ protos

  const ui_onTile_hoveredTile = function() {
    this.q = 0;
    this.r = 0;
    this.s = 0;

    this.sprite = new Image();
    this.sprite.src = sprites["ui_ontile_selected"];

    this.hsl = ["270deg", "100%", "50%"];

    this.locate = function(q, r, s) {
      if (q + r + s !== 0) return null;
      this.q = q;
      this.r = r;
      this.s = s;
    }
    this.draw = function() {
      ctx.save();

      const renderer = rm.tileSpriteRender(this.q, this.r, this.s);
      ctx.translate(renderer.tx, renderer.ty);
      ctx.scale(renderer.ts, renderer.ts);
      ctx.filter = `hue-rotate(${this.hsl[0]}) saturate(${this.hsl[1]}) brightness(${this.hsl[2]})`;
      ctx.drawImage(this.sprite, renderer.x, renderer.y, renderer.dx, renderer.dy);

      ctx.restore();
    };
  }

  const prototypes = {
    ontile_hoveredTile: ui_onTile_hoveredTile,
  }

  return {
    initialize: function() {
      for (let i = 0; i < 5; i++) {
        const tempobj = new ui_onTile_hoveredTile();
        tempobj.uid = uid++;
        tempobj.layer = 6;
        pool.ontile_hoveredTile.push(tempobj);

      }
      for (const e of pool.single) {
        if (e) rm.add(e, e.layer);
      }
    },
    display: function(name, position) {
      if (!Object.keys(pool).includes(name)) { console.log(111); return null; }
      if (pool[name].length > 0) {
        const tempui = pool[name].pop();
        if (name.includes("ontile")) {
          tempui.q = position[0];
          tempui.r = position[1];
          tempui.s = position[2];
        } else {
          tempui.align = position;
        }
        yard.push(tempui);
        rm.add(tempui, tempui.layer);
        return tempui;
      } else {
        if (!Object.keys(prototypes).includes(name)) throw new Error("keys are not bijective within pool and prototypes");
        const tempui = new prototypes[name]();
        if (name.includes("ontile")) {
          tempui.q = position[0];
          tempui.r = position[1];
          tempui.s = position[2];
        } else {
          tempui.align = position;
        }
        yard.push(tempui);
        rm.add(tempui, tempui.layer);
        return tempui;
      }
    },
    retrieve: function(ui) {
      const index = yard.indexOf(ui);
      let n = "";
      if (index > -1) {
        for (const [name, proto] of Object.entries(prototypes)) if (ui instanceof proto) n = name;
        rm.remove(ui);
        pool[n].push(ui);
      }
      //throw new Error("argument not from uipool");
    },
    clearYard: function() {
      for (const i of yard) {
        this.retrieve(i);
      }
    }

  }
})();

const gameManager = (function() {
  const macroState = ["load"];
  const microState = ["idle"];

  return {
    calculate: function() {

      if (im.mouse.dprevx !== im.mouse.prevx || im.mouse.dprevy !== im.mouse.prevy) {
        im.mouse.dprevx = im.mouse.prevx;
        im.mouse.dprevy = im.mouse.prevy;
      } else {
        im.mouse.prevx = im.mouse.x;
        im.mouse.prevy = im.mouse.y;
      }
      rm.tileViewScroll(
        im.inputConsts.mouseWheelToScreenWheel * im.mouse.wdy,
        im.mouse.isDown ? (im.mouse.x - im.mouse.prevx) / rm.getTileViewPivot().scale : 0,
        im.mouse.isDown ? (im.mouse.y - im.mouse.prevy) / rm.getTileViewPivot().scale : 0
      );
      im.mouse.wdx = 0;
      im.mouse.wdy = 0;
      im.mouse.wdz = 0;

      if (microState[0] === "idle") {
        um.clearYard();
        const hoveredObj = rm.zRaycast(im.mouse.x, im.mouse.y);
        if (hoveredObj?.uid ?? -1 > 0) {
          consoleP.textContent += ` ${hoveredObj.uid}`
        } else if (hoveredObj instanceof Tile) {
          um.display("ontile_hoveredTile", [hoveredObj.q, hoveredObj.r, hoveredObj.s]);
        }
      }

    },

  }
})();

const [rm, im, mm, tm, gm, um] = [renderManager, inputManager, mapManager, tileManager, gameManager, uiManager];
Object.freeze(rm, im, mm, tm, gm, um);

const Tile = function(qq, rr, ss, sprite) {
  if (qq + rr + ss !== 0) return null;
  this.q = qq;
  this.r = rr;
  this.s = ss;
  this.sprite = new Image();
  this.sprite.src = sprites[sprite] ?? sprites["tile_proto"];


  this.onTileObj = null;

  //this.vertices = [[TILEW * 2, 0], [TILEW, -TILEH], [-TILEW, -TILEH], [-TILEW * 2, 0], [-TILEW, TILEH], [TILEW, TILEH]];
  //this.vertices = this.vertices.map(v => [v[0] + this.q * 3 * TILEW, v[1] + (this.s * 2 + this.q) * TILEH]);


  this.draw = function() {

    const renderer = rm.tileSpriteRender(this.q, this.r, this.s);
    if (renderer.rx > -TILEW * 4 * renderer.ts && renderer.ry > -TILEH * 2 * renderer.ts && renderer.rx < canvas.width && renderer.ry < canvas.height) {

      ctx.save();

      ctx.translate(renderer.tx, renderer.ty);
      ctx.scale(renderer.ts, renderer.ts);
      ctx.drawImage(this.sprite, renderer.x, renderer.y, renderer.dx, renderer.dy);


      ctx.restore();
    }

    /* vertex version //230102 changed
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
*/
  }
};

function ui_onTile_obj_SPFrame(obj) {
  if (!obj) return null;
  this.onTileObj = obj;


  this.draw = function() {
    this.vertices = [[TILEW * 1.5, -TILEH * 0.5], [TILEW * 2, 0], [TILEW, TILEH], [-TILEW, TILEH], [-TILEW * 2, 0], [-TILEW * 1.5, -TILEH * 0.5]];
    this.vertices = this.vertices.map(v => [v[0] + this.onTileObj.q * 3 * TILEW, v[1] + (this.onTileObj.s * 2 + this.onTileObj.q) * TILEH]);

    ctx.save();
    ctx.translate(canvas.width * 0.5 + tileViewPivot.x * tileViewPivot.scale, canvas.height * 0.5 + tileViewPivot.y * tileViewPivot.scale);
    ctx.scale(tileViewPivot.scale, tileViewPivot.scale);

    ctx.fillStyle = "#000000";

    ctx.beginPath();
    ctx.arc(this.onTileObj.q * 3 * TILEW, (this.onTileObj.s * 2 + this.onTileObj.q) * TILEH, 0.75 * TILEH, Math.PI * 1.1666666, -Math.PI * 0.1666666, true);
    this.vertices.forEach(v => ctx.lineTo(v[0], v[1]));
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  rm.add(this, 3);
}
function ui_onTile_obj_SPBar(obj) {
  if (!obj) return null;
  this.onTileObj = obj;


  this.draw = function() {
    this.pivot = [this.onTileObj.q * 3 * TILEW, (this.onTileObj.s * 2 + this.onTileObj.q) * TILEH];

    ctx.save();
    ctx.translate(canvas.width * 0.5 + tileViewPivot.x * tileViewPivot.scale, canvas.height * 0.5 + tileViewPivot.y * tileViewPivot.scale);
    ctx.scale(tileViewPivot.scale, tileViewPivot.scale);

    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#FFFFFF";

    ctx.beginPath();
    ctx.arc(this.pivot[0], this.pivot[1], 0.875 * TILEH, Math.PI * 1.15, Math.PI * 1.3 * (this.onTileObj.sp / this.onTileObj.maxsp) - Math.PI * 0.15, true);
    ctx.stroke();

    ctx.restore();
  }

  rm.add(this, 4);
}


function draw() {
  fps[0] = Math.round(1000 / (Date.now() - fps[1]));
  fps[1] = Date.now();

  consoleP.textContent = `${tm.console("len")} fps: ${fps[0]}`


  const r = rm.tileViewPointRound(rm.screenPointToTileViewPoint([im.mouse.x, im.mouse.y]));



  gm.calculate();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  //consoleP.textContent += ` dx:${ccc.dx} dy:${ccc.dy} dz:${ccc.dz}`;
  consoleP.textContent += ` q:${r[0]} r:${r[1]} s:${r[2]}`

  rm.drawAll();

  raf = window.requestAnimationFrame(draw);
}

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
//mm.footstep(1, 3, 200);
mm.generate(0);
tm.initialize();
um.initialize();
rm.drawAll();
setTimeout(() => { }, "6000");
loadingScreen.style.display = "none";

/*const onTile_flyingFrog = new function(tile) {
  this.q = tile.q;
  this.r = tile.r;
  this.s = tile.s;
 
  this.sp = 10;
  this.maxsp = 30;
  const sprites = [];
  sprites[0] = new Image();
  sprites[0].src = "resources/ontileobjs/flying_frog_1.png";
 
  this.move = function(dq, dr, ds) {
    const moveTile = tm.getTile(this.q + dq, this.r + dr, this.s + ds);
    if (moveTile) {
      this.q = moveTile.q;
      this.r = moveTile.r;
      this.s = moveTile.s;
      return 0;
    } else {
      return -1;
    }
 
  }
 
  this.draw = function() {
    ctx.save();
    ctx.translate(canvas.width * 0.5 + tileViewPivot.x * tileViewPivot.scale, canvas.height * 0.5 + tileViewPivot.y * tileViewPivot.scale);
    ctx.scale(tileViewPivot.scale, tileViewPivot.scale);
 
    ctx.drawImage(sprites[0], this.q * 3 * TILEW - TILEH * 0.75, (this.s * 2 + this.q) * TILEH - TILEH * 0.75, TILEH * 1.5, TILEH * 1.5);
 
    ctx.restore();
  }
 
  rm.add(this, 2);
}(tm.getTile(0, 0, 0));
 
const newspf = new ui_onTile_SPFrame(onTile_flyingFrog);
const newspb = new ui_onTile_SPBar(onTile_flyingFrog);
*/

raf = window.requestAnimationFrame(draw);

window.addEventListener('keydown', e => { im.keyPressOrigin[e.key] = true; im.keyPressUpdate(); });
window.addEventListener('keyup', e => { im.keyPressOrigin[e.key] = false; im.keyPressUpdate(); });
window.addEventListener('resize', e => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
window.addEventListener('mousemove', e => {
  ccc.x = e.x;
  ccc.y = e.y;

  im.mouse.prevx = im.mouse.x;
  im.mouse.prevy = im.mouse.y;
  im.mouse.x = e.x;
  im.mouse.y = e.y;
});
window.addEventListener('mousedown', e => {
  if (im.mouse.isDown) {
    im.mouse.isDown++;
  } else {
    im.mouse.initx = e.x;
    im.mouse.inity = e.y;
    im.mouse.isDown = 1;
  }
});
window.addEventListener('mouseup', e => {
  im.mouse.isDown = 0;
});
window.addEventListener('click', e => {
});
window.addEventListener('wheel', e => {
  ccc.dx = e.deltaX;
  ccc.dy = e.deltaY;
  ccc.dz = e.deltaZ;
  im.mouse.wdx += e.deltaX;
  im.mouse.wdy += e.deltaY;
  im.mouse.wdz += e.deltaZ;
});
window.addEventListener('contextmenu', e => {
  e.preventDefault();
})