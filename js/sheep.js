/* global describe cv skeletonization Okb*/

var doodleMeta = new function(){
    var that = this;
    
    that.randomId = function(){
      return btoa(Math.random().toString());
    }
  
    that.inferTreeFromMat = function(src,win){
      let M = cv.Mat.ones(3, 3, cv.CV_8U);
      ([
        0,1,0,
        1,1,1,
        0,1,0,
      ]).map((x,i)=>(M.data[i]=x));
      let anchor = new cv.Point(-1, -1);
      cv.dilate(src, src, M, anchor, 2, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
  
      var width = src.cols;
      var height = src.rows;
  
      var rows = (height/win)
      var cols = (width/win)
  
      var visited = [];
      for (var i = 0; i < rows; i++){
        visited.push([])
        for (var j = 0; j < cols; j++){
          visited[visited.length-1].push(0)
        }
      }
  
      function class_chunk(I,J){
        var i = I * win;
        var j = J * win;
        var chunk = [0,0,0,0,0,0,0,0];
        var c0 = win/4;
        var c1 = win*3/4
  
        for (var x = 0; x < win; x++){
          var v = src.data[i*width+j+x]
          if (v){
            if (x < c0){
              chunk[0] = 1;
            }else if (x < c1){
              chunk[1] = 1;
            }else{
              chunk[2] = 1;
            }
          }
        }
        for (var x = 0; x < win; x++){
          var v = src.data[(i+x)*width+(j+win)]
           if (v){
            if (x < c0){
              chunk[2] = 1;
            }else if (x < c1){
              chunk[3] = 1;
            }else{
              chunk[4] = 1;
            }
          }
        }
        for (var x = 0; x < win; x++){
          var v = src.data[(i+win)*width+(j+win-x)]
          if (v){
            if (x < c0){
              chunk[4] = 1;
            }else if (x < c1){
              chunk[5] = 1;
            }else{
              chunk[6] = 1;
            }
          }
        }
        for (var x = 0; x < win; x++){
          var v = src.data[(i+win-x)*width+(j)]
          if (v){
            if (x < c0){
              chunk[6] = 1;
            }else if (x < c1){
              chunk[7] = 1;
            }else{
              chunk[0] = 1;
            }
          }
        }
        return chunk; 
      }
  
  
      function legal(i,j){
  
        if (i < 0 || i >= rows || j < 0 || j >= cols){
          return false;
        }
        if (visited[i][j]){
          return false;
        }
        return true;
      }
  
      function search(i,j){
        var sub = {x:j*win+win/2,y:i*win+win/2,children:[]}
        visited[i][j] = 1;
        var chunk = class_chunk(i,j);
        var dir = [[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1]]
        for (var n = 0; n < chunk.length; n++){
          if (chunk[n]){
            var ni = i+dir[n][0];
            var nj = j+dir[n][1];
            if (legal(ni,nj)){
              visited[ni][nj] = 1;
              sub.children.push(search(ni, nj));
            }
          }
        }
        return sub;
      }
  
      var result;
      for (var i = 0; i < rows; i++){
        for (var j = 0; j < cols; j++){
          var v = cv.countNonZero(src.roi({x:j*win,y:i*win,width:win,height:win}))
          if (v){
            result = search(i,j);
            break
          }
          visited[i][j] = 1;
        }
        if (result != undefined){
          break;
        } 
      }
  
      if (result == undefined){
        return undefined;
      }
  
  
      function clean(tree){
        function _clean(tree,branch){
          if (tree.children.length != 1){
            branch = 0;
          }
          if (branch < 2){
            for (var i = tree.children.length-1; i >= 0; i--){
              if (tree.children[i].children.length == 0){
                tree.children.splice(i,1);
                continue;
              }
            }
          }
          for (var i = 0; i < tree.children.length; i++){
            _clean(tree.children[i],branch+1);
          }
        }
        _clean(tree,0)
      }  
      function add_parent(tree){
        for (var i = 0; i < tree.children.length; i++){
          tree.children[i].parent = tree;
          add_parent(tree.children[i]);
        }
      }
  
      clean(result);
      clean(result);  
  
      that.typeTree(result);
      add_parent(result);
      return result;
    }
  
    that.typeTree = function(tree){
      function _add_type(tree){
        if (tree.children.length == 0){          
          tree.type = "leaf"
  
        }else if (tree.children.length == 1){
          tree.type = "edge"
        }else{
          tree.type = "node"
        } 
        for (var i = 0; i < tree.children.length; i++){
          _add_type(tree.children[i]);
        }
      }
      _add_type(tree); tree.type = "root";
    }
  
    that.filterTree = function(tree,t){
      if (tree == undefined){
        return;
      }
      function f(tree){
        if (tree.type == "edge"){
          if (tree.parent != undefined && tree.children[0] != undefined){
            var p0 = tree.parent;
            var p1 = tree.children[0];
            var mx = (p0.x + p1.x)/2;
            var my = (p0.y + p1.y)/2;
            tree.nx = tree.x * (1-t) + mx * t;
            tree.ny = tree.y * (1-t) + my * t;
          }
        }
        for (var i = 0; i < tree.children.length; i++){
          f(tree.children[i]);
        }
      }
  
      function g(tree){
  
        if (tree.nx != undefined && tree.ny != undefined){
          tree.x = tree.nx;
          tree.y = tree.ny;
          delete tree.nx;
          delete tree.ny;
        }
  
        for (var i = 0; i < tree.children.length; i++){
          g(tree.children[i]);
        }
      }
      f(tree);
      g(tree);
  
    }
  
    that.flushTree = function(tree){
      if (tree == undefined){
        return;
      }
      function f(tree){
        if (tree.type == "edge"){
          if (tree.parent != undefined && tree.children[0] != undefined){
            var idx = tree.parent.children.indexOf(tree)
            tree.children[0].parent = tree.parent;
            tree.parent.children[idx] = tree.children[0];
          }
        }
        for (var i = 0; i < tree.children.length; i++){
          f(tree.children[i]);
        }
      }
      f(tree);
    }
  
    that.simplifyTree = function(tree){
      if (tree == undefined){
        return;
      }
      function f(tree,t){
        if (tree.type == "edge"){
          if (t && tree.parent != undefined && tree.children[0] != undefined){
            var idx = tree.parent.children.indexOf(tree)
            tree.children[0].parent = tree.parent;
            tree.parent.children[idx] = tree.children[0];
          }
          t = !t;
        }else{
          t = 1;
        }
        for (var i = 0; i < tree.children.length; i++){
          f(tree.children[i],t);
        }
      }
      f(tree,1);
    }
  
    that.centerTree = function(tree,args){
      var cx = args.x
      var cy = args.y
      if (tree == undefined){
        return;
      }
      var cn = tree;
      var cd = Infinity;
      function f(tree){
        if (args.types.includes(tree.type)){
          var d = Okb.vector.distance({x:cx,y:cy},tree)
          if (d < cd){
            cd = d;
            cn = tree;
          }
        }
        for (var i = 0; i < tree.children.length; i++){
          f(tree.children[i]);
        }
      }
      f(tree);  
  
      function g(tree,parent){
        if (parent == undefined){
          return;
        }
        var idx = parent.children.indexOf(tree);
        parent.children.splice(idx,1);
        tree.children.push(parent);
        var pp = parent.parent;
        parent.parent = tree;
  
        g(parent,pp);
  
      }
      g(cn,cn.parent);
      that.typeTree(cn);
      cn.parent = undefined;
      return cn;
    }
  
    that.parameterizeTreeToNodes = function(tree){
      var nodes = []
      function f(tree){
        if (tree == undefined){
          return;
        }
        nodes.push(tree);
        if (tree.parent != undefined){
          var th = Math.atan2(tree.y-tree.parent.y, tree.x-tree.parent.x);
          var r = Okb.vector.distance(tree.parent,tree);
          tree.th = th - tree.parent.thabs;
          tree.r = r;
          tree.thabs = th;
          tree.th0 = tree.th;
        }else{
          tree.th = 0;
          tree.r = 0;
          tree.thabs = 0;
          tree.th0 = 0;
        }
        tree.id = that.randomId();
        for (var i = 0; i < tree.children.length; i++){
          f(tree.children[i]);
        }
      }
      f(tree);
      return nodes;
    }
    
    that.deepCopyNodes = function(nodes){
  
      var nnodes = [];
      for (var i = 0; i < nodes.length; i++){
        var n = nodes[i]
        nnodes.push({
          th: n.th,
          th0:n.th0,
          thabs:n.thabs,
          r : n.r,
          //id: n.id,
          id : that.randomId(),
          type: n.type,
          x: n.x,
          y: n.y,
        })
      }
      for (var i = 0; i < nodes.length; i++){
        var n = nodes[i];
        var pidx = nodes.indexOf(n.parent);
        nnodes[i].parent = nnodes[pidx];
        nnodes[i].children = [];
        for (var j = 0; j < n.children.length; j++){
          var cidx = nodes.indexOf(n.children[j]);
          nnodes[i].children.push(nnodes[cidx]);
        }
      }
      return nnodes;
    }
  
    that.forwardKinematicsNodes = function(nodes){
      function f(tree,a){
        tree.thabs = tree.th + a;
        for (var i = 0; i < tree.children.length; i++){
          f(tree.children[i],tree.thabs);
        }
      }
  
      function g(tree,x,y){
        if (tree.type != "root"){
          tree.x = x + Math.cos(tree.thabs) * tree.r;
          tree.y = y + Math.sin(tree.thabs) * tree.r;
        }else{
          tree.x = x;
          tree.y = y;
        }
        for (var i = 0; i < tree.children.length; i++){
          g(tree.children[i],tree.x,tree.y);
        }
      }
      if (nodes[0]){
        f(nodes[0],0);
        g(nodes[0],nodes[0].x || 0,nodes[0].y || 0);
      }
    }
  
    function dist2weight(d){
      if (d.length == 1){
        return [1];
      }
      function minmax(d){
        var bd = Okb.geometry.bound(d.map((x)=>({x:x,y:0})));
        return [bd[0].x,bd[1].x]
      }
      var [dm,dM] = minmax(d);
      var f = []
      var s = 0
      for (var i = 0; i < d.length; i++){
        var x = Okb.math.map(d[i],dm,dM,1,0.1);
        s += x;
        f.push(x);
      }
      f = f.map((x)=>(x/s));
      return f;
    }
  
  
    that.buildSkin = function(strokes, nodes){
      if (strokes == undefined || nodes == undefined || !strokes.length || !nodes.length){
        return [];
      }
      var skin = []
      for (var i = 0; i < strokes.length; i++){
        for (var j = 0; j < strokes[i].length; j++){
          skin.push({x:strokes[i][j][0], y:strokes[i][j][1], connect:(j!=0)});
        }
      }
  
      for (var i = 0; i < skin.length; i++){
        var md = [Infinity, Infinity, Infinity, Infinity];
        var mn = md.map((x)=>(undefined));
        for (var j = 0; j < nodes.length; j++){
          var d = Okb.vector.distance(skin[i],nodes[j]);
          for (var k = 0; k < md.length; k++){
            if (d < md[k]){
              md.splice(k,0,d); md.pop();
              mn.splice(k,0,nodes[j]); mn.pop();
              break;
            }
          }
        }
        skin[i].anchors = [];
        md = md.filter((x)=>(x!=Infinity));
        mn = mn.slice(0,md.length);
        var ws = dist2weight(md);
  
        for (var j = 0; j < mn.length; j++){
          var th = Math.atan2(skin[i].y-mn[j].y, skin[i].x-mn[j].x);
          var r = Okb.vector.distance(skin[i],mn[j]);
          var w = ws[j]//([0.4,0.25,0.2,0.1,0.05])[j];
          skin[i].anchors.push({node: mn[j], th:th-mn[j].thabs, r:r, w:w});
        }
      }
      return skin;
    }
  
    that.calculateSkin = function(skin){
      for (var i = 0; i < skin.length; i++){
        var xw = 0;
        var yw = 0;
        for (var j = 0; j < skin[i].anchors.length; j++){
          var a = skin[i].anchors[j];
          var x = a.node.x + Math.cos(a.th+a.node.thabs) * a.r;
          var y = a.node.y + Math.sin(a.th+a.node.thabs) * a.r;
          xw += x * a.w;
          yw += y * a.w;
        }
        skin[i].x = xw;
        skin[i].y = yw;
      }
    }
  
    that.drawTree = function(canv, tree){
      if (tree == undefined){
        return;
      }
      var ctx = canv.getContext("2d");
      if (tree.type == "root"){
        ctx.strokeRect(tree.x-7,tree.y-7,14,14);
      }else if (tree.type != "edge"){
        ctx.strokeRect(tree.x-4,tree.y-4,8,8);
      }else{
        ctx.strokeRect(tree.x-1,tree.y-1,2,2);
      }
  
      for (var i = 0; i < tree.children.length; i++){
        ctx.beginPath();
        ctx.moveTo(tree.x,tree.y);
        ctx.lineTo(tree.children[i].x,tree.children[i].y);
        ctx.stroke();
        that.drawTree(canv, tree.children[i]);
      }
    }
    
    this.drawSkin = function(canv,skin){
      var ctx = canv.getContext("2d");
      for (var i = 0; i < skin.length; i++){
        if (!skin[i].connect){
          if (i != 0){
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(skin[i].x, skin[i].y);
        }else{
          ctx.lineTo(skin[i].x, skin[i].y);
        }
      }
      ctx.stroke();
    }
  }
  
  
  var doodleRig = new function(){
    var that = this;
    
    var WIDTH;
    var HEIGHT;
    var FAT;
    var BLEED;
    
    var canvas;
    var context;
    
    that.setup = function(args){
      console.log(args);
      WIDTH = args.width;
      HEIGHT = args.height;
      FAT = args.fat;
      BLEED = args.bleed;
      canvasId = args.canvasId;
      
      skeletonization.setup(WIDTH,HEIGHT);

      canvas = document.getElementById(canvasId);
      context = canvas.getContext("2d");
    }
    
    that.process = function(strokes,args){
      if (args == undefined){args = {}}
      context.fillStyle="black";
      context.fillRect(0,0,WIDTH,HEIGHT);
      context.strokeStyle="white";
      context.lineWidth = FAT;
      context.lineCap = "round";
      context.lineJoin = "round";
      draw_strokes(context,strokes);
      var nodes = cv_nodes(strokes, args);
    var skin = doodleMeta.buildSkin(strokes,nodes);
    
    console.log(nodes, skin);
	  
	  console.log("build skin finish");
      
      return {nodes:nodes, skin:skin};
    }
    
    that.checkOpenCVReady = function(callback){
      var dummy = document.createElement("canvas");
      dummy.width = 32;
      dummy.height = 32;
      dummy.style.display = "none";
      dummy.id = "test-cvimread-canvas"
      document.body.appendChild(dummy);
      function cv_ready(){
        console.log("ready?")
        var success = false;
        try{
          var src = cv.imread(dummy.id);
          src.delete();
          dummy.parentElement.removeChild(dummy);
          success = true;
        }catch(e){
          // console.log(e);
          setTimeout(cv_ready,500);
        }
        if (success){callback();}
      }
      cv_ready();
    }
    
    
    function draw_strokes(ctx,strokes){
      for (var i = 0; i < strokes.length; i++){
        ctx.beginPath();
        for (var j = 0; j < strokes[i].length; j++){
          if (j == 0){
            ctx.moveTo(strokes[i][j][0], strokes[i][j][1]);
          }else{
            ctx.lineTo(strokes[i][j][0], strokes[i][j][1]);
          }
        }
        ctx.stroke(); 
      }
    }
    
    function find_contours(src){
      let contours = new cv.MatVector();
      let hierarchy = new cv.Mat();
      cv.findContours(src, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      for (let i = 0; i < contours.size(); ++i) {
        cv.drawContours(src, contours, i, [255,255,255,0], -1, 8, hierarchy, 0);
      }
      contours.delete();
      hierarchy.delete();
    }
  
    function cv_nodes(strokes,args){
      if (args == undefined){args = {}}
      try{
        var src = cv.imread(canvas.id);
        console.log("source img", src);
      }
      catch(e){
        console.log(e);
        return [];
      }

      cv.cvtColor(src, src, cv.COLOR_RGB2GRAY);
      let ksize = new cv.Size(BLEED*2+1, BLEED*2+1);
      let anchor = new cv.Point(-BLEED, -BLEED);
      cv.blur(src, src, ksize, anchor, cv.BORDER_DEFAULT);
      cv.threshold(src, src, 128, 255, cv.THRESH_BINARY);
  
      find_contours(src);
  
      var bd = Okb.geometry.bound(strokes.reduce((acc, val) => acc.concat(val), []));
      var bbox = []
      bbox[0] = Math.max(Math.round(bd[0][0]-FAT),0);
      bbox[1] = Math.max(Math.round(bd[0][1]-FAT),0);
      bbox[2] = Math.min(Math.round(bd[1][0]+FAT),WIDTH);
      bbox[3] = Math.min(Math.round(bd[1][1]+FAT),HEIGHT);
  
      skeletonization.skeletonize(src,{
        preprocess: false,
        bbox: bbox
	  });

	  console.log("skeleton finish");
  
    try {
      var tree = doodleMeta.inferTreeFromMat(src,8);
        console.log(tree);
        doodleMeta.filterTree(tree,0.5);
        doodleMeta.simplifyTree(tree);
        doodleMeta.filterTree(tree,0.5);
        doodleMeta.simplifyTree(tree);
        doodleMeta.filterTree(tree,0.5);
        tree = doodleMeta.centerTree(tree,args.center || {x:WIDTH/2,y:HEIGHT/2,types:["node"]})
        src.delete();
      var nodes = doodleMeta.parameterizeTreeToNodes(tree);
    }
    catch(e) {
      console.log("error in tree generation", e);
      return null;
    }
	  
	  console.log("convert to nodes finish");
      return nodes;
    }
  
  
}


function draw_strokes(ctx, strokes){
  for (var i = 0; i < strokes.length; i++){
    ctx.beginPath();
    for (var j = 0; j < strokes[i].length; j++){
      if (j == 0){
        ctx.moveTo(strokes[i][j][0], strokes[i][j][1]);
      }else{
        ctx.lineTo(strokes[i][j][0], strokes[i][j][1]);
      }
    }
    ctx.stroke(); 
  }
}


/////////////////////////////
/////////////////////////////
/////////////////////////////
/////////////////////////////
/////////////////////////////
/////////////////////////////
/////////////////////////////

const REPLAY = true;
const BG_WHITE = true;

document.body.style.background = BG_WHITE ? "#FFFFFF" : "#000000";

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

var FileSaver = require('file-saver');

var io = require('socket.io-client');

const {parse, stringify} = require('flatted/cjs');

// var $ = require("jquery");

// const numRow = 5;
// const numCol = 5;

// for (let i = 0; i < numRow; i++) {
// 	let row = $('<tr></tr>');
// 	for (let j = 0; j < numCol; j++) {
// 		row.append('<td></td>');
// 	}
// 	$('.canvas-grid').append(row);
// }

var socket;

var initSocket = setInterval(() => {
	socket = io('http://localhost:8080/');
	if (socket) {
		socket.on('connect', function(){ console.log("connected")});
		socket.on('disconnect', function(){ console.log("disconnected")});
		socket.emit("message", "connected!");
		clearInterval(initSocket);

		socket.on('drawSegment', (data) => {
			drawSegment(data);
		});

		socket.on('drawSegmentGrid', (data) => {
			drawSegmentGrid(data);
    });
    
    socket.on('finish', () => {
      console.log("finish!");
      console.log(grid);
      let record = {};
      for (let i = 0; i < nRow; i++) {
        for (let j = 0; j < nCol; j++) {
          let idx = i * nCol + j;
          record[idx] = grid[idx].history;
        }
      }

      var s = JSON.stringify(record);
      FileSaver.saveAs(new Blob([s]), "record.json");
    });

		socket.on('endGrid', () => {
      console.log("end drawing");
      
      beginAnimation();
		})

		socket.on('end', () => {
			id = id + 1;
			ctx.clearRect(0, 0, canvas.width, canvas.height)
			beginDraw(id);
		})
	}
}, 1000);

var beginAnimation = () => {
  for (let i = 0; i < nRow * nCol; i++) {
    let canvas = document.getElementById('canvas' + i);
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = BG_WHITE ? 'white' : 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let dummy = document.createElement("canvas");
    dummy.width = canvas.width;
    dummy.height = canvas.height;
    dummy.id = "dummy-canvas"
    document.body.appendChild(dummy);
    ctx = dummy.getContext('2d');
    ctx.lineWidth = 2;
    ctx.fillStyle="black";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle="white";

    // setup rig
    doodleRig.setup({
      width:dummy.width,
      height:dummy.height,
      fat:FAT,
      bleed:BLEED,
      canvasId:"dummy-canvas"
      });

    // generate skeleton
    console.log(grid[i].strokes);
    var ret = doodleRig.process(grid[i].strokes);

      let skin = ret.skin;
      for (let j = 0; j < skin.length; j++) {
        skin[j].x0 = parseFloat(j) / skin.length * canvas.width;
        skin[j].y0 = canvas.height * 0.5;
      }

      grid[i]['nodes'] = ret.nodes;
      grid[i]['skin'] = ret.skin;

      dummy.parentElement.removeChild(dummy);

  }

  setInterval(() => {
    try {
      for (let i = 0; i < nRow * nCol; ++i) {
        var canvas = document.getElementById('canvas' + i);
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let time = (new Date()).getTime();
        
        let nodes = grid[i].nodes;
        let skin = grid[i].skin;
        for (var j = 0; j < nodes.length; j++){
          if (nodes[j].parent ){
            var r = Math.min(Math.max(parseFloat(atob(nodes[j].id)),0.3),0.7);
            nodes[j].th = nodes[j].th0 + Math.sin(time*(i+1)*0.001/r+r*Math.PI*2)*r*0.2*Math.sin(i+1);
          }
          else
          {
            nodes[j].th = nodes[j].th0;
          }
        }
        doodleMeta.forwardKinematicsNodes(nodes);
        doodleMeta.calculateSkin(skin);
          
        ctx.strokeStyle = BG_WHITE ? 'black' : 'white';
        ctx.fillStyle = "none";
        ctx.lineWidth = 1.0 + Math.random();
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        
        let t = time * 0.008;
        for (var j = 0; j < skin.length; j++){
          // let x0 = skin[j].x0 * (1 + 0.001 * (Math.sin(t*0.2 + 0.8*j) + 0.76*Math.sin(2.1*t*0.2 + 0.2*j) + 0.43*Math.sin(3.32*t*0.25 + 0.45*j)));
          // let y0 = skin[j].y0 * (1 + powerLerp(0.4, 0.0002, Math.abs(skin[j].x0 - canvas.width*0.5) / (canvas.width*0.5), 0.2) * (Math.sin(t*0.9 + 0.8*j) + 0.76*Math.sin(2.1*t*0.89 + 0.2*j) + 0.43*Math.sin(3.32*t*0.86 + 0.45*j)));
          // lerpMousePos[i].x = lerp(lerpMousePos[i].x, mousePos.x, 0.001 * (i+1) / n);
          // lerpMousePos[i].y = lerp(lerpMousePos[i].y, mousePos.y, 0.001 * (i+1) / n);
          // let target_x = powerLerp(x0, skin[j].x, Math.abs(lerpMousePos[i].x - window.innerWidth*0.5) / (window.innerWidth*0.5), 1.7 + 1.5 * Math.sin(j  * 50 / skin.length));
          // let target_y = powerLerp(y0, skin[j].y, Math.abs(lerpMousePos[i].y - window.innerHeight*0.5) / (window.innerHeight*0.5), 1.6 + 1.3 * Math.sin(j  * 40 / skin.length));
          let target_x = skin[j].x;
          let target_y = skin[j].y;
          if (!skin[j].connect){
            if (j != 0){
            ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(target_x * SCALE, target_y * SCALE);
          }else{
            ctx.lineTo(target_x * SCALE, target_y * SCALE);
          }
        }
        ctx.stroke();
      }
    }catch(e) {
      console.log(e);
    }
    
  }, 30);
}



var parseQuery = function(query) {
	query = query.trim();
	if (query[0] === '?') {
		query = query.substr(1);
	}
	var ret = {};
	query.split('&').forEach(function(part) {
		var a = part.split('=');
		ret[a[0]] = a[1];
	});
	return ret;
};

var grayToColor = function(gray) {
	var c = ('00' + gray.toString(16)).substr(-2);
	return '#' + c + c + c;
};

var eachWithTimeout = function(array, fn, timeout) {
	return new Promise(function(resolve, reject) {
		var tmp = function(i) {
			if (i >= array.length) {
                //resolve();
                // canvas.toBlob(function(blob) {
                //     FileSaver.saveAs(blob, (id - 1) + ".png");
				// });
				ctx.clearRect(0, 0, canvas.width, canvas.height);
                id = id + 1;
                fetch('data/' + id + '.txt')
                .then(r => r.text())
                .then(parseQuery)
                .then(drawVaryingWidth);
                
			} else {
				setTimeout(function() {
					fn(array[i]);
					tmp(i + 1);
				}, timeout);
			}
		};
		tmp(0);
	});
};

var drawSheep = function(sheep) {
	var xOff = parseFloat(sheep.xOff, 10);
	var yOff = parseFloat(sheep.yOff, 10);

	ctx.beginPath();
	return eachWithTimeout(sheep.drawing.split('_'), function(s) {
		cmd = s.split('.');

		if (cmd[0] === 'lift') {
			ctx.beginPath();
		} else if (cmd[0] === 'stroke') {
			ctx.lineWidth = parseInt(cmd[1], 10);
		} else if (cmd[0] === 'grey') {
			ctx.strokeStyle = grayToColor(parseInt(cmd[1], 10));
		} else if (parseInt(cmd[0], 10)) {
			var coords = cmd.map(x => parseInt(x, 10));
			ctx.moveTo(coords[2] + xOff, coords[3] + yOff);
			ctx.lineTo(coords[0] + xOff, coords[1] + yOff);
			ctx.stroke();
		}
	}, 0.1);
};

var parseJsonSheep = (data) => {
  console.log(data);
  data = JSON.parse(data);
  console.log(data);
  ctx.beginPath();
  return eachWithTimeout(data, function(cmd) {
    if (cmd.type == "line_to") {
      ctx.lineTo(cmd.x, cmd.y);
    }
    else if (cmd.type == "move_to") {
      ctx.moveTo(cmd.x, cmd.y);
    }
    else if (cmd.type == "close_path") {
      ctx.stroke();
      ctx.beginPath();
    }
		
	}, 50);
}

let mousePos = {x: 0, y: 0};

// function getMousePos(e) {
//   return {x:e.clientX,y:e.clientY};
// }
// document.onmousemove=function(e) {
//   mousePos = getMousePos(e);
// };


let width = 1;
let minWidth = 0.8;
let maxWidth = 1.7;
let deltaWidth = 0.1;
let lastDistance = 0.0;
let firstStroke = true;

let drawSequence = [];

var FAT = 15;
var BLEED = 5;
let NODES = [];
let SKIN = []

let lastPos = null;

var distance = (x1, y1, x2, y2) => {
    return Math.sqrt((x1 - x2)**2 + (y1 - y2)**2);
}

var lerp = (x0, x1, t) => {
  return x0 + (x1 - x0) * t;
}

var powerLerp = (x0, x1, t, k) => {
  return x0 + (x1 - x0) * Math.pow(t, k);
}

// TODO change data format to JSON
var parseSheep = (sheep) => {
	var xOff = parseFloat(sheep.xOff, 10);
  var yOff = parseFloat(sheep.yOff, 10);
  
  let drawSequence = []
	
	let commands = sheep.drawing.split('_');
	let seq = [];
	commands.forEach(s => {
		cmd = s.split('.');
		if (cmd[0] === 'lift') {
			if (seq.length > 1) {
				drawSequence.push(seq.slice());
			}
			seq = [];
		}
		else if (parseInt(cmd[0], 10)) {
			coords = cmd.map(x => parseInt(x, 10));
			seq.push([coords[0] + xOff, coords[1] + yOff]);
		}
	})

	socket.emit('draw', drawSequence);
	return drawSequence;
	
}

var saveRig = (strokes) => {
  doodleRig.checkOpenCVReady(() => {console.log('cv ready'); });
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  ctx.lineWidth = 1;
  ctx.fillStyle="white";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle="black";
  draw_strokes(ctx, strokes);

  doodleRig.setup({
    width:canvas.width,
    height:canvas.height,
    fat:FAT,
    bleed:BLEED,
    canvasId:'canvas'
    });

  var ret = doodleRig.process(strokes);

  var allNodes = {};

  let skin = ret.skin;
  for (let j = 0; j < skin.length; j++) {
    skin[j].x0 = parseFloat(j) / skin.length * canvas.width;
    skin[j].y0 = canvas.height * 0.5;
  }

  ret.nodes.forEach((item) => {
    allNodes[item.id] = stringify(item);
  })

  //var blob = new Blob(, {type: "text/plain;charset=utf-8"});
  var s = stringify([allNodes, ret.nodes, ret.skin]);
  FileSaver.saveAs(new Blob([s]), id + "_rig.json");

  id = id + 1;

  beginDraw(id);
}

var grid = {};
const nRow = 7;
const nCol = 7;
const SCALE = 0.7;

var initGrid = function() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  ctx.fillStyle = BG_WHITE ? 'white' : 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

	for (let i = 0; i < nRow; i++) {
		for (let j = 0; j < nCol; j++) {
			let idx = i * nCol + j;
      grid[idx] = {firstStroke: true, lastPos: {x: 0, y: 0}, width: minWidth, lastDistance: 0, strokes: [], history:[]};
      var canvas = document.getElementById('canvas' + idx);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = BG_WHITE ? 'white' : 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
		}
	}
}

initGrid();

let drawing = true;

var replay = (recordData) => {
  let record = JSON.parse(recordData);
  let progress = {};
  for (let i = 0; i < nRow; i++) {
		for (let j = 0; j < nCol; j++) {
			let idx = i * nCol + j;
			progress[idx] = 0;
		}
  }
  
  const delta = 10;
  setInterval(() => {
    for (let i = 0; i < nRow; i++) {
      for (let j = 0; j < nCol; j++) {
        let idx = i * nCol + j;
        let prog = progress[idx];
        if (drawing) {
          drawSegmentGrid({id: idx, data: record[idx].slice(prog, prog + delta)});
          
          progress[idx] += delta;
          if (progress[idx] >= record[idx].length) {
            clearInterval(replay);
            beginAnimation();
            drawing = false;
          }
        }
      }
    }
  }, 30);
}

// draw a sequence on a canvas of the grid
var drawSegmentGrid = function(data) {
	let idx = data.id;
	var canvas = document.getElementById('canvas' + idx);
	var ctx = canvas.getContext('2d');
	ctx.lineCap = 'round';
  ctx.strokeStyle = BG_WHITE ? 'rgba(0, 0, 0, 0.07)':'rgba(255, 255, 255, 0.07)';
  ctx.fillStyle = "none";

	let seq = data.data;

	if (grid === {}) { initGrid();}

  if (idx == 0) console.log("receive segment", seq);
  
  let grid_state = grid[idx];
  //ctx.beginPath();

  grid_state.history = grid_state.history.concat(seq.slice());
  

	seq.forEach((cmd) => {
    let x, y;

    if (cmd.type == 'begin_path') {
      ctx.beginPath();
      //ctx.moveTo(grid_state.lastPos.x * SCALE, grid_state.lastPos.y * SCALE);
      grid_state.strokes.push([])
    }
    else if (cmd.type == 'move_to') {
      [x, y] = [cmd.x, cmd.y];
      ctx.moveTo(x * SCALE, y * SCALE);
      grid_state.lastDistance = distance(x, y, grid_state.lastPos.x, grid_state.lastPos.y);
      [grid_state.lastPos.x, grid_state.lastPos.y] = [x, y];
      let k = grid_state.strokes.length - 1;
      grid_state.strokes[k].push([x, y]);
    }
    else if (cmd.type == "line_to") {
      [x, y] = [cmd.x, cmd.y];
      let d = distance(x, y, grid_state.lastPos.x, grid_state.lastPos.y);
      if (d < 50) {
        ctx.lineTo(x * SCALE, y * SCALE);
        if (d > grid_state.lastDistance) grid_state.width = Math.max(minWidth, grid_state.width - deltaWidth);
        else grid_state.width = Math.min(maxWidth, grid_state.width + deltaWidth);
        ctx.lineWidth = grid_state.width;
        grid_state.lastDistance = d;
        let k = grid_state.strokes.length - 1;
        grid_state.strokes[k].push([x, y]);
      }
      else {
        // unexpected movement
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x * SCALE, y * SCALE);
      }
      [grid_state.lastPos.x, grid_state.lastPos.y] = [x, y];
      
    }
    else if (cmd.type == 'close_path') {
      ctx.stroke();
    }

  });
  
  ctx.stroke();

}


var drawVaryingWidth = function(sheep) {
	var xOff = parseFloat(sheep.xOff, 10);
    var yOff = parseFloat(sheep.yOff, 10);
    

	//ctx.beginPath();
	return eachWithTimeout(sheep.drawing.split('_'), function(s) {
		cmd = s.split('.');

		if (cmd[0] === 'lift') {
            width = minWidth;
            ctx.lineWidth = width;
		} else if (cmd[0] === 'stroke') {
			//ctx.lineWidth = parseInt(cmd[1], 10);
		} else if (cmd[0] === 'grey') {
			ctx.strokeStyle = grayToColor(parseInt(cmd[1], 10));
		} else if (parseInt(cmd[0], 10)) {
            ctx.beginPath();
            var coords = cmd.map(x => parseInt(x, 10));
            let d = distance(coords[2], coords[3], coords[0], coords[1]);
            if (d > lastDistance * 1.1) {
                width = Math.max(minWidth, width - deltaWidth);
            }
            else if (d < lastDistance * 0.9) {
                width = Math.min(maxWidth, width + deltaWidth);
            }
            ctx.lineWidth = width;
            lastDistance = d;
			ctx.moveTo(coords[2] + xOff, coords[3] + yOff);
			ctx.lineTo(coords[0] + xOff, coords[1] + yOff);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.003)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
		}
	}, 5);
};

var q = parseQuery(location.search);
var id = parseInt(q.sheep, 10);

const beginDraw = (id) => {
	if (id) {
		const sheepId = document.getElementById('current_sheep_id');
    sheepId.innerHTML = id;
    
    // fetch('data/cleaned_sheep.json')
    //   .then(r => r.text())
    //   .then(parseJsonSheep);

    // return;

    if (REPLAY) {
      fetch('data/record/' + 'record.json')
        .then(r => r.text())
        .then(replay)
      return;
    }

		fetch('data/' + id + '.txt')
			.then(r => r.text())
			.then(parseQuery)
			//.then(drawSheep);
			//.then(drawVaryingWidth);
			.then(parseSheep)
      //.then(testAnimation);
      //.then(saveRig);
      //.then(testAnimationRig);
	}
}

beginDraw(id);

const sheepInput = document.querySelector('input');
sheepInput.addEventListener('keyup', (e) => {
	if (e.keyCode == 13) { // enter
		id = parseInt(sheepInput.value, 10);
		beginDraw(id);
	}
});

let sliders = ['latent_x', 'latent_y', 'smooth_window', 
'smooth_iterations', 'delta_scale_x', 'delta_scale_y', 
'segment_delta', 'delta_scale_2_x', 'delta_scale_2_y']

sliders.forEach(item => {
	let slider = document.getElementById(item);
	let output = document.getElementById(item + '_val');
	output.innerHTML = slider.value;

	slider.oninput = function() {
		output.innerHTML = this.value;
		json = JSON.parse('{"' + item + '": ' + this.value + '}')
		socket.emit('setting', json);
		console.log('set', json);
	}
})


let isPainting = false;

var startPaint = (event) => {
  mousePos = {
    x: event.pageX - canvas.offsetLeft,
    y: event.pageY - canvas.offsetTop
  };
  socket.emit('begin_path');
  socket.emit('move_to', mousePos);
  isPainting = true;
}

var paint = (event) => {
  if (!isPainting) return;
  ctx.fillStyle = 'none';
  ctx.strokeStyle = BG_WHITE ? 'black' : 'white';
  ctx.beginPath();
  ctx.moveTo(mousePos.x, mousePos.y); // old pos
  mousePos = {
    x: event.pageX - canvas.offsetLeft,
    y: event.pageY - canvas.offsetTop
  };
  ctx.lineTo(mousePos.x, mousePos.y); // new pos  
  ctx.stroke();
  socket.emit('line_to', mousePos);
}

var exitPaint = (event) => {
  if (!isPainting) return;
  mousePos = {
    x: event.pageX - canvas.offsetLeft,
    y: event.pageY - canvas.offsetTop
  };
  ctx.moveTo(mousePos.x, mousePos.y);
  socket.emit('line_to', mousePos);
  socket.emit('close_path');
  isPainting = false;
}


canvas.addEventListener('mousedown', startPaint);
canvas.addEventListener('mousemove', paint);
canvas.addEventListener("mouseup", exitPaint);
canvas.addEventListener("mouseleave", exitPaint);