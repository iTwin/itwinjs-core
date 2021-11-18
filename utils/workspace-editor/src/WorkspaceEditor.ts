/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as Yargs from "yargs";
import { BaseSettings, IModelHost, ITwinWorkspace, WorkspaceFile } from "@itwin/core-backend";

/* eslint-disable id-blacklist,no-console */

interface WorkspaceOpts {
  workspaceFile: string;
}

interface AddOptions extends WorkspaceOpts {
  directory?: string;
  subdirectories?: boolean;
  file?: string;
  resourceName?: string;
  type: "blob" | "string" | "file";
}
interface ListOptions extends WorkspaceOpts {
  strings?: boolean;
  files?: boolean;
  blobs?: boolean;
}

function listWorkspace(args: ListOptions) {
  if (!args.strings && !args.blobs && !args.files)
    args.blobs = args.files = args.strings = true;

  try {
    const file = new WorkspaceFile(args.workspaceFile, new ITwinWorkspace(new BaseSettings()));
    file.open();
  } catch (e: any) {
    console.error(e.message);
    return;
  }
}

function createWorkspace(argv: any) {
  console.log(argv);
}

function addToWorkspace(args: AddOptions) {
  if (!args.directory && !args.file)
    return console.error("please supply either directory or file to add");

  console.log(args);
}

function dropFromWorkspace(argv: any) {
  console.log(argv);
}

async function main() {
  await IModelHost.startup();

  Yargs.usage("Edits or lists contents of a workspace container")
    .wrap(Math.min(120, Yargs.terminalWidth()))
    .strict()
    .version("V1.0")
    .command({
      command: "list <workspaceFile>",
      describe: "list the contents of a workspace container file",
      builder: {
        strings: { alias: "s", describe: "list string resources", boolean: true, default: false },
        blobs: { alias: "b", describe: "list blob resources", boolean: true, default: false },
        files: { alias: "f", describe: "list file resources", boolean: true, default: false },
      },
      handler: listWorkspace,
    })
    .command({
      command: "create <workspaceFile>",
      describe: "create a new workspace container file",
      handler: createWorkspace,
    })
    .command({
      command: "add <workspaceFile>",
      describe: "add files to a workspace container",
      builder: {
        resourceName: { alias: "r", describe: "resource name for file", string: true },
        type: { alias: "t", describe: "the type of resource to add", choices: ["blob", "string", "file"], default: "file" },
        directory: { alias: "d", describe: "directory to add", string: true },
        subdirectories: { alias: "s", boolean: true, describe: "include subdirectories", default: false },
        file: { alias: "f", string: true },
      },
      handler: addToWorkspace,
    })
    .command({
      command: "drop <workspaceFile>",
      describe: "drop resources from a workspace container",
      handler: dropFromWorkspace,
    })
    .demandCommand()
    .help()
    .argv;
}

void main();
