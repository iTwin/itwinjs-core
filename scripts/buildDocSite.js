/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const childProcess = require("child_process");
const fs = require("fs-extra");
const path = require("path");

runExtract();
runDocs();
generateDocs();

// rush extract
function runExtract() {
  childProcess.execSync("rush extract", { stdio: [0, 1, 2] });
}

// rush docs
function runDocs() {
  childProcess.execSync("cpx ./docs/**/* ./out/docs", { stdio: [0, 1, 2] });
  childProcess.execSync("rush docs", { stdio: [0, 1, 2] });
}

function generateDocs() {
  const source = path.resolve("out/docs");
  const destination = path.resolve("out/docs-public");
  const exe = path.resolve("node_modules", ".bin", "bmsWatch");
  childProcess.execSync(
    `${exe} --source "${source}" --destination "${destination}" --siteTitle "ECPresentation Docs"`,
    { stdio: [0, 1, 2] }
  );
}
