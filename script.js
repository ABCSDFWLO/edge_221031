//import { Delaunay } from "./delaunay.js";

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let raf = null;

const consoleP = document.getElementById('console');
const loadingScreen = document.getElementById('loading');
const cs = {};

const SQRT3 = 1.732050807568877;
const TILESIZE = 5;
const TILEW = TILESIZE;
const TILEH = TILESIZE * SQRT3;

const sprites = {
  "title_illust": "resources/ui/title/title_illustration_0.png",
  "tile_proto": "resources/tile/tile_p_0.png",
  "ui_ontile_selected": "resources/ui/ontile/selected1.png",
};

const fps = [0, 0];


const [r_m, r_v, r_w, s_r, v_n, m_w, m_l, m_p] = [
  document.getElementById("Roughness_Max"),
  document.getElementById("Roughness_Var"),
  document.getElementById("Roughness_Width"),
  document.getElementById("Seed_Range"),
  document.getElementById("Vertex_Number"),
  document.getElementById("Map_Width"),
  document.getElementById("Map_Length"),
  document.getElementById("Minimal_Probability"),
];
const regenbtn = document.getElementById("regenbtn");


//▲ consts

var Delaunay;
//https://github.com/darkskyapp/delaunay-fast
(function() {

  var EPSILON = 1.0 / 1048576.0;

  function supertriangle(vertices) {
    var xmin = Number.POSITIVE_INFINITY,
        ymin = Number.POSITIVE_INFINITY,
        xmax = Number.NEGATIVE_INFINITY,
        ymax = Number.NEGATIVE_INFINITY,
        i, dx, dy, dmax, xmid, ymid;

    for(i = vertices.length; i--; ) {
      if(vertices[i][0] < xmin) xmin = vertices[i][0];
      if(vertices[i][0] > xmax) xmax = vertices[i][0];
      if(vertices[i][1] < ymin) ymin = vertices[i][1];
      if(vertices[i][1] > ymax) ymax = vertices[i][1];
    }

    dx = xmax - xmin;
    dy = ymax - ymin;
    dmax = Math.max(dx, dy);
    xmid = xmin + dx * 0.5;
    ymid = ymin + dy * 0.5;

    return [
      [xmid - 20 * dmax, ymid -      dmax],
      [xmid            , ymid + 20 * dmax],
      [xmid + 20 * dmax, ymid -      dmax]
    ];
  }

  function circumcircle(vertices, i, j, k) {
    var x1 = vertices[i][0],
        y1 = vertices[i][1],
        x2 = vertices[j][0],
        y2 = vertices[j][1],
        x3 = vertices[k][0],
        y3 = vertices[k][1],
        fabsy1y2 = Math.abs(y1 - y2),
        fabsy2y3 = Math.abs(y2 - y3),
        xc, yc, m1, m2, mx1, mx2, my1, my2, dx, dy;

    /* Check for coincident points */
    if(fabsy1y2 < EPSILON && fabsy2y3 < EPSILON)
      throw new Error("Eek! Coincident points!");

    if(fabsy1y2 < EPSILON) {
      m2  = -((x3 - x2) / (y3 - y2));
      mx2 = (x2 + x3) / 2.0;
      my2 = (y2 + y3) / 2.0;
      xc  = (x2 + x1) / 2.0;
      yc  = m2 * (xc - mx2) + my2;
    }

    else if(fabsy2y3 < EPSILON) {
      m1  = -((x2 - x1) / (y2 - y1));
      mx1 = (x1 + x2) / 2.0;
      my1 = (y1 + y2) / 2.0;
      xc  = (x3 + x2) / 2.0;
      yc  = m1 * (xc - mx1) + my1;
    }

    else {
      m1  = -((x2 - x1) / (y2 - y1));
      m2  = -((x3 - x2) / (y3 - y2));
      mx1 = (x1 + x2) / 2.0;
      mx2 = (x2 + x3) / 2.0;
      my1 = (y1 + y2) / 2.0;
      my2 = (y2 + y3) / 2.0;
      xc  = (m1 * mx1 - m2 * mx2 + my2 - my1) / (m1 - m2);
      yc  = (fabsy1y2 > fabsy2y3) ?
        m1 * (xc - mx1) + my1 :
        m2 * (xc - mx2) + my2;
    }

    dx = x2 - xc;
    dy = y2 - yc;
    return {i: i, j: j, k: k, x: xc, y: yc, r: dx * dx + dy * dy};
  }

  function dedup(edges) {
    var i, j, a, b, m, n;

    for(j = edges.length; j; ) {
      b = edges[--j];
      a = edges[--j];

      for(i = j; i; ) {
        n = edges[--i];
        m = edges[--i];

        if((a === m && b === n) || (a === n && b === m)) {
          edges.splice(j, 2);
          edges.splice(i, 2);
          break;
        }
      }
    }
  }

  Delaunay = {
    triangulate: function(vertices, key) {
      var n = vertices.length,
          i, j, indices, st, open, closed, edges, dx, dy, a, b, c;

      /* Bail if there aren't enough vertices to form any triangles. */
      if(n < 3)
        return [];

      /* Slice out the actual vertices from the passed objects. (Duplicate the
       * array even if we don't, though, since we need to make a supertriangle
       * later on!) */
      vertices = vertices.slice(0);

      if(key)
        for(i = n; i--; )
          vertices[i] = vertices[i][key];

      /* Make an array of indices into the vertex array, sorted by the
       * vertices' x-position. Force stable sorting by comparing indices if
       * the x-positions are equal. */
      indices = new Array(n);

      for(i = n; i--; )
        indices[i] = i;

      indices.sort(function(i, j) {
        var diff = vertices[j][0] - vertices[i][0];
        return diff !== 0 ? diff : i - j;
      });

      /* Next, find the vertices of the supertriangle (which contains all other
       * triangles), and append them onto the end of a (copy of) the vertex
       * array. */
      st = supertriangle(vertices);
      vertices.push(st[0], st[1], st[2]);
      
      /* Initialize the open list (containing the supertriangle and nothing
       * else) and the closed list (which is empty since we havn't processed
       * any triangles yet). */
      open   = [circumcircle(vertices, n + 0, n + 1, n + 2)];
      closed = [];
      edges  = [];

      /* Incrementally add each vertex to the mesh. */
      for(i = indices.length; i--; edges.length = 0) {
        c = indices[i];

        /* For each open triangle, check to see if the current point is
         * inside it's circumcircle. If it is, remove the triangle and add
         * it's edges to an edge list. */
        for(j = open.length; j--; ) {
          /* If this point is to the right of this triangle's circumcircle,
           * then this triangle should never get checked again. Remove it
           * from the open list, add it to the closed list, and skip. */
          dx = vertices[c][0] - open[j].x;
          if(dx > 0.0 && dx * dx > open[j].r) {
            closed.push(open[j]);
            open.splice(j, 1);
            continue;
          }

          /* If we're outside the circumcircle, skip this triangle. */
          dy = vertices[c][1] - open[j].y;
          if(dx * dx + dy * dy - open[j].r > EPSILON)
            continue;

          /* Remove the triangle and add it's edges to the edge list. */
          edges.push(
            open[j].i, open[j].j,
            open[j].j, open[j].k,
            open[j].k, open[j].i
          );
          open.splice(j, 1);
        }

        /* Remove any doubled edges. */
        dedup(edges);

        /* Add a new triangle for each edge. */
        for(j = edges.length; j; ) {
          b = edges[--j];
          a = edges[--j];
          open.push(circumcircle(vertices, a, b, c));
        }
      }

      /* Copy any remaining open triangles to the closed list, and then
       * remove any triangles that share a vertex with the supertriangle,
       * building a list of triplets that represent triangles. */
      for(i = open.length; i--; )
        closed.push(open[i]);
      open.length = 0;

      for(i = closed.length; i--; )
        if(closed[i].i < n && closed[i].j < n && closed[i].k < n)
          open.push(closed[i].i, closed[i].j, closed[i].k);

      /* Yay, we're done! */
      return open;
    },
    contains: function(tri, p) {
      /* Bounding box test first, for quick rejections. */
      if((p[0] < tri[0][0] && p[0] < tri[1][0] && p[0] < tri[2][0]) ||
         (p[0] > tri[0][0] && p[0] > tri[1][0] && p[0] > tri[2][0]) ||
         (p[1] < tri[0][1] && p[1] < tri[1][1] && p[1] < tri[2][1]) ||
         (p[1] > tri[0][1] && p[1] > tri[1][1] && p[1] > tri[2][1]))
        return null;

      var a = tri[1][0] - tri[0][0],
          b = tri[2][0] - tri[0][0],
          c = tri[1][1] - tri[0][1],
          d = tri[2][1] - tri[0][1],
          i = a * d - b * c;

      /* Degenerate tri. */
      if(i === 0.0)
        return null;

      var u = (d * (p[0] - tri[0][0]) - b * (p[1] - tri[0][1])) / i,
          v = (a * (p[1] - tri[0][1]) - c * (p[0] - tri[0][0])) / i;

      /* If we're outside the tri, fail. */
      if(u < 0.0 || v < 0.0 || (u + v) > 1.0)
        return null;

      return [u, v];
    }
  };

  //if(typeof module !== "undefined")
  //  module.exports = Delaunay;
})();

//▼ managements

const renderManager = (function () {
  let renderLayer = [];
  const tileViewPivot = {
    x: 0,
    y: 0,
    scale: 0.2,
    uiScale: 1,
    MINSCALE: 1,
    MAXSCALE: 50,
  }
  return {
    add: function (obj, layer) {
      let flag=true;
      for (let i=0;i<renderLayer.length;i++){
        if(Array.isArray(renderLayer[i]) && renderLayer[i].includes(obj)) flag=false;
      }
      if (!Array.isArray(renderLayer[layer])) renderLayer[layer] = [];
      if (flag) renderLayer[layer].push(obj);
    },
    remove: function (obj) {
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
    drawAll: function () {
      for (let i = 0; i < renderLayer.length; i++) {
        if (Array.isArray(renderLayer[i])) renderLayer[i].forEach(e => {
          e.draw();
        });
      }
    },
    clear: function () {
      renderLayer = [];
    },

    gl:function(l){
      return (renderLayer[l])
    },

    viewPointToScreenPoint: function (point, viewType, align) {
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
          result[0] *= tileViewPivot.uiScale;
          result[1] *= tileViewPivot.uiScale;
          switch (al.x) {
            case "xcursor":
              result[0] += im.mouse.x;
              break;
            case "xcenter":
              result[0] += canvas.width * 0.5;
              break;
            case "right":
              result[0] += canvas.width;
              break;
          }
          switch (al.y) {
            case "ycursor":
              result[1] += im.mouse.y;
              break;
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
    screenPointToTileViewPoint: function (point) {
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
    tileViewScroll: function (ds, dx, dy) {
      if ((tileViewPivot.scale + ds >= tileViewPivot.MINSCALE && ds < 0) || (tileViewPivot.scale + ds <= tileViewPivot.MAXSCALE && ds > 0)) tileViewPivot.scale += ds;
      if (dx) tileViewPivot.x += dx;
      if (dy) tileViewPivot.y += dy;
    },

    tileVertex: function (q, r, s) {
      const v0 = [[TILEW * 2, 0], [TILEW, -TILEH], [-TILEW, -TILEH], [-TILEW * 2, 0], [-TILEW, TILEH], [TILEW, TILEH]];
      const v1 = v0.map(v => this.viewPointToScreenPoint([v[0] + q * 3 * TILEW, v[1] + (s * 2 + q) * TILEH], "tile"));
      return v1;
    },
    tileSpriteRender: function (q, r, s) {
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
    isInsidePolygon: function (x, y, v) {
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

    getTileViewPivot: function () {
      return {
        x: tileViewPivot.x,
        y: tileViewPivot.y,
        scale: tileViewPivot.scale,
        uiScale: tileViewPivot.uiScale,
      }
    },

    zRaycast: function (x, y) {
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

const inputManager = new function () {
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
inputManager.setKey = function (action, key) {
  if (action !== undefined && action !== null) this.keyPressMap[action] = key;
}
inputManager.keyPressUpdate = function () {
  for (const [key, value] of Object.entries(this.keyPressMap)) {
    if (this.keyPressOrigin[value]) { this.keyPressResult[key] = true; }
    else { this.keyPressResult[key] = false; }
  }
}

const mapManager = (function () {
  const enemies = [];
  const mapConsts = [
    {
      VERTEX_NUMBER: 22,
      INIT_MIN_R: 60,
      INIT_MAX_R: 120,
      SEED_RANGE: 6,
      MINIMAL_PROBABILITY: 0.12,
      ROUGHNESS_VARIANCE: 2,
      ROUGHNESS_MAX: 5,
      ROUGHNESS_WIDTH: 7,
    },
    {

    },
  ];

  return {
    regenerate: function () {
      loadingScreen.style.display = "flex";
      setTimeout(() => {
        tm.clear();
        rm.clear();
        mapConsts[0].ROUGHNESS_MAX = parseInt(r_m.value);
        mapConsts[0].ROUGHNESS_VARIANCE = parseInt(r_v.value);
        mapConsts[0].ROUGHNESS_WIDTH = parseInt(r_w.value);
        mapConsts[0].SEED_RANGE = parseInt(s_r.value);
        mapConsts[0].VERTEX_NUMBER = parseInt(v_n.value);
        mapConsts[0].INIT_MAX_R = parseInt(m_l.value);
        mapConsts[0].INIT_MIN_R = parseInt(m_w.value);
        mapConsts[0].MINIMAL_PROBABILITY = parseInt(m_p.value);
        mm.generate(0);
        tm.initialize();
        um.initialize();
        rm.drawAll();
        setTimeout(() => { loadingScreen.style.display = "none"; }, 1000);
      }, 1000);
    },
    footstep: function (min, max, tries, seed) {
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
          const adjs = tm.getCoordsInDistance(tempTile, 1);
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
    generate: function (level) {
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
      //▲ hexagonal pillar -> seed

      const tmp_StartOrEnd = Math.random() - 0.5 > 0;
      const tmp_StartSeedCoord =
        tmp_StartOrEnd ?
          Math.max(...initVertices.map(e => tmpdir[0] === 0 ? e?.r : e?.q)) :
          Math.min(...initVertices.map(e => tmpdir[0] === 0 ? e?.r : e?.q));
      const tmp_EndSeedCoord =
        (!tmp_StartOrEnd) ?
          Math.max(...initVertices.map(e => tmpdir[0] === 0 ? e?.r : e?.q)) :
          Math.min(...initVertices.map(e => tmpdir[0] === 0 ? e?.r : e?.q));
      let startSeed, endSeed = null;
      //▲ seed classification(structure allocating)

      const tmp_dv = [];
      for (const i of initVertices) tmp_dv.push([i?.q * 3 * TILEW, (i?.s * 2 + i?.q) * TILEH]);
      const tmpd = Delaunay.triangulate(tmp_dv);
      const edges = [];
      for (let i = 0; i < tmpd.length; i++) {
        switch (i % 3) {
          case 0:
          case 1:
            var tmparr = [initVertices[tmpd[i]], initVertices[tmpd[i + 1]]];
          case 2:
            if (!tmparr) var tmparr = [initVertices[tmpd[i]], initVertices[tmpd[i - 2]]];
            if (edges.findIndex(e => {
              const a = JSON.stringify(e);
              const b = JSON.stringify(e.reverse);
              const c = JSON.stringify(tmparr);
              return (a === c || b === c);
            }) < 0) {
              edges.push(tmparr);
            }
            break;
        }
      }
      //▲ delaunay

      const edges_weight = edges.map(e => [initVertices.findIndex(f => f === e[0]), initVertices.findIndex(f => f === e[1]), tm.getDistance(e[0], e[1])]).sort((a, b) => a[2] - b[2]);
      const edges_excluded = [];
      const edges_included = [];
      const union_find_tree = (function () {
        let root = Array(initVertices.length).fill(0).map((v, i) => i);
        const taskStack = [];
        return {
          union: function (a, b) {
            const x = this.find(a);
            const y = this.find(b);
            root[y] = x;
          },
          find: function (x) {
            if (root[x] === x) {
              return x;
            } else {
              return this.find(root[x]);
            }
          },
          isCycle: function (a, b) {
            return this.find(a) === this.find(b);
          },
        }
      })();
      for (const i of edges_weight) {
        if (union_find_tree.isCycle(i[0], i[1]) && Math.random() > mapConsts[level].MINIMAL_PROBABILITY) {
          edges_excluded.push([initVertices[i[0]], initVertices[i[1]]]);
        } else {
          edges_included.push([initVertices[i[0]], initVertices[i[1]]]);
          union_find_tree.union(i[0], i[1]);
        }
      }
      //▲ mst(yet not minimal...)

      //▲ bonus (not yet)

      const footstepSeed = [];

      for (const [i, j] of edges_included) {
        const line_coords = tm.getCoordsOnLine(i, j);
        for (const k of line_coords) {
          if (!tm.getTile(k[0], k[1], k[2])) footstepSeed.push(tm.setTile(k[0], k[1], k[2]));
        }
      }
      //▲ stroke paths

      for (const i of initVertices) {
        const widen = tm.getCoordsInDistance(i, mapConsts[level].SEED_RANGE);
        if ((tmpdir[0] === 0 ? i?.r : i?.q) === tmp_StartSeedCoord) startSeed = i;
        if ((tmpdir[0] === 0 ? i?.r : i?.q) === tmp_EndSeedCoord) endSeed = i;
        for (const j of widen) {
          if (!tm.getTile(j[0], j[1], j[2])) footstepSeed.push(tm.setTile(j[0], j[1], j[2]));
        }
      }
      //▲ seed widening
      console.log(mapConsts[level].ROUGHNESS_VARIANCE, mapConsts[level].ROUGHNESS_MAX, 6 - mapConsts[level].ROUGHNESS_MAX + mapConsts[level].ROUGHNESS_VARIANCE)
      this.footstep(6 - mapConsts[level].ROUGHNESS_MAX, Math.min(6 - mapConsts[level].ROUGHNESS_MAX + mapConsts[level].ROUGHNESS_VARIANCE, 6), mapConsts[level].ROUGHNESS_WIDTH, footstepSeed);
      //▲ roughing
    },
  };
})();
const tileManager = (function () {
  //221212 closure implement
  let tiles = {};
  return {
    initialize: function () {
      Object.values(tiles).forEach(v => {
        rm.add(v, 1);
      });
      cs.tile_number = Object.keys(tiles).length;
    },
    //q*1024 + r == index
    getTile: function (q, r, s) {
      if (q + r + s !== 0) return null;
      else return tiles[q * 1024 + r] ?? null;
    },
    setTile: function (q, r, s, tile, sprite, hsl) {
      if (!s) s = -q - r;
      if (q + r + s !== 0) return null;
      if (tile) tiles[q * 1024 + r] = tile;
      else tiles[q * 1024 + r] = new Tile(q, r, s, sprite ?? "tile_proto", hsl ?? ["180deg", "80%", "80%"]);
      return tiles[q * 1024 + r];
      //DISCLAIMER:do not call this method except mapGenerator
    },
    clear: function () {
      tiles = {};
    },

    isInDistance: function (from, to, dist) {
      if (from && to && dist) {
        const tf = from instanceof Tile ? [from.q, from.r, from.s] : from;
        const tt = to instanceof Tile ? [to.q, to.r, to.s] : to;
        return (
          tt[0] - tf[0] <= dist && tt[0] - tf[0] >= -dist
          && tt[1] - tf[1] <= dist && tt[1] - tf[1] >= -dist
          && tt[2] - tf[2] <= dist && tt[2] - tf[2] >= -dist
        );
      } else { return null; }
    },

    getCoordsInDistance: function (from, dist) {
      if (from && dist) {
        const tf = from instanceof Tile ? [from.q, from.r, from.s] : from;
        const result = [];
        for (let iq = -dist; iq <= dist; iq++) {
          for (let ir = Math.max(-dist, -dist - iq); ir <= Math.min(dist, dist - iq); ir++) {
            const is = -iq - ir;
            result.push([tf[0] + iq, tf[1] + ir, tf[2] + is]);
          }
        }
        return result;
      } else { return null; }
    },
    getCoordsOnLine: function (from, to) {
      if (from && to) {
        const tf = from instanceof Tile ? [from.q, from.r, from.s] : from;
        const tt = to instanceof Tile ? [to.q, to.r, to.s] : to;
        const dist = this.getDistance(from, to);
        return Array(dist + 1).fill(0).map((v, i) => rm.tileViewPointRound([tf[0] + (tt[0] - tf[0]) / dist * i, tf[1] + (tt[1] - tf[1]) / dist * i, tf[2] + (tt[2] - tf[2]) / dist * i]));
      } else { return null; }
    },
    getDistance: function (from, to) {
      if (from && to) {
        const tf = from instanceof Tile ? [from.q, from.r, from.s] : from;
        const tt = to instanceof Tile ? [to.q, to.r, to.s] : to;
        return Math.max(Math.abs(tt[0] - tf[0]), Math.abs(tt[1] - tf[1]), Math.abs(tt[2] - tf[2]));
      } else { return null; }
    },

    getData() {
      return tiles;
    }
  }
})();
const uiManager = (function () {
  let uid = 1;
  const yard = [];
  const pool = {
    single: [],
    ontile_hoveredTile: [],
  };

  const ui_mainPanel = new function () {
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
    this.draw = function () {
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
  const ui_mainPanel_mainButton = new function () {
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
    this.draw = function () {
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
  const ui_mainPanel_leftUpperButton = new function () {
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
    this.draw = function () {
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
  const ui_mainPanel_rightUpperButton = new function () {
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
    this.draw = function () {
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
  const ui_mainPanel_leftLowerButton = new function () {
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
    this.draw = function () {
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
  const ui_mainPanel_rightLowerButton = new function () {
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
    this.draw = function () {
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
  const ui_mainPanel_playerSPBar = new function () {
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
    this.draw = function () {
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

  const scene_title = new function () {
    this.align = {
      upper: canvas,
      x: "xstretch",
      y: "ystretch",
      "left": 0,
      "right": 0,
      "top": 0,
      "bottom": 0,
      "xcenter": 0,
      "ycenter": 0,
    };
    this.uid = uid++;
    this.layer = 15;
    this.draw = function () {
      ctx.save();

      this.align.right = canvas.width;
      this.align.bottom = canvas.height;
      this.align.xcenter = canvas.width * 0.5;
      this.align.ycenter = canvas.height * 0.5;

      ctx.strokeStyle = "#000000";

      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      ctx.restore();
    };
    pool.single[this.uid] = this;
  }();
  const ui_titleScene_title = new function () {
    this.align = {
      upper: scene_title,
      x: "left",
      y: "top",
      "left": 20,
      "right": 0,
      "top": 20,
      "bottom": 180,
      "xcenter": 0,
      "ycenter": 100,
    };
    this.uid = uid++;

    this.layer = 17;
    this.draw = function () {
      ctx.save();

      const fontSize = 160;
      const text = "여섯번째 밤";
      const pivot = rm.viewPointToScreenPoint([this.align.left, this.align.bottom], "ui", this.align);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = (fontSize * rm.getTileViewPivot().uiScale) + "px RIDIBatang";
      ctx.fillText(text, pivot[0], pivot[1]);

      ctx.restore();
    }
    pool.single[this.uid] = this;
  }();
  const ui_titleScene_illustration = new function () {
    this.align = {
      upper: scene_title,
      x: "right",
      y: "bottom",
      "left": -940,
      "right": -20,
      "top": -666,
      "bottom": -20,
      "xcenter": -480,
      "ycenter": -343,
    };
    this.uid = uid++;
    this.layer = 16;
    this.sprite = new Image();
    this.sprite.src = sprites["title_illust"];

    this.draw = function () {
      ctx.save();

      const pivot = rm.viewPointToScreenPoint([this.align.left, this.align.top], "ui", this.align);

      ctx.drawImage(this.sprite, pivot[0], pivot[1], this.align.right - this.align.left, this.align.bottom - this.align.top);

      ctx.restore();
    };
    pool.single[this.uid] = this;
  }();
  const ui_titleScene_subTitle = new function () {
    this.align = {
      upper: ui_titleScene_title,
      x: "left",
      y: "bottom",
      "left": 0,
      "right": 0,
      "top": 20,
      "bottom": 100,
      "xcenter": 0,
      "ycenter": 60,
    };
    this.uid = uid++;

    this.layer = 17;
    this.draw = function () {
      ctx.save();

      const fontSize = 80;
      const text = "Night VI";
      const pivot = rm.viewPointToScreenPoint([this.align.left, this.align.bottom], "ui", this.align);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = (fontSize * rm.getTileViewPivot().uiScale) + "px RIDIBatang";
      ctx.fillText(text, pivot[0], pivot[1]);

      ctx.restore();
    }
    pool.single[this.uid] = this;
  }();
  const ui_titleScene_newGame = new function () {
    this.align = {
      upper: scene_title,
      x: "left",
      y: "bottom",
      "left": 20,
      "right": 330,
      "top": -180,
      "bottom": -120,
      "xcenter": 165,
      "ycenter": -150,
    };
    this.uid = uid++;
    this.originVertices = [[this.align.left, this.align.top], [this.align.left, this.align.bottom], [this.align.right, this.align.bottom], [this.align.right, this.align.top]];

    this.layer = 17;

    this.click=function(){
      gm.setState("macro",["load","game","init"]);
    },

    this.draw = function () {
      ctx.save();

      const fontSize = 60;
      const text = "▶ 새로하기";
      const pivot = rm.viewPointToScreenPoint([this.align.left, this.align.bottom], "ui", this.align);
      this.vertices = this.originVertices.map(v => rm.viewPointToScreenPoint(v, "ui", this.align));

      ctx.fillStyle = "#FFFFFF";
      ctx.font = (fontSize * rm.getTileViewPivot().uiScale) + "px RIDIBatang";
      ctx.fillText(text, pivot[0], pivot[1]);

      ctx.restore();
    }
    pool.single[this.uid] = this;
  }();
  const ui_titleScene_loadGame = new function () {
    this.align = {
      upper: scene_title,
      x: "left",
      y: "bottom",
      "left": 20,
      "right": 330,
      "top": -100,
      "bottom": -40,
      "xcenter": 165,
      "ycenter": -70,
    };
    this.uid = uid++;
    this.originVertices = [[this.align.left, this.align.top], [this.align.left, this.align.bottom], [this.align.right, this.align.bottom], [this.align.right, this.align.top]];

    this.enabled=false;

    this.layer = 17;
    this.draw = function () {
      ctx.save();

      const fontSize = 60;
      const text = "▶ 이어하기";
      const pivot = rm.viewPointToScreenPoint([this.align.left, this.align.bottom], "ui", this.align);
      this.vertices = this.originVertices.map(v => rm.viewPointToScreenPoint(v, "ui", this.align));

      if(this.enabled)ctx.fillStyle = "#FFFFFF";
      else ctx.fillStyle="#555555";
      ctx.font = (fontSize * rm.getTileViewPivot().uiScale) + "px RIDIBatang";
      ctx.fillText(text, pivot[0], pivot[1]);

      ctx.restore();
    }
    pool.single[this.uid] = this;
  }();

  const ui_dialogPanel = new function () {
    this.align = {
      upper: canvas,
      x: "xstretch",
      y: "bottom",
      "left": 0,
      "right": 0,
      "top": -60,
      "bottom": 0,
      "xcenter": 0,
      "ycenter": -30,
    };
    this.uid = uid++;
    this.layer = 14;
    this.draw = function () {
      ctx.save();

      this.align.right = canvas.width;
      this.align.xcenter = canvas.width * 0.5;

      const grd=ctx.createLinearGradient(0,canvas.height-this.align.top,canvas.width,canvas.height);
      grd.addColorStop(0,"#000000FF");
      grd.addColorStop(1,"#00000000");
      ctx.fillStyle=grd;

      ctx.beginPath();
      ctx.rect(0, canvas.height-this.align.top, canvas.width, canvas.height);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      ctx.restore();
    };
    pool.single[this.uid] = this;
  }();

  /*
  const scene_settings = new function () {
    this.align = {
      upper: canvas,
      x: "xstretch",
      y: "ystretch",
      "left": 0,
      "right": 0,
      "top": 0,
      "bottom": 0,
      "xcenter": 0,
      "ycenter": 0,
    };
    this.uid = uid++;
    this.layer = 20;
    this.draw = function () {
      ctx.save();

      this.align.right = canvas.width;
      this.align.bottom = canvas.height;
      this.align.xcenter = canvas.width * 0.5;
      this.align.ycenter = canvas.height * 0.5;

      ctx.strokeStyle = "#000000";

      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      ctx.restore();
    };
    pool.single[this.uid] = this;
  }();
*/

  //▲ single
  //▼ protos

  const ui_onTile_hoveredTile = function () {
    this.q = 0;
    this.r = 0;
    this.s = 0;

    this.sprite = new Image();
    this.sprite.src = sprites["ui_ontile_selected"];

    this.hsl = ["270deg", "100%", "50%"];

    this.locate = function (q, r, s) {
      if (q + r + s !== 0) return null;
      this.q = q;
      this.r = r;
      this.s = s;
    }
    this.draw = function () {
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
    initialize: function () {
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
    display: function (name, position) {
      if (!Object.keys(pool).includes(name)) { return null; }
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
    retrieve: function (ui) {
      const index = yard.indexOf(ui);
      let n = "";
      if (index > -1) {
        for (const [name, proto] of Object.entries(prototypes)) if (ui instanceof proto) n = name;
        rm.remove(ui);
        pool[n].push(ui);
      }
      //throw new Error("argument not from uipool");
    },
    clearYard: function () {
      for (const i of yard) {
        this.retrieve(i);
      }
    },

    loadTitle: function () {
      for (const e of pool.single) {
        switch (e) {
          case ui_titleScene_loadGame:
            if (localStorage.getItem("night_vi")) e.enabled=true;
          case scene_title:
          case ui_titleScene_title:
          case ui_titleScene_subTitle:
          case ui_titleScene_illustration:
          case ui_titleScene_newGame:
            rm.add(e, e.layer);
            break;
          default:
            rm.remove(e);
            break;
        }
      }
    },
    loadGame: function() {
      for (const e of pool.single) {
        switch (e) {
          case scene_title:
          case ui_titleScene_title:
          case ui_titleScene_subTitle:
          case ui_titleScene_illustration:
          case ui_titleScene_newGame:
          case ui_titleScene_loadGame:
            rm.add(e, e.layer);
            break;
          default:
            rm.remove(e);
            break;
        }
      }
    },
    loadDialog: function(){
      
    },
  }
})();

const gameManager = (function () {
  const macroState = ["load", "title"];
  const microState = ["idle"];
  let hoveredObj, clickedObj;

  return {
    setState:function(m,a){
      if(m==="macro"){
        a.forEach((v,i) => {
          macroState[i]=v;
        });
      }else if (m==="micro"){
        a.forEach((v,i) => {
          microState[i]=v;
        });
      }else{console.log("macro/micro")}
    },

    calculate: function () {

      if (im.mouse.dprevx !== im.mouse.prevx || im.mouse.dprevy !== im.mouse.prevy) {
        im.mouse.dprevx = im.mouse.prevx;
        im.mouse.dprevy = im.mouse.prevy;
      } else {
        im.mouse.prevx = im.mouse.x;
        im.mouse.prevy = im.mouse.y;
      }
      rm.tileViewScroll(
        im.inputConsts.mouseWheelToScreenWheel * im.mouse.wdy,
        im.mouse.isDown>0 ? (im.mouse.x - im.mouse.prevx) / rm.getTileViewPivot().scale : 0,
        im.mouse.isDown>0 ? (im.mouse.y - im.mouse.prevy) / rm.getTileViewPivot().scale : 0
      );
      im.mouse.wdx = 0;
      im.mouse.wdy = 0;
      im.mouse.wdz = 0;
      //▲ mouse input & viewScroll

      if (microState[0] === "idle") {
        um.clearYard();
        hoveredObj = rm.zRaycast(im.mouse.x, im.mouse.y);
        if (hoveredObj?.uid ?? -1 > 0) {
          consoleP.textContent += ` ${hoveredObj.uid}`
        } else if (hoveredObj instanceof Tile) {
          um.display("ontile_hoveredTile", [hoveredObj.q, hoveredObj.r, hoveredObj.s]);
        }
      }else {hoveredObj=null;}
      //▲ mouse hovered obj

      if (microState[0]==="idle"){
        if (im.mouse.isDown===1){
          clickedObj=hoveredObj;
          console.log(clickedObj);
        } else if (im.mouse.isDown===-1){
          if(clickedObj===hoveredObj)clickedObj?.click?.();
          console.log(clickedObj);
          im.mouse.isDown=0;
        }

      }
      //▲ click

      if (macroState[0] === "load") {
        switch (macroState[1]) {
          case "title":
            loadingScreen.style.display="flex";
            macroState[0]="title";
            microState[0]="loading";
            setTimeout(() => {
              //??.save();
              um.loadTitle();
              setTimeout(() => {
                loadingScreen.style.display="none";
                microState[0]="idle";
              }, 1000);
            }, 1000);
            break;
          case "game":
            if(macroState[2]==="new"){
            loadingScreen.style.display="flex";
            macroState[0]=""
            microState[0]="loading";
            setTimeout(() => {
              mm.generate(0);
              tm.initialize();
              um.initialize();
              rm.drawAll();
              setTimeout(() => {
                loadingScreen.style.display = "none";
                macroState[0]="load";
                macroState[1]="dialog";
                microState[0]="idle";
              }, 1000);
            }, 1000);
          }
            break;
          case "dialog":
            macroState[0]="dialog";
            macroState[1]=macroState[2];
            macroState[2]=0;
            um.loadDialog();
            break;
        }
      }else if (macroState[0]==="title"){

      }else if (macroState[0]==="dialog"){

      }
      //▲ Scene
    },
  }
})();

const [rm, im, mm, tm, gm, um] = [renderManager, inputManager, mapManager, tileManager, gameManager, uiManager];
Object.freeze(rm, im, mm, tm, gm, um);

const Tile = function (qq, rr, ss, sprite, hsl) {
  if (qq + rr + ss !== 0) return null;
  this.q = qq;
  this.r = rr;
  this.s = ss;
  this.sprite = new Image();
  this.sprite.src = sprites[sprite] ?? sprites["tile_proto"];
  this.hsl = hsl;


  this.onTileObj = null;

  //this.vertices = [[TILEW * 2, 0], [TILEW, -TILEH], [-TILEW, -TILEH], [-TILEW * 2, 0], [-TILEW, TILEH], [TILEW, TILEH]];
  //this.vertices = this.vertices.map(v => [v[0] + this.q * 3 * TILEW, v[1] + (this.s * 2 + this.q) * TILEH]);


  this.draw = function () {

    const renderer = rm.tileSpriteRender(this.q, this.r, this.s);
    if (renderer.rx > -TILEW * 4 * renderer.ts && renderer.ry > -TILEH * 2 * renderer.ts && renderer.rx < canvas.width && renderer.ry < canvas.height) {

      ctx.save();

      ctx.translate(renderer.tx, renderer.ty);
      ctx.scale(renderer.ts, renderer.ts);
      //ctx.filter = `hue-rotate(${this.hsl[0]}) saturate(${this.hsl[1]}) brightness(${this.hsl[2]})`;
      //렉 겁나 걸린다 이거
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


  this.draw = function () {
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


  this.draw = function () {
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

  consoleP.textContent = `tiles: ${cs?.tile_number ?? null} fps: ${fps[0]}`


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

/*
const onTile_flyingFrog = new function(tile) {
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
*/

//const newspf = new ui_onTile_SPFrame(onTile_flyingFrog);
//const newspb = new ui_onTile_SPBar(onTile_flyingFrog);

raf = window.requestAnimationFrame(draw);

window.addEventListener('keydown', e => { im.keyPressOrigin[e.key] = true; im.keyPressUpdate(); });
window.addEventListener('keyup', e => { im.keyPressOrigin[e.key] = false; im.keyPressUpdate(); });
window.addEventListener('resize', e => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
window.addEventListener('mousemove', e => {
  cs.x = e.x;
  cs.y = e.y;

  im.mouse.prevx = im.mouse.x;
  im.mouse.prevy = im.mouse.y;
  im.mouse.x = e.x;
  im.mouse.y = e.y;
});
window.addEventListener('mousedown', e => {
  if (im.mouse.isDown>0) {
    im.mouse.isDown++;
  } else {
    im.mouse.initx = e.x;
    im.mouse.inity = e.y;
    im.mouse.isDown = 1;
  }
});
window.addEventListener('mouseup', e => {
  im.mouse.isDown = -1;
});
window.addEventListener('click', e => {
});
window.addEventListener('wheel', e => {
  cs.dx = e.deltaX;
  cs.dy = e.deltaY;
  cs.dz = e.deltaZ;
  im.mouse.wdx += e.deltaX;
  im.mouse.wdy += e.deltaY;
  im.mouse.wdz += e.deltaZ;
});
window.addEventListener('contextmenu', e => {
  e.preventDefault();
});


regenbtn.addEventListener('click', mm.regenerate);

//▲
//▼ utils

