var browserify = require('browserify');
var babelify = require('babelify');
var gulp = require('gulp');
var concat = require('gulp-concat');
var less = require('gulp-less');
var merge = require('merge-stream');
var cleancss = require('gulp-clean-css');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var gutil = require('gulp-util');

var BUILD = 'build/';

gulp.task('js', function () {
  return browserify({
      entries: ['./js/mathylem.js'],
      standalone: 'MathYlem'
    }).transform(babelify.configure({
      // from /lib/katex/.babelrc
      presets: ["es2015", "flow"],
      plugins: [
        "transform-runtime",
        "transform-class-properties"
      ],
      only: /lib\/katex/
    }))
    .bundle()
    .on('error', gutil.log)
    .pipe(source('mathylem.js'))
    .pipe(buffer())
    .pipe(gulp.dest(BUILD))
    .pipe(rename({ extname: '.min.js' }))
    .pipe(uglify({
      mangle: false,
      output: {
        ascii_only: true
      }
    }))
    .pipe(gulp.dest(BUILD));
});

gulp.task('css', function() {
  var katex = gulp.src('lib/katex/static/katex.less')
    .pipe(less())

  return merge(katex, gulp.src(['./css/*.css']))
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
