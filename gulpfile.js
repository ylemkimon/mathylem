var browserify = require('browserify');
var gulp = require('gulp');
var concat = require('gulp-concat');
var cleancss = require('gulp-clean-css');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');

var BUILD = 'build/';

gulp.task('js', function () {
  return browserify({
    entries: ['./js/mathylem.js'],
    standalone: 'MathYlem'
  }).bundle()
    .on('error', gutil.log)
    .pipe(source('mathylem.js'))
    .pipe(buffer())
    .pipe(gulp.dest(BUILD))
    .pipe(rename({ extname: '.min.js' }))
    .pipe(uglify({
      output: {
        ascii_only: true
      }
    }))
    .pipe(gulp.dest(BUILD));
});

gulp.task('js-debug', function () {
  return browserify({
    entries: ['./js/mathylem.js'],
    standalone: 'MathYlem',
    debug: true
  }).bundle()
    .on('error', gutil.log)
    .pipe(source('mathylem.min.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(uglify({
      output: {
        ascii_only: true
      }
    }))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(BUILD));
});

gulp.task('css', function () {
  return gulp.src(['node_modules/katex/static/katex.css', './css/*.css'])
    .pipe(concat('mathylem.css'))
    .pipe(gulp.dest(BUILD))
    .pipe(rename({ extname: '.min.css' }))
    .pipe(cleancss())
    .pipe(gulp.dest(BUILD));
});

gulp.task('fonts', function () {
  return gulp.src('lib/katex/static/fonts/*')
    .pipe(gulp.dest(BUILD + 'fonts/'));
});

gulp.task('symbols', function () {
  return gulp.src('data/*.json')
    .pipe(gulp.dest(BUILD));
});

gulp.task('default', ['js', 'css', 'fonts', 'symbols']);
