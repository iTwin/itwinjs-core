/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as express from "express";
import * as cors from "cors";
import * as yargs from "yargs";
import * as path from "path";
import * as kill from "tree-kill";
import * as fs from "fs";
import * as tar from "tar";
import * as bodyParser from "body-parser";
import * as crypto from "crypto";

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

const enum SignatureVerifyStatus {
  Pass = 0,     // has signature, verified correct
  Fail = 1,     // has signature, but has been tampered with.
  NotFound = 2, // not signed.
}

class WebServer {
  private _app: express.Application;
  private _resourceRoot: string;
  private _port: number;
  private _pluginDirs: string[] = [];

  public constructor(resourceRoot: string, port: number) {
    // set up the express server.
    this._app = express();
    this._resourceRoot = resourceRoot;
    this._port = port;
  }

  private _makeDirectoryNoError(outDirectory: string) {
    // Note: mkdirSync with option of { recursive: true } did not work on Linux, necessitating this workaround/
    const directoriesToCreate: string[] = [];

    // work backwards through the outDirectory to find the first one that exists.
    let thisDirectory = outDirectory;
    try {
      while (!fs.existsSync(thisDirectory)) {
        directoriesToCreate.push(thisDirectory);
        const parsedPath = path.parse(thisDirectory);
        thisDirectory = parsedPath.dir;
      }

      let createDir;
      while (createDir = directoriesToCreate.pop()) {
        fs.mkdirSync(createDir);
      }

    } catch (_error) {
      // do nothing on error.
    }
  }

  private _isDirectory(directoryName: string): boolean {
    return (fs.statSync(directoryName)).isDirectory();
  }

  private _findAllFiles(fileList: string[], rootDir: string, thisDir: string, skipFile?: string) {
    const entryList: string[] = fs.readdirSync(thisDir);
    for (const thisEntry of entryList) {
      const thisPath: string = path.resolve(thisDir, thisEntry);
      if (this._isDirectory(thisPath)) {
        this._findAllFiles(fileList, rootDir + thisEntry + "/", thisPath, skipFile);
      } else {
        if (skipFile && (thisEntry === skipFile))
          continue;
        fileList.push(rootDir + thisEntry);
      }
    }
  }

  // remove all files (recursively) from given directory
  private _removeAllFiles(directory: string) {
    // recurse to remove all files only.
    try {
      const entryList: string[] = fs.readdirSync(directory);
      for (const thisEntry of entryList) {
        const thisPath: string = path.resolve(directory, thisEntry);
        if (this._isDirectory(thisPath)) {
          this._removeAllFiles(thisPath);
        } else {
          fs.unlinkSync(thisPath);
        }
      }
    } catch (error) {
      // don't care.
    }
  }

  private _removeDirectory(directory: string, depth: number) {
    // recurse to remove all directories.
    try {
      const entryList: string[] = fs.readdirSync(directory);
      for (const thisEntry of entryList) {
        const thisPath: string = path.resolve(directory, thisEntry);
        if (this._isDirectory(thisPath)) {
          this._removeDirectory(thisPath, depth + 1);
          fs.rmdirSync(thisPath);
        }
      }
      if (depth === 0)
        fs.rmdirSync(directory);
    } catch (error) {
      // don't care.
    }
  }

  private _verifyPluginSignature(pluginDirectory: string): SignatureVerifyStatus {
    // if there is no "digitalSignature" and no "publicKey.pem" file, then it wasn't signed.
    const digSigFile: string = path.resolve(pluginDirectory, "digitalSignature");
    const hasDigSigFile = fs.existsSync(digSigFile);
    const publicKeyFile: string = path.resolve(pluginDirectory, "publicKey.pem");
    const hasPublicKeyFile = fs.existsSync(publicKeyFile);

    // should have both or neither.
    if (hasDigSigFile !== hasPublicKeyFile) {
      return SignatureVerifyStatus.Fail;
    }

    // if neither, there is no signature.
    if (!hasDigSigFile)
      return SignatureVerifyStatus.NotFound;

    // go through all the extracted files, with the exception of "digitalSignature", and verify them.
    try {
      const digitalSignature: Buffer = fs.readFileSync(digSigFile);
      const publicKey: Buffer = fs.readFileSync(publicKeyFile);
      // make sure we can read the digital signature file and the public key.
      const verifyList: string[] = [];
      this._findAllFiles(verifyList, "", pluginDirectory, "digitalSignature");
      verifyList.sort();
      const verify = crypto.createVerify("RSA-SHA256");
      for (const fileName of verifyList) {
        const filePath: string = path.resolve(pluginDirectory, fileName);
        const contents: Buffer = fs.readFileSync(filePath);
        verify.update(contents);
      }
      verify.end();
      if (verify.verify(publicKey, digitalSignature)) {
        return SignatureVerifyStatus.Pass;
      } else {
        return SignatureVerifyStatus.Fail;
      }
    } catch (error) {
      return SignatureVerifyStatus.Fail;
    }
  }

  private _addToPluginDirectories(pluginDirectory: string) {
    if (this._pluginDirs.find((element) => element === pluginDirectory))
      return;
    this._pluginDirs.push(pluginDirectory);
  }

  private _untarPlugin(req: express.Request, resp: express.Response) {
    // get the name of the plugin.
    if (req.body.name) {
      // see if we can find the tar file in the "plugins" directory.
      let pluginFileName: string = path.resolve(this._resourceRoot, "plugins", req.body.name);
      if (!pluginFileName.endsWith(".plugin.tar")) {
        pluginFileName = pluginFileName.concat(".plugin.tar");
      }
      if (!fs.existsSync(pluginFileName)) {
        resp.send({ i18nKey: "iModelJs:PluginErrors.CantFind", pluginUrl: path.basename(pluginFileName) });
        return;
      }
      // here we have the plugin tarfile. Untar it to the directory [app.resources]/plugins/pluginName.
      const pluginDirectory: string = pluginFileName.slice(0, -11);

      // if it doesn't exist, we must create the directory.
      this._makeDirectoryNoError(pluginDirectory);

      tar.extract({ cwd: pluginDirectory, file: pluginFileName }).then(
        () => {
          if (SignatureVerifyStatus.Fail === this._verifyPluginSignature(pluginDirectory)) {
            this._removeAllFiles(pluginDirectory);
            this._removeDirectory(pluginDirectory, 0);
            resp.send({ i18nKey: "iModelJs:PluginErrors.SignatureNoMatch", pluginUrl: path.basename(pluginFileName) });
          } else {
            // add a route to the new directory.
            this._addToPluginDirectories(pluginDirectory);
            resp.send({});
          }
        },
      ).catch(() => resp.send({ i18nKey: "iModelJs:PluginErrors.CantUntar", pluginUrl: path.basename(pluginFileName) }));
    }
  }

  private _replyToTarSupport(_req: express.Request, resp: express.Response) {
    resp.send({ canUntar: "true" });
  }

  // this requests finds the available version of an iModel.js system module.
  private _findPackageVersion(req: express.Request, resp: express.Response) {
    if (req.body.name) {
      let moduleName: string = req.body.name + ".js";
      if (moduleName.startsWith("@")) {
        let slashPos: number;
        if (-1 !== (slashPos = moduleName.indexOf("/")))
          moduleName = moduleName.slice(slashPos + 1);
      }

      // see if we can find a package with the the name specified by looking in all the folders starting with "v" for it.
      const entryList: string[] = fs.readdirSync(this._resourceRoot);
      for (const thisEntry of entryList) {
        if (thisEntry.startsWith("v")) {
          const thisPath: string = path.resolve(this._resourceRoot, thisEntry);
          if ((fs.statSync(thisPath)).isDirectory()) {
            // It's a directory starting with "v" - see if contains the package we are looking for.
            const thisFile: string = path.resolve(thisPath, moduleName);
            if (fs.existsSync(thisFile)) {
              resp.send(thisEntry.slice(1));
              return;
            }
          }
        }
      }
    }
    // always succeeds, even if we didn't find the file.
    resp.status(200).end();
  }

  private _handlePluginResources(req: express.Request, resp: express.Response, next: express.NextFunction) {
    // here we have a request that wasn't satisfied by our static route. We want to see whether the requested file is available in the resources of our untarred plugins.
    for (const pluginDir of this._pluginDirs) {
      const fileRequested = path.join(pluginDir, req.baseUrl);
      if (fs.existsSync(fileRequested)) {
        resp.sendFile(fileRequested);
        return;
      }
    }
    next();
  }

  // Start the Express web server
  public start() {

    /* --Enable CORS for all apis */
    this._app.use(cors());

    // post json passed to plugin post.
    const jsonBodyParser = bodyParser.json();

    // when we get the plugin nurl, untar the plugin so we can deliver its contents in subsequent requests.
    this._app.post("/pluginTarSupport", jsonBodyParser, this._replyToTarSupport.bind(this));
    this._app.post("/plugin", jsonBodyParser, this._untarPlugin.bind(this));
    this._app.post("/versionAvailable", jsonBodyParser, this._findPackageVersion.bind(this));

    this._app.use(express.static(this._resourceRoot));
    this._app.use("/*", this._handlePluginResources.bind(this));
    this._app.get("/signin-*", (_req, resp) => {
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
