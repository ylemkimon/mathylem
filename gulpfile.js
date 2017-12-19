/* eslint no-console: "off", no-underscore-dangle: "off", camelcase: "off" */
const browserify = require('browserify');
const gulp = require('gulp');
const concat = require('gulp-concat');
const merge = require('merge-stream');
const sass = require('gulp-sass');
const prefix = require('gulp-autoprefixer');
const cleancss = require('gulp-clean-css');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const rename = require('gulp-rename');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');

const BUILD = 'build/';

function buildJS(debug) {
  let stream = browserify({
    transform: 'babelify',
    entries: ['js/mathylem.js'],
    standalone: 'MathYlem',
    debug,
  }).bundle()
    .pipe(source(debug ? 'mathylem.min.js' : 'mathylem.js'))
    .pipe(buffer());

  if (debug) {
    stream = stream.pipe(sourcemaps.init({ loadMaps: true }));
  } else {
    stream = stream.pipe(gulp.dest(BUILD))
      .pipe(rename({ extname: '.min.js' }));
  }

  stream = stream.pipe(uglify({
    output: {
      ascii_only: true,
    },
  }));

  if (debug) {
    stream = stream.pipe(sourcemaps.write('./'));
  }

  return stream.pipe(gulp.dest(BUILD));
}

gulp.task('js', () => buildJS(false));
gulp.task('js-debug', () => buildJS(true));

gulp.task('css', () => {
  const scss = gulp.src('css/*.scss')
    .pipe(sass())
    .pipe(prefix());

  return merge(scss, gulp.src(['node_modules/katex/static/katex.css', 'css/*.css']))
    .pipe(concat('mathylem.css'))
    .pipe(gulp.dest(BUILD))
    .pipe(rename({ extname: '.min.css' }))
    .pipe(cleancss())
    .pipe(gulp.dest(BUILD));
});

gulp.task('fonts', () => gulp.src(['lib/katex/static/fonts/*', 'css/fonts/*'])
  .pipe(gulp.dest(`${BUILD}fonts/`)));

gulp.task('default', ['js', 'css', 'fonts']);
