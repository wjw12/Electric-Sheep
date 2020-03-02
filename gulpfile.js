var gulp = require('gulp');
var watch = require('gulp-watch');
var browserify = require('browserify');
var rename = require('gulp-rename');
var source = require('vinyl-source-stream'); // required to dest() for browserify
var browserSync = require('browser-sync').create();
var notifier = require('node-notifier');

function sync() {
	browserSync.init({
        server: {
            baseDir: "./"
        }
    });
}

function js() {
		
	var bundleStream = browserify('./js/sheep.js')
		.bundle()
		.on('error', function(err) {
			console.log(err.stack);
			notifier.notify({
				'title': 'Browserify Compilation Error',
				'message': err.message
			});
			this.emit('end');
		});

	return bundleStream
		.pipe(source('sheep.js'))
		.pipe(rename('bundle.js'))
		.pipe(gulp.dest('./assets/js/'))
		.pipe(browserSync.stream());
}


function html() {
	return gulp.src(['./index.html'])
		.pipe(browserSync.stream()); // causes injection of html changes on save
}

function watchJs() {

	watch(['./js/*.js'], function() {
		gulp.start('js');
	});
}

function watchHtml() {
	watch('./*.html', function() {
		gulp.start('html');
	});	

}

exports.js = js;
exports.html = html;
exports.watchJs = watchJs;
exports.watchHtml = watchHtml;

exports.default = gulp.series(js, html, gulp.parallel(sync, watchJs, watchHtml));