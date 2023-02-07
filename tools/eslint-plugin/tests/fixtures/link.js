// can't reliably have symlinks on windows,
// so create them in this script called at package dependency installation (rush install)
// using the `prepare` script in package.json

const path = require("path");
const fs = require("fs");

function linkFixtureNoInternal() {
  fs.symlinkSync(
    path.normalize("../../workspace-pkg-2"),
    path.join(__dirname, "fixtures/no-internal/workspace-pkg-1/node_modules/"),
    "dir"
  );
}

try {
  linkFixtureNoInternal();
} catch {
  // ignore errors, it probably already exists, and we don't want to bother people
  // with an error at install time
}
