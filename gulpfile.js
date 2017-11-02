/*--------------------------------------------------------------------------------------+
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
+--------------------------------------------------------------------------------------*/

const gulp = require("gulp");
const bentleyTools = require("@bentley/bentleyjs-tools");
const grepFail = require("gulp-grep-fail");

// initialize and add the default Bentley gulp tasks
bentleyTools.init(gulp);

// defines "gulp grep" task
gulp.task("grep", ["grepCommon", "grepFrontend", "grepMiddle", "grepBackend"], () => {
});

gulp.task("grepCommon", () => {
  return gulp.src("source/common/**/*.ts").pipe(grepFail(["/frontend/", "/middle/", "/backend/"]));
});

gulp.task("grepFrontend", () => {
  return gulp.src("source/frontend/**/*.ts").pipe(grepFail(["/backend/"]));
});

gulp.task("grepMiddle", () => {
  return gulp.src("source/middle/**/*.ts").pipe(grepFail(["/frontend/"]));
});

gulp.task("grepBackend", () => {
  return gulp.src("source/backend/**/*.ts").pipe(grepFail(["/frontend/"]));
});
