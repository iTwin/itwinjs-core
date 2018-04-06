const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
for (const p of args)
  req(p);

function req(p) {
  const fileNames = fs.readdirSync(p);
  for (const fileName of fileNames) {
    const filePath = path.resolve(p, fileName);
    if (filePath.endsWith(".js"))
      require(filePath);
    else if (fs.lstatSync(filePath).isDirectory())
      req(filePath);
  }
}
