
var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
ctx.lineCap = 'round';
ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'

var FileSaver = require('file-saver');

var io = require('socket.io-client');

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
		})

		socket.on('endGrid', () => {
			console.log("end drawing");
			// for (let id = 0; id < 25; id++) {
			// 	let canvas = document.getElementById('canvas'+id);
			// 	canvas.toBlob(function(blob) {
			// 			FileSaver.saveAs(blob, 'grid' + id + ".png");
			// 		});
			// }
		})

		socket.on('end', () => {
			id = id + 1;
			ctx.clearRect(0, 0, canvas.width, canvas.height)
			beginDraw(id);
		})
	}
}, 1000);



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


let width = 1;
let minWidth = 0.2;
let maxWidth = 2;
let deltaWidth = 0.05;
let lastDistance = 0.0;
let firstStroke = true;

let drawSequence = [];

let lastPos = null;

var distance = (x1, y1, x2, y2) => {
    return Math.sqrt((x1 - x2)**2 + (y1 - y2)**2);
}

var parseSheep = (sheep) => {
	var xOff = parseFloat(sheep.xOff, 10);
	var yOff = parseFloat(sheep.yOff, 10);
	
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
	drawSequence = [];
}

// draw a sequence sent from server
var drawSegment = function(data) {
	if (data.length <= 1) {
		firstStroke = true;
		return;
	}

	if (!lastPos) {
		lastPos = data[0];
	}

	//ctx.beginPath();
	//ctx.moveTo(lastPos[0], lastPos[1]);

	data.forEach((coord, i) => {
		if (i > 0) {
			let x = coord[0];
			let y = coord[1];
			if (x === 0 && y === 0) {
				width = minWidth;
				ctx.lineWidth = width;
				firstStroke = true;
			}
			else {
				ctx.beginPath()
				let d = coord[2];
				if (d > lastDistance) {
					width = Math.max(minWidth, width - deltaWidth);
				}
				else if (d < lastDistance) {
					width = Math.min(maxWidth, width + deltaWidth);
				}
				lastDistance = d;
				ctx.lineWidth = width;
				if (firstStroke) {
					firstStroke = false;
					ctx.moveTo(x,y);
				}
				else if (distance(x, y, lastPos[0], lastPos[1]) < 50) {
					ctx.moveTo(lastPos[0], lastPos[1]);
					ctx.lineTo(x, y);
				}
				lastPos = [x, y];
				//ctx.fillStyle = 'rgba(255,255,255,0.003)';
            	//ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.stroke();
			}
		}
	})

}

var grid = {};
const nRow = 5;
const nCol = 5;

var initGrid = function() {
	for (let i = 0; i < nRow; i++) {
		for (let j = 0; j < nCol; j++) {
			let idx = i * nCol + j;
			grid[idx] = {firstStroke: true, lastPos: [0, 0], width: minWidth, lastDistance: 0};
		}
	}
}

initGrid();

// draw a sequence on a canvas of the grid
var drawSegmentGrid = function(data) {
	let idx = data.id;
	var canvas = document.getElementById('canvas' + idx);
	var ctx = canvas.getContext('2d');
	ctx.lineCap = 'round';
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'

	let seq = data.seq;

	if (grid === {}) { initGrid();}

	//console.log("receive segment", data);
	if (seq.length <= 1) {
		grid[idx].firstStroke = true;
		return;
	}

	seq.forEach((coord, i) => {
		if (i > 0) {
			let x = coord[0];
			let y = coord[1];
			if (x === 0 && y === 0) {
				grid[idx].width = minWidth;
				ctx.lineWidth = grid[idx].width;
				grid[idx].firstStroke = true;
			}
			else {
				ctx.beginPath()
				let d = coord[2];
				if (d > grid[idx].lastDistance) {
					grid[idx].width = Math.max(minWidth, grid[idx].width - deltaWidth);
				}
				else if (d < grid[idx].lastDistance) {
					grid[idx].width = Math.min(maxWidth, grid[idx].width + deltaWidth);
				}
				grid[idx].lastDistance = d;
				ctx.lineWidth = grid[idx].width;
				if (grid[idx].firstStroke) {
					grid[idx].firstStroke = false;
					ctx.moveTo(x,y);
				}
				else if (distance(x, y, grid[idx].lastPos[0], grid[idx].lastPos[1]) < 50) {
					ctx.moveTo(grid[idx].lastPos[0], grid[idx].lastPos[1]);
					ctx.lineTo(x, y);
				}
				grid[idx].lastPos = [x, y];
				//ctx.fillStyle = 'rgba(255,255,255,0.003)';
            	//ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.stroke();
			}
		}
	});


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
		fetch('data/' + id + '.txt')
			.then(r => r.text())
			.then(parseQuery)
			//.then(drawSheep);
			//.then(drawVaryingWidth);
			.then(parseSheep);
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
