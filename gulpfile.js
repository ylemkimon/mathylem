var browserify = require('browserify');
var gulp = require('gulp');
var concat = require('gulp-concat');
var merge = require('merge-stream');
var sass = require('gulp-sass');
var prefix = require('gulp-autoprefixer');
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
  var scss = gulp.src('./css/*.scss')
    .on('error', gutil.log)
    .pipe(sass())
    .pipe(prefix());

  return merge(scss, gulp.src([
      'node_modules/katex/static/katex.css', 'css/*.css']))
    .pipe(concat('mathylem.css'))
    .pipe(gulp.dest(BUILD))
    .pipe(rename({ extname: '.min.css' }))
    .pipe(cleancss())
    .pipe(gulp.dest(BUILD));
});

gulp.task('fonts', function () {
  return gulp.src(['lib/katex/static/fonts/*', 'css/fonts/*'])
    .pipe(gulp.dest(BUILD + 'fonts/'));
});

gulp.task('default', ['js', 'css', 'fonts']);
