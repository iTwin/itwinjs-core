/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as yargs from "yargs";
import * as fs from "fs";
import * as path from "path";
import * as tar from "tar";
import * as rimraf from "rimraf";
import { ExtensionClient } from "@bentley/extension-client";
import { IModelHost } from "@bentley/imodeljs-backend";
import { BentleyError, ExtensionStatus } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { IModelError } from "@bentley/imodeljs-common";
import { signIn } from "./signIn";

let command: "publish" | "get" | "delete" | undefined;
let filePath: string | undefined;
const argv = yargs.strict(true)
  .wrap(Math.min(150, yargs.terminalWidth()))
  .command("publish", "Publish an extension", {
    extensionPath: {
      alias: "path",
      describe: "Path to a directory containing the files to be published",
      string: true,
      demandOption: true,
    },
  }, (a) => {
    command = "publish";
    filePath = a.extensionPath;
  })
  .command("get", "Download an extension", {
    savePath: {
      alias: "path",
      describe: "Path where the downloaded files should be saved",
      string: true,
      demandOption: true,
    },
  }, (a) => {
    command = "get";
    filePath = a.savePath;
  })
  .command("delete", "Deletes an extension", {}, () => { command = "delete"; })
  .option("contextId", {
    alias: "cid",
    describe: "Context Id",
    string: true,
    demandOption: true,
  })
  .option("extensionName", {
    alias: ["en", "n"],
    describe: "Extension name",
    string: true,
    demandOption: true,
  })
  .option("extensionVersion", {
    alias: ["ev", "v"],
    describe: "Extension version",
    string: true,
    demandOption: true,
  })
  .demandCommand(1, 1, "Please choose a command.", "Only one command permitted per one run.")
  .argv;

(async () => {
  IModelHost.startup();
  const token = await signIn();
  const requestContext = new AuthorizedClientRequestContext(token);
  const client = new ExtensionClient();

  switch (command) {
    case "get":
      if (fs.existsSync(filePath!))
        rimraf.sync(filePath!);

      const files = await client.downloadExtension(requestContext, argv.contextId, argv.extensionName, argv.extensionVersion);
      for (const file of files) {
        const fullPath = path.join(filePath!, file.fileName);
        mkdir(path.dirname(fullPath));
        fs.writeFileSync(fullPath, file.content);
      }
      break;
    case "publish":
      if (filePath === undefined || !fs.existsSync(filePath) || !fs.lstatSync(filePath).isDirectory())
        throw new IModelError(ExtensionStatus.UploadError, "Extension directory does not exist");

      const tarFileName = argv.extensionName + "." + argv.extensionVersion + ".tar";
      const filesToTar = fs.readdirSync(filePath);
      try {
        await tar.create({ file: tarFileName, cwd: filePath }, filesToTar);
        await client.createExtension(requestContext, argv.contextId, argv.extensionName, argv.extensionVersion, fs.readFileSync(tarFileName).buffer);
      } finally {
        rimraf.sync(tarFileName);
      }
      break;
    case "delete":
      await client.deleteExtension(requestContext, argv.contextId, argv.extensionName, argv.extensionVersion);
      break;
  }

  IModelHost.shutdown();
})().catch((err) => {
  if (err instanceof BentleyError)
    process.stderr.write("Error: " + err.name + ": " + err.message);
  else
    process.stderr.write("Unknown error" + err.message);
});

function mkdir(dirPath: string) {
  if (fs.existsSync(dirPath))
    return;
  const sepIndex = dirPath.lastIndexOf(path.sep);
  if (sepIndex > 0)
    mkdir(dirPath.substr(0, sepIndex));
  fs.mkdirSync(dirPath);
}
