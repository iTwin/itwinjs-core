/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as Yargs from "yargs";
import { BaseSettings, EditableWorkspaceFile, IModelHost, ITwinWorkspace, WorkspaceFile, IModelJsFs } from "@itwin/core-backend";
import { parse } from "path";

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

const workspace = new ITwinWorkspace(new BaseSettings());


function listWorkspace(args: ListOptions) {
  if (!args.strings && !args.blobs && !args.files)
    args.blobs = args.files = args.strings = true;

  const file = new WorkspaceFile(args.workspaceFile, workspace);
  file.open();
  if (args.strings) {
    console.log("strings:");
    file.db.withSqliteStatement("SELECT id,value FROM strings", (stmt) => {
      console.log(`name=[${stmt.getValueString(0)}], size=${stmt.getValueString(1).length}`);
    });
  }
  if (args.blobs) {
    console.log("blob:");
    file.db.withSqliteStatement("SELECT id,value FROM blobs", (stmt) => {
      console.log(`name=[${stmt.getValueString(0)}], size=${stmt.getValueBlob(1).length}`);
    });
  }
  if (args.files) {
    console.log("files:");
    file.db.withSqliteStatement("SELECT name,size,type,lastModified,size FROM be_EmbedFile", (stmt) => {
      const date = new Date(stmt.getValueDouble(3));
      console.log(`name=[${stmt.getValueString(0)}], size=${stmt.getValueBlob(1).length}, ext="${stmt.getValueString(2)}", date=${date.toString()}`);
    });
  }
}

function createWorkspace(args: WorkspaceOpts) {
  const wsFile = new EditableWorkspaceFile(args.workspaceFile, workspace);
  wsFile.create();
  console.log(`created workspace file ${wsFile.db.nativeDb.getFilePath()}`);
  wsFile.close();
}

function addToWorkspace(args: AddOptions) {
  if (!args.directory && !args.file)
    return console.error("supply either directory or file to add");

  const wsFile = new EditableWorkspaceFile(args.workspaceFile, workspace);
  wsFile.open();
  try {

    if (args.file) {
      if (!IModelJsFs.existsSync(args.file))
        throw new Error(`file [${args.file}] does not exist`);
      const parsed = parse(args.file);
      wsFile.addFile(parsed.base, args.file);
    }
  } finally {
    wsFile.close();
  }
}

function dropFromWorkspace(argv: any) {
  console.log(argv);
}

function runCommand(cmd: (args: any) => void) {
  return (args: any) => {
    try {
      cmd(args)
    } catch (e: any) {
      console.error(e.message);
    }
  }
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
      handler: runCommand(listWorkspace),
    })
    .command({
      command: "create <workspaceFile>",
      describe: "create a new workspace container file",
      handler: runCommand(createWorkspace),
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
      handler: runCommand(addToWorkspace),
    })
    .command({
      command: "drop <workspaceFile>",
      describe: "drop resources from a workspace container",
      handler: runCommand(dropFromWorkspace),
    })
    .demandCommand()
    .help()
    .argv;
}

void main();
