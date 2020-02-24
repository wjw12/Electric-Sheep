var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
ctx.lineCap = 'round';

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
                id = id + 1;
                fetch('data/' + id + '.txt')
                .then(r => r.text())
                .then(parseQuery)
                //.then(drawSheep);
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
	}, 5);
};


let width = 5;
let minWidth = 1;
let maxWidth = 8;
let deltaWidth = 0.5;
let lastDistance = 0.0;

var distance = (x1, y1, x2, y2) => {
    return Math.sqrt((x1 - x2)**2 + (y1 - y2)**2);
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
if (id) {
	fetch('data/' + id + '.txt')
		.then(r => r.text())
		.then(parseQuery)
        //.then(drawSheep);
        .then(drawVaryingWidth);
        
}

const sheepInput = document.querySelector('input');
sheepInput.addEventListener('input', () => {
    id = parseInt(sheepInput.value, 10);
    if (id) {
        fetch('data/' + id + '.txt')
		.then(r => r.text())
		.then(parseQuery)
        .then(drawVaryingWidth);
    }
});