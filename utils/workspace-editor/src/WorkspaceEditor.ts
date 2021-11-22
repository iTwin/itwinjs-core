/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as glob from "glob";
import { join } from "path";
import * as Yargs from "yargs";
import { EditableWorkspaceFile, IModelHost, IModelJsFs, WorkspaceFile, WorkspaceResourceName } from "@itwin/core-backend";
import { DbResult } from "@itwin/core-bentley";
import { LocalFileName } from "@itwin/core-common";
import { string } from "yargs";

/* eslint-disable id-blacklist,no-console */

interface WorkspaceOpts {
  workspaceFile: string;
}

type RscType = "blob" | "string" | "file";

interface ResourceOption extends WorkspaceOpts {
  name?: WorkspaceResourceName;
  update: boolean;
  type: RscType;
}

interface DropResourceOpts extends ResourceOption {
  name: WorkspaceResourceName;
}

interface ExtractResourceOpts extends ResourceOption {
  name: WorkspaceResourceName;
  fileName: LocalFileName;
}

interface AddFileOptions extends ResourceOption {
  file: LocalFileName;
  root?: string;
}

interface ListOptions extends WorkspaceOpts {
  strings?: boolean;
  files?: boolean;
  blobs?: boolean;
}

function createWorkspace(args: WorkspaceOpts) {
  const wsFile = new EditableWorkspaceFile(args.workspaceFile, IModelHost.appWorkspace);
  wsFile.create();
  console.log(`created workspace file ${wsFile.db.nativeDb.getFilePath()}`);
  wsFile.close();
}

function processWorkspace<W extends WorkspaceFile, T extends WorkspaceOpts>(args: T, ws: W, fn: (ws: W, args: T) => void) {
  ws.open();
  console.log(`Workspace container [${ws.db.nativeDb.getFilePath()}]`);
  try {
    fn(ws, args);
  } finally {
    ws.close();
  }
}

function editWorkspace<T extends WorkspaceOpts>(args: T, fn: (ws: EditableWorkspaceFile, args: T) => void) {
  processWorkspace(args, new EditableWorkspaceFile(args.workspaceFile, IModelHost.appWorkspace), fn);
}

function readWorkspace<T extends WorkspaceOpts>(args: T, fn: (ws: WorkspaceFile, args: T) => void) {
  processWorkspace(args, new WorkspaceFile(args.workspaceFile, IModelHost.appWorkspace), fn);
}

function listWorkspace(args: ListOptions) {
  readWorkspace(args, (file, args) => {
    if (!args.strings && !args.blobs && !args.files)
      args.blobs = args.files = args.strings = true;

    console.log(`Resources in [${file.db.nativeDb.getFilePath()}]:`);
    if (args.strings) {
      console.log(" strings:");
      file.db.withSqliteStatement("SELECT id,value FROM strings", (stmt) => {
        while (DbResult.BE_SQLITE_ROW === stmt.step())
          console.log(`  name=[${stmt.getValueString(0)}], size=${stmt.getValueString(1).length}`);
      });
    }
    if (args.blobs) {
      console.log(" blobs:");
      file.db.withSqliteStatement("SELECT id,value FROM blobs", (stmt) => {
        while (DbResult.BE_SQLITE_ROW === stmt.step())
          console.log(`  name=[${stmt.getValueString(0)}], size=${stmt.getValueBlob(1).length}`);
      });
    }
    if (args.files) {
      console.log(" files:");
      file.db.withSqliteStatement("SELECT name FROM be_EmbedFile", (stmt) => {
        while (DbResult.BE_SQLITE_ROW === stmt.step()) {
          const embed = file.queryFileResource(stmt.getValueString(0));
          if (embed) {
            const info = embed.info;
            const date = new Date(info.date);
            console.log(`  name=[${stmt.getValueString(0)}], size=${info.size}, ext="${info.fileExt}", date=${date.toString()}`);
          }
        }
      });
    }
  });
}

function addFileToWorkspace(args: AddFileOptions) {
  editWorkspace(args, (wsFile, args) => {
    glob.sync(args.file, { cwd: args.root ?? process.cwd(), nodir: true }).forEach((filePath) => {
      const file = args.root ? join(args.root, filePath) : filePath;
      if (!IModelJsFs.existsSync(file))
        throw new Error(`file [${file}] does not exist`);
      const name = args.name ?? filePath;
      try {
        if (args.type === "string") {
          const val = fs.readFileSync(file, "utf-8");
          wsFile[args.update ? "updateString" : "addString"](name, val);
        } else if (args.type === "blob") {
          const val = fs.readFileSync(file);
          wsFile[args.update ? "updateBlob" : "addBlob"](name, val);
        } else {
          wsFile[args.update ? "updateFile" : "addFile"](name, file);
        }
        console.log(` ${args.update ? "updated" : "added"} [${file}] as ${args.type} resource "${name}"`);
      } catch (e: any) {
        console.error(e.message);
      }
    });
  });
}

function extractFromWorkspace(args: ExtractResourceOpts) {
  readWorkspace(args, (file, args) => {
    const testVal = <T>(val: T | undefined): T => {
      if (val === undefined)
        throw new Error(` ${args.type} resource "${args.name}" does not exist`);
      return val;
    };

    if (args.type === "string") {
      fs.writeFileSync(args.fileName, testVal(file.getString(args.name)), { flag: "w" });
    } else if (args.type === "blob") {
      fs.writeFileSync(args.fileName, testVal(file.getBlob(args.name)), { flag: "w" });
    } else {
      testVal(file.getFile(args.name, args.fileName));
    }
    console.log(` ${args.type} resource [${args.name}] extracted to "${args.fileName}"`);
  });
}

function dropFromWorkspace(args: DropResourceOpts) {
  editWorkspace(args, (wsFile, args) => {
    if (args.type === "string")
      wsFile.removeString(args.name);
    else if (args.type === "blob")
      wsFile.removeBlob(args.name);
    else
      wsFile.removeFile(args.name);
    console.log(` dropping ${args.type} resource "${args.name}"`);
  });
}

function runCommand(cmd: (args: any) => void) {
  return (args: any) => {
    try {
      cmd(args);
    } catch (e: any) {
      console.error(e.message);
    }
  };
}

async function main() {
  await IModelHost.startup();

  const type = { alias: "t", describe: "the type of resource", choices: ["blob", "string", "file"], default: "file" };
  const update = { alias: "u", describe: "update (i.e. replace) rather than add the files", boolean: true, default: false };
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
      command: "add <workspaceFile> <file>",
      describe: "add or update files into a workspace container",
      builder: {
        name: { alias: "n", describe: "resource name for file", string: true },
        root: { alias: "r", describe: "root directory. Path parts after this will be saved in resource name", string: true },
        update,
        type,
      },
      handler: runCommand(addFileToWorkspace),
    })
    .command({
      command: "extract <workspaceFile> <name> <fileName>",
      describe: "extract a resource from a workspace container into a local file",
      builder: { type },
      handler: runCommand(extractFromWorkspace),
    })
    .command({
      command: "drop <workspaceFile> <name>",
      describe: "drop resources from a workspace container",
      builder: { type },
      handler: runCommand(dropFromWorkspace),
    })
    .demandCommand()
    .help()
    .argv;
}

void main();
