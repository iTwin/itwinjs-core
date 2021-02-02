/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as yargs from "yargs";
import * as fs from "fs";
import * as path from "path";
import * as tar from "tar";
import * as rimraf from "rimraf";
import * as sha256 from "fast-sha256";
import * as semver from "semver";
import * as readline from "readline";
import { ExtensionClient, ExtensionProps } from "@bentley/extension-client";
import { IModelHost } from "@bentley/imodeljs-backend";
import { BentleyError, ExtensionStatus } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { IModelError } from "@bentley/imodeljs-common";
import { ContextRegistryClient } from "@bentley/context-registry-client";
import { prettyPrint, signIn } from "./helpers";

let command: "publish" | "get" | "delete" | "view" | undefined;
let filePath: string | undefined;
let json = false;
const argv = yargs.strict(true)
  .wrap(Math.min(150, yargs.terminalWidth()))
  .command("publish", "Publish an extension",
    (ya) => ya
      .option("extensionPath", {
        alias: "path",
        describe: "Path to a directory containing the files to be published",
        string: true,
        demandOption: true,
      })
      .option("public", {
        alias: "p",
        describe: "Set this flag to publish a public extension",
        boolean: true,
        requiresArg: false,
      }),
    (a) => {
      command = "publish";
      filePath = a.extensionPath;
    })
  .command("get", "Download an extension",
    (ya) => ya
      .option("savePath", {
        alias: "path",
        describe: "Path where the downloaded files should be saved",
        string: true,
        demandOption: true,
      })
      .demandOption("extensionName")
      .demandOption("extensionVersion"),
    (a) => {
      command = "get";
      filePath = a.savePath;
    })
  .command("delete", "Deletes an extension",
    (ya) => ya
      .demandOption("extensionName")
      .demandOption("extensionVersion")
      .option("force", {
        describe: "Force confirmation and silence interactive prompt",
        requiresArg: false,
      })
      .option("public", {
        alias: "p",
        describe: "Set this flag to delete a public extension",
        boolean: true,
        requiresArg: false,
      }),
    () => { command = "delete"; })
  .command("view", "Shows data about an extension, or list of extensions if only the context is provided.",
    (ya) => ya
      .option("json", {
        describe: "Use JSON instead of pretty printing the output",
        boolean: true,
        requiresArg: false,
      }),
    (a) => {
      command = "view";
      if (a.json)
        json = true;
    })
  .option("contextId", {
    alias: "cid",
    describe: "Context Id",
    string: true,
  })
  .option("extensionName", {
    alias: ["en", "n"],
    describe: "Extension name",
    string: true,
  })
  .option("extensionVersion", {
    alias: ["ev", "v"],
    describe: "Extension version",
    string: true,
    coerce: (ev: any) => {
      if (semver.valid(ev))
        return ev;
      throw new Error("Invalid version format. Only semantic version numbers are allowed, see https://semver.org");
    },
  })
  .demandCommand(1, 1, "Please choose a command.", "Only one command permitted per one run.")
  .argv;

(async () => {
  await IModelHost.startup();
  process.stdout.write("Signing in...\n");
  const token = await signIn();
  const requestContext = new AuthorizedClientRequestContext(token);
  const client = new ExtensionClient();

  let contextId = argv.contextId ?? "00000000-0000-0000-0000-000000000000";

  switch (command) {
    case "get":
      if (fs.existsSync(filePath!))
        rimraf.sync(filePath!);

      const files = await client.downloadExtension(requestContext, contextId, argv.extensionName!, argv.extensionVersion!);
      for (const file of files) {
        const fullPath = path.join(filePath!, file.fileName);
        mkdir(path.dirname(fullPath));
        fs.writeFileSync(fullPath, file.content);
      }
      break;
    case "publish":
      if (filePath === undefined || !fs.existsSync(filePath) || !fs.lstatSync(filePath).isDirectory())
        throw new IModelError(ExtensionStatus.UploadError, "Extension directory does not exist");

      const tarFileName = `${argv.extensionName}.${argv.extensionVersion}.tar`;
      const filesToTar = fs.readdirSync(filePath);
      try {
        process.stdout.write("Packaging extension...\n");
        await tar.create({ file: tarFileName, cwd: filePath }, filesToTar);
        const buffer = fs.readFileSync(tarFileName);
        const checksum = Buffer.from(sha256.hash(buffer)).toString("hex");

        let name: string, version: string;
        if (argv.extensionName === undefined || argv.extensionVersion === undefined) {
          const packageFileName = path.join(process.cwd(), "package.json");
          if (!fs.existsSync(packageFileName)) {
            throw new IModelError(ExtensionStatus.BadRequest, "Could not find package.json in current working directory. Please provide both extension name and version to publish.");
          }
          const packageBuffer = fs.readFileSync(packageFileName);
          const packageJson = JSON.parse(packageBuffer.toString());
          name = argv.extensionName ?? (() => {
            const foundName = (packageJson.name as string).split("/").pop()!;
            process.stdout.write(`Found extension name: ${foundName}\n`);
            return foundName;
          })();
          version = argv.extensionVersion ?? (() => {
            process.stdout.write(`Found extension version: ${packageJson.version}\n`);
            return packageJson.version;
          })();
        } else {
          name = argv.extensionName!;
          version = argv.extensionVersion!;
        }

        if (!argv.public && argv.contextId === undefined) {
          const contextRegistryClient: ContextRegistryClient = new ContextRegistryClient();
          contextId = (await contextRegistryClient.getTeam(requestContext)).wsgId;
        }

        process.stdout.write("Ready to upload.\n");
        await client.createExtension(requestContext, contextId, name, version, checksum, buffer);
        process.stdout.write("Uploading extension...\n");

        while (true) {
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              resolve();
            }, 1000);
          });

          const status: string = (await client.getExtensionProps(requestContext, contextId, argv.extensionName!, argv.extensionVersion!))?.status?.status ?? "";
          if (status === "Valid") {
            process.stdout.write("Upload successful\n");
            break;
          }

          if (status.startsWith("Failed"))
            throw new IModelError(ExtensionStatus.UploadError, status);
        }
      } finally {
        rimraf.sync(tarFileName);
      }
      break;
    case "delete":
      if (!argv.public && argv.contextId === undefined) {
        const contextRegistryClient: ContextRegistryClient = new ContextRegistryClient();
        contextId = (await contextRegistryClient.getTeam(requestContext)).wsgId;
      }

      const rl = readline.createInterface(process.stdin, process.stdout);
      const input = argv.force ? "Yes" : await new Promise<string>((resolve) => {
        rl.question(
          `Are you sure you want to delete extension "${argv.extensionName}" version "${argv.extensionVersion}"?\nType "Yes" to confirm: `,
          (ans) => {
            rl.close();
            resolve(ans);
          },
        );
      });

      if (input === "Yes") {
        await client.deleteExtension(requestContext, contextId, argv.extensionName!, argv.extensionVersion);
        process.stdout.write("Extension deleted.\n");
      } else {
        process.stdout.write("Extension not deleted.\n");
      }
      break;
    case "view":
      let extensions: ExtensionProps[];
      if (argv.extensionVersion === undefined) {
        extensions = await client.getExtensions(requestContext, contextId, argv.extensionName);
        if (extensions.length === 0)
          throw new IModelError(ExtensionStatus.ExtensionNotFound, "Could not find any extensions");
      } else {
        if (argv.extensionName === undefined) {
          throw new IModelError(ExtensionStatus.BadRequest, "Only extension version was provided. Please provide extension name too.");
        }
        const extension = await client.getExtensionProps(requestContext, contextId, argv.extensionName, argv.extensionVersion);
        if (extension === undefined)
          throw new IModelError(ExtensionStatus.ExtensionNotFound, "Could not find the requested extension");
        extensions = [extension];
      }
      if (json) {
        process.stdout.write(JSON.stringify(extensions));
      } else
        process.stdout.write(prettyPrint(extensions));
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }

  await IModelHost.shutdown();
  process.exit(0);
})().catch((err) => {
  if (err instanceof BentleyError)
    process.stderr.write(`Error: ${err.name}: ${err.message}`);
  else
    process.stderr.write(`Unknown error: ${err.message}`);
  process.exit(err.errorNumber ?? -1);
});

function mkdir(dirPath: string) {
  if (fs.existsSync(dirPath))
    return;
  const sepIndex = dirPath.lastIndexOf(path.sep);
  if (sepIndex > 0)
    mkdir(dirPath.substr(0, sepIndex));
  fs.mkdirSync(dirPath);
}
