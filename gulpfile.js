/*--------------------------------------------------------------------------------------+
|
|     $Source: gulpfile.js $
|
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
|
+--------------------------------------------------------------------------------------*/
const gulp = require ("gulp");
const tools = require ("@bentley/imodeljs-tools");

var tsProject = tools.createTsProject();

gulp.task ("build", function() {
    return tools.buildTs (tsProject, "./source/**/*.ts", "./lib");
});

gulp.task ("clean", function() {
    tools.removeDirectoryAndContents ("./lib");
});
