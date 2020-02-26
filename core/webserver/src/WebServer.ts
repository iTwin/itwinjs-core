/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as express from "express";
import * as cors from "cors";
import * as yargs from "yargs";
import * as path from "path";
import * as kill from "tree-kill";

// tslint:disable:no-console

// The arguments to this node executable are processed by yargs:
interface Args {
  /** The port on which the web server is started (default 3000) */
  port: number;
  /** The full path of the directory that is served as the root url of this web server */
  resources: string;
}

// Get the arguments using the ubiquitous yargs package.
function getArgs(): yargs.Arguments<Args> {
  const args = yargs
    .usage("$0 <port> <resources>")
    .wrap(yargs.terminalWidth())
    .option("port", {
      alias: "p",
      description: "Web Server Port",
      default: 3000,
      type: "number",
    })
    .option("resources", {
      alias: "r",
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

class WebServer {
  private _app: express.Application;
  private _resourceRoot: string;
  private _port: number;

  public constructor(resourceRoot: string, port: number) {
    // set up the express server.
    this._app = express();
    this._resourceRoot = resourceRoot;
    this._port = port;
  }

  // Start the Express web server
  public start() {

    /* --Enable CORS for all apis */
    this._app.use(cors());

    this._app.use(express.static(this._resourceRoot));
    this._app.use("*", (_req, resp) => {
      resp.sendFile(path.resolve(this._resourceRoot, "index.html"));
    });

    // Run the server...
    this._app.set("port", this._port);

    const announce = () => console.log(`***** WebServer listening on http:localHost:${this._app.get("port")}, resource root is ${this._resourceRoot}`);
    this._app.listen(this._app.get("port"), announce);
  }
}

// --------------------------------------------
// Main entry point
// --------------------------------------------
function main() {
  const args = getArgs();
  handleInterrupt();

  // Mostly we serve out static files, so We have only the simple public path route.
  // If args.resources is relative, we expect it to be relative to process.cwd
  const resourceRoot = path.resolve(process.cwd(), args.resources);

  const webServer: WebServer = new WebServer(resourceRoot, args.port);
  webServer.start();
}

main();
