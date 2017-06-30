/*--------------------------------------------------------------------------------------+
|
|     $Source: gulpfile.js $
|
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
|
+--------------------------------------------------------------------------------------*/
const gulp = require('gulp');
const tools = require('@bentley/bentleyjs-tools');
const mocha = tools.mocha
const gutil = tools.gutil
const yargs = tools.yargs
const argv = yargs.argv;
const paths = {}

paths.source = './source/*.ts'
paths.tests = './source/test/*.ts'
paths.lib = './lib'
paths.libtests = paths.lib + '/test'

// build all typescript files in source directory
gulp.task('build', () => {
  let opts = {}

  if (argv.release) {
    opts = { compress: {} }
    gutil.log(gutil.colors.blue("release build"))
  }

  return tools.buildTs(undefined, paths.source, paths.lib, opts);
});

// build all test files 
gulp.task('buildtests', () => {
  return tools.buildTs(undefined, paths.tests, paths.libtests);
});

gulp.task('clean', () => {
  tools.removeDirectoryAndContents(paths.lib);
});

// build everything and then run the tests 
gulp.task('test', ['build', 'buildtests'], () => {
  return gulp.src(paths.libtests + '/*.test.js')
    .pipe(mocha({
      reporter: 'progress'
    }));
});

// Rerun the task when a file changes
gulp.task('watch', () => {
  gulp.watch(paths.source, ['build']);
  gulp.watch(paths.tests, ['buildtests']);
});

// Default
gulp.task('default', ['build']);

