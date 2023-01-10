// npm install fs-extra
const fse = require("fs-extra");
//child_process.exec(command[, options][, callback])
const childProcess = require("child_process");
const path = require("path");
const command = "node install-run-rush.js docs";
const options = {
  encoding: "utf8",
  cwd: path.resolve("..", "..", "..", "itwinjs-core", "common", "scripts"),
};
childProcess.exec(command, options, (err, stdout, stderr) => {
  console.log("done");
  if (err) {
    console.log(err);
    console.log(stderr);
  } else {
    console.log(stdout);
    copyDocs();
  }
});
function copyDocs() {
  try {
    fse.copySync("../../../itwinjs-core/generated-docs/core", "../../../itwinjs-core/staging-docs/reference");
    fse.copySync("../../../itwinjs-core/generated-docs/domains", "../../../itwinjs-core/staging-docs/reference");
    fse.copySync("../../../itwinjs-core/generated-docs/editor", "../../../itwinjs-core/staging-docs/reference");
    fse.copySync("../../../itwinjs-core/generated-docs/presentation", "../../../itwinjs-core/staging-docs/reference");
    fse.copySync("../../../itwinjs-core/generated-docs/ui", "../../../itwinjs-core/staging-docs/reference");
    fse.copySync("../../../itwinjs-core/generated-docs/extract", "../../../itwinjs-core/staging-docs/extract");
    console.log("COPYING FINISHED");
  } catch (err) {
    console.log(err);
  }
}