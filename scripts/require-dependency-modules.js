const fs = require("fs");
const path = require("path");
const yargs = require("yargs").argv;

const base = yargs.base;
if (!base)
  throw new Error("Invalid base path (specify with --base)");

const includeDirs = yargs._;
if (0 === includeDirs.length)
  throw new Error("No dependencies specified");

for (const include of includeDirs)
  forceRequireModules(path.join(include, "lib"));

function forceRequireModules(p) {
  const dirPath = path.resolve(base, "node_modules", p);
  const fileNames = fs.readdirSync(dirPath);
  for (const fileName of fileNames) {
    const filePath = path.resolve(dirPath, fileName);
    if (fileName.endsWith(".js") && !fileName.endsWith(".test.js")) {
      const requirePath = `${dirPath}/${path.basename(fileName, ".js")}`;
      require(requirePath);
    } else if (fs.lstatSync(filePath).isDirectory()) {
      forceRequireModules(filePath);
    }
  }
}
