/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as glob from "glob";
import { join } from "path";
import * as Yargs from "yargs";
import {
  EditableWorkspaceFile, IModelHost, IModelHostConfiguration, IModelJsFs, WorkspaceContainerId, WorkspaceFile, WorkspaceResourceName,
} from "@itwin/core-backend";
import { DbResult } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";

// cspell:ignore nodir
/* eslint-disable id-blacklist,no-console */

/** Allows overriding the location of WorkspaceFiles. If not present, defaults to `${homedir}/iTwin/Workspace` */
interface EditorOpts {
  /** Directory for WorkspaceFiles */
  directory?: LocalDirName;
}

/** Id of WorkspaceFile for operation */
interface WorkspaceId extends EditorOpts {
  workspaceId: WorkspaceContainerId;
}

/** Resource type names */
type RscType = "blob" | "string" | "file";

/** Options for adding, updating, extracting, or deleting resources from a WorkspaceFile */
interface ResourceOption extends WorkspaceId {
  name?: WorkspaceResourceName;
  update: boolean;
  type: RscType;
}

/** Options for deleting resources from a WorkspaceFile */
interface DeleteResourceOpts extends ResourceOption {
  name: WorkspaceResourceName;
}

/** Options for extracting resources from a WorkspaceFile */
interface ExtractResourceOpts extends ResourceOption {
  name: WorkspaceResourceName;
  fileName: LocalFileName;
}

/** Options for adding or updating local files as resources into a WorkspaceFile */
interface AddFileOptions extends ResourceOption {
  files: LocalFileName;
  root?: LocalDirName;
}

/** Options for listing the resources in a WorkspaceFile */
interface ListOptions extends WorkspaceId {
  strings?: boolean;
  files?: boolean;
  blobs?: boolean;
}

/** Create a new empty WorkspaceFile  */
async function createWorkspaceFile(args: WorkspaceId) {
  const wsFile = new EditableWorkspaceFile(args.workspaceId, IModelHost.appWorkspace);
  await wsFile.create();
  console.log(`created WorkspaceFile ${wsFile.db.nativeDb.getFilePath()}`);
  wsFile.close();
}

/** open, call a function to process, then close a WorkspaceFile */
function processWorkspace<W extends WorkspaceFile, T>(args: T, ws: W, fn: (ws: W, args: T) => void) {
  ws.open();
  console.log(`WorkspaceFile [${ws.db.nativeDb.getFilePath()}]`);
  try {
    fn(ws, args);
  } finally {
    ws.close();
  }
}

/** Open for write, call a function to process, then close a WorkspaceFile */
function editWorkspace<T extends WorkspaceId>(args: T, fn: (ws: EditableWorkspaceFile, args: T) => void) {
  processWorkspace(args, new EditableWorkspaceFile(args.workspaceId, IModelHost.appWorkspace), fn);
}

/** Open for read, call a function to process, then close a WorkspaceFile */
function readWorkspace<T extends WorkspaceId>(args: T, fn: (ws: WorkspaceFile, args: T) => void) {
  processWorkspace(args, new WorkspaceFile(args.workspaceId, IModelHost.appWorkspace), fn);
}

/** List the contents of a WorkspaceFile */
async function listWorkspaceFile(args: ListOptions) {
  readWorkspace(args, (file, args) => {
    if (!args.strings && !args.blobs && !args.files)
      args.blobs = args.files = args.strings = true;

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

/** Add or Update files into a WorkspaceFile. */
async function addToWorkspaceFile(args: AddFileOptions) {
  editWorkspace(args, (wsFile, args) => {
    glob.sync(args.files, { cwd: args.root ?? process.cwd(), nodir: true }).forEach((filePath) => {
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
        console.log(` ${args.update ? "updated" : "added"} "${file}" as ${args.type} resource [${name}]`);
      } catch (e: any) {
        console.error(e.message);
      }
    });
  });
}

/** Extract a single resource from a WorkspaceFile into a local file */
async function extractFromWorkspaceFile(args: ExtractResourceOpts) {
  readWorkspace(args, (file, args) => {
    const verify = <T>(val: T | undefined): T => {
      if (val === undefined)
        throw new Error(` ${args.type} resource "${args.name}" does not exist`);
      return val;
    };

    if (args.type === "string") {
      fs.writeFileSync(args.fileName, verify(file.getString(args.name)));
    } else if (args.type === "blob") {
      fs.writeFileSync(args.fileName, verify(file.getBlob(args.name)));
    } else {
      verify(file.getFile(args.name, args.fileName));
    }
    console.log(` ${args.type} resource [${args.name}] extracted to "${args.fileName}"`);
  });
}

/** Delete a single resource from a WorkspaceFile */
async function deleteFromWorkspaceFile(args: DeleteResourceOpts) {
  editWorkspace(args, (wsFile, args) => {
    if (args.type === "string")
      wsFile.removeString(args.name);
    else if (args.type === "blob")
      wsFile.removeBlob(args.name);
    else
      wsFile.removeFile(args.name);
    console.log(` deleted ${args.type} resource [${args.name}]`);
  });
}

async function vacuumWorkspaceFile(args: WorkspaceId) {
  const ws = new WorkspaceFile(args.workspaceId, IModelHost.appWorkspace);
  IModelHost.platform.DgnDb.vacuum(ws.localFile);
  console.log(`${ws.localFile} vacuumed`);
}

/** Start `IModelHost`, then run a WorkspaceEditor command. Errors are logged to console. */
function runCommand<T extends EditorOpts>(cmd: (args: T) => Promise<void>) {
  return async (args: T) => {
    try {
      const config = new IModelHostConfiguration();
      if (args.directory)
        config.workspace = { containerDir: args.directory };
      await IModelHost.startup(config);
      await cmd(args);
    } catch (e: any) {
      console.error(e.message);
    }
  };
}

/** Parse and execute WorkspaceEditor commands */
async function main() {
  const type = { alias: "t", describe: "the type of resource", choices: ["blob", "string", "file"], default: "file" };
  const update = { alias: "u", describe: "update (i.e. replace) rather than add the files", boolean: true, default: false };
  Yargs.usage("Edits or lists contents of a WorkspaceFile")
    .wrap(Math.min(130, Yargs.terminalWidth()))
    .strict()
    .version("V1.0")
    .option("directory", { alias: "d", describe: "directory to use for WorkspaceFiles", string: true })
    .command({
      command: "create <workspaceId>",
      describe: "create a new WorkspaceFile",
      handler: runCommand(createWorkspaceFile),
    })
    .command({
      command: "list <workspaceId>",
      describe: "list the contents of a WorkspaceFile",
      builder: {
        strings: { alias: "s", describe: "list string resources", boolean: true, default: false },
        blobs: { alias: "b", describe: "list blob resources", boolean: true, default: false },
        files: { alias: "f", describe: "list file resources", boolean: true, default: false },
      },
      handler: runCommand(listWorkspaceFile),
    })
    .command({
      command: "add <workspaceId> <files>",
      describe: "add or update files into a WorkspaceFile",
      builder: {
        name: { alias: "n", describe: "resource name for file", string: true },
        root: { alias: "r", describe: "root directory. Path parts after this will be saved in resource name", string: true },
        update,
        type,
      },
      handler: runCommand(addToWorkspaceFile),
    })
    .command({
      command: "extract <workspaceId> <name> <fileName>",
      describe: "extract a resource from a WorkspaceFile into a local file",
      builder: { type },
      handler: runCommand(extractFromWorkspaceFile),
    })
    .command({
      command: "delete <workspaceId> <name>",
      describe: "delete a resource from a WorkspaceFile",
      builder: { type },
      handler: runCommand(deleteFromWorkspaceFile),
    })
    .command({
      command: "vacuum <workspaceId>>",
      describe: "vacuum a WorkspaceFile",
      builder: { type },
      handler: runCommand(vacuumWorkspaceFile),
    })
    .demandCommand()
    .help()
    .argv;
}

void main();
