/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */
import * as express from "express";
import * as path from "path";

const app = express();

// Enable CORS for all apis
app.all("/*", (_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Correlation-Id, X-Session-Id, X-Application-Id, X-Application-Version, X-User-Id, X-Protocol-Version");
  next();
});

// The generated HTML file should be served at the "root" URL (i.e., http://localhost:3000/).
app.use("/", (req, resp, next) => {
  if (req.path === "/")
    resp.sendFile(process.env.CERTA_PATH!);
  else
    next();
});

// Handle a special route for serving absolute paths and files from node_modules
app.use("/@/", (_req, resp) => {
  const filePath = _req.originalUrl.replace(/^\/@\//, "");
  const sourceMap = require("source-map-support").retrieveSourceMap(filePath);
  resp.sendFile(path.resolve("/", filePath), {
    headers: (sourceMap) && {
      "X-SourceMap": `/@/${sourceMap.url}`, // eslint-disable-line @typescript-eslint/naming-convention
    },
  });
});

// Serve static assets from any configured "public" directories
const publicDirs: string[] = JSON.parse(process.env.CERTA_PUBLIC_DIRS || "[]");
for (const publicDir of publicDirs) {
  app.use(express.static(publicDir));
}

// All other routes should log a warning
const alreadyLogged = new Set<string>();
app.use("*", (req, resp) => {
  // Don't repeat these warnings if the same asset was requested multiple times.
  if (!alreadyLogged.has(req.originalUrl)) {
    console.warn(`WARNING: Tests attempted to load missing asset: "${req.originalUrl}"`);
    alreadyLogged.add(req.originalUrl);
  }
  resp.sendStatus(404);
});

// Run the server...
app.set("port", process.env.CERTA_PORT || 3000);
app.listen(app.get("port"), () => {
  console.log(`Certa web frontend now listening on port ${app.get("port")}`);
  process.send!("Ready");
});
