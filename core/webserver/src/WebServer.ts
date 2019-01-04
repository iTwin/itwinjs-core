/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// import * as fs from "fs";
// import * as path from "path";
import * as express from "express";
import * as yargs from "yargs";
import * as path from "path";
import * as kill from "tree-kill";

// tslint:disable:no-console

// The arguments to this node executable are processed by yargs:
// webServerPort - the port on which the web server is started (default 3000)
// publicPath - the full path of the directory that is served as the root url of this web server.

// Get the arguments using the ubiquitous yargs package.
function getArgs(): any {
  const args = yargs
    .usage("$0 <port> <resources>")
    .wrap(yargs.argv.terminalWidth as number)
    .option("port", {
      alias: ["p", "port"],
      description: "Web Server Port",
      default: 3000,
      type: "number",
    })
    .option("resources", {
      alias: ["r", "resources"],
      description: "Path to resource root directory",
      demandOption: true,
      type: "string",
    }).argv;

  return args;
}

// this function attempts to stop the process on a Ctrl-C
function handleInterrupt() {
  if (process.platform === "win32") {
    require("readline")
      .createInterface({
        input: process.stdin,
        output: process.stdout,
      })
      .addListener("close", () => {
        process.emit("SIGINT", "SIGINT");
      });
  }

  process.on("SIGINT", () => {
    kill(process.pid);
  });
}

// Start the Express web server
function startWebServer(args: any) {
  // set up the express server.
  const app = express();

  // Enable CORS for all apis
  app.all("/*", (_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST, GET");
    res.header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Correlation-Id");
    next();
  });

  // All we do is serve out static files, so We have only the simple public path route.
  // If args.resources is relative, we expect it to be relative to process.cwd
  const resourceRoot = path.resolve(process.cwd(), args.resources);

  app.use(express.static(resourceRoot));
  app.use("*", (_req, resp) => {
    resp.sendFile(path.resolve(args.resources, "index.html"));
  });

  // Run the server...
  app.set("port", args.port);

  const announce = () => console.log(`***** WebServer listening on http:localHost:${app.get("port")}, resource root is ${resourceRoot}`);
  app.listen(app.get("port"), announce);
}

// --------------------------------------------
// Main entry point
// --------------------------------------------
function main() {
  const args: any = getArgs();
  handleInterrupt();
  startWebServer(args);
}

main();
