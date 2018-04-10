const fs = require("fs");
const path = require("path");

const yargs = require("yargs").argv;

const base = yargs.base;
if (!base)
  throw new Error("Invalid base path (specify with --base)");
  
const resolvedBase = path.resolve(base);
forceRequireModules("./");

function forceRequireModules(p) {
  const dirPath = path.resolve(base, p);
  const fileNames = fs.readdirSync(dirPath);
  for (const fileName of fileNames) {
    if (fileName === "node_modules" || fileName === "lib")
      continue;  
    const filePath = path.resolve(dirPath, fileName);
    if (fileName.endsWith(".ts") && !fileName.endsWith(".test.ts")) {
      const requirePath = path.join(resolvedBase, p, path.basename(fileName, ".ts"));
      require(requirePath);
    } else if (fs.lstatSync(filePath).isDirectory()) {
      forceRequireModules(fileName);
    }
  }
}
