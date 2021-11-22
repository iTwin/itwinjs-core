/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as glob from "glob";
import { join } from "path";
import * as Yargs from "yargs";
import { EditableWorkspaceFile, IModelHost, IModelHostConfiguration, IModelJsFs, WorkspaceContainerId, WorkspaceFile, WorkspaceResourceName } from "@itwin/core-backend";
import { DbResult } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";

/* eslint-disable id-blacklist,no-console */

/** Allows overriding the location of workspace container files. If not present, defaults to `${homedir}/iTwin/Workspace` */
interface EditorOpts {
  /** Directory for workspace containers */
  containerDir?: LocalDirName;
}

/** Id of workspace file for operation */
interface WorkspaceId extends EditorOpts {
  workspaceId: WorkspaceContainerId;
}

/** resource type names */
type RscType = "blob" | "string" | "file";

/** Options for adding, updating, extracting, or dropping resources from a workspace container file */
interface ResourceOption extends WorkspaceId {
  name?: WorkspaceResourceName;
  update: boolean;
  type: RscType;
}

/** Options for dropping resources from a workspace container file */
interface DropResourceOpts extends ResourceOption {
  name: WorkspaceResourceName;
}

/** Options for extracting resources from a workspace container file */
interface ExtractResourceOpts extends ResourceOption {
  name: WorkspaceResourceName;
  fileName: LocalFileName;
}

/** Options for adding or updating local files as resources into a workspace container file */
interface AddFileOptions extends ResourceOption {
  file: LocalFileName;
  root?: LocalDirName;
}

/** Options for listing the resources in a workspace container file */
interface ListOptions extends WorkspaceId {
  strings?: boolean;
  files?: boolean;
  blobs?: boolean;
}

/** Create a new empty Workspace container file  */
function createWorkspace(args: WorkspaceId) {
  const wsFile = new EditableWorkspaceFile(args.workspaceId, IModelHost.appWorkspace);
  wsFile.create();
  console.log(`created workspace file ${wsFile.db.nativeDb.getFilePath()}`);
  wsFile.close();
}

/** open, call a function to process, then close a WorkspaceFile */
function processWorkspace<W extends WorkspaceFile, T>(args: T, ws: W, fn: (ws: W, args: T) => void) {
  ws.open();
  console.log(`Workspace container [${ws.db.nativeDb.getFilePath()}]`);
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

/** Add or Update files into a WorkspaceFile. */
function addFilesToWorkspace(args: AddFileOptions) {
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

/** Extract a single resource from a WorkspaceFile into a local file */
function extractFromWorkspace(args: ExtractResourceOpts) {
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

/** Drop a single resource from a WorkspaceFile */
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

/** Start `IModelHost`, then run a WorkspaceEditor command. Errors are logged to console. */
function runCommand<T extends EditorOpts>(cmd: (args: T) => void) {
  return async (args: T) => {
    try {
      const config = new IModelHostConfiguration();
      if (args.containerDir)
        config.workspace = { containerDir: args.containerDir };
      await IModelHost.startup(config);
      cmd(args);
    } catch (e: any) {
      console.error(e.message);
    }
  };
}

/** Parse and execute WorkspaceEditor commands */
async function main() {
  const type = { alias: "t", describe: "the type of resource", choices: ["blob", "string", "file"], default: "file" };
  const update = { alias: "u", describe: "update (i.e. replace) rather than add the files", boolean: true, default: false };
  Yargs.usage("Edits or lists contents of a workspace container")
    .wrap(Math.min(120, Yargs.terminalWidth()))
    .strict()
    .version("V1.0")
    .option("containerDir", { alias: "c", describe: "directory to use for workspace containers", string: true })
    .command({
      command: "list <workspaceId>",
      describe: "list the contents of a workspace container file",
      builder: {
        strings: { alias: "s", describe: "list string resources", boolean: true, default: false },
        blobs: { alias: "b", describe: "list blob resources", boolean: true, default: false },
        files: { alias: "f", describe: "list file resources", boolean: true, default: false },
      },
      handler: runCommand(listWorkspace),
    })
    .command({
      command: "create <workspaceId>",
      describe: "create a new workspace container file",
      handler: runCommand(createWorkspace),
    })
    .command({
      command: "add <workspaceId> <file>",
      describe: "add or update files into a workspace container",
      builder: {
        name: { alias: "n", describe: "resource name for file", string: true },
        root: { alias: "r", describe: "root directory. Path parts after this will be saved in resource name", string: true },
        update,
        type,
      },
      handler: runCommand(addFilesToWorkspace),
    })
    .command({
      command: "extract <workspaceId> <name> <fileName>",
      describe: "extract a resource from a workspace container into a local file",
      builder: { type },
      handler: runCommand(extractFromWorkspace),
    })
    .command({
      command: "drop <workspaceId> <name>",
      describe: "drop resources from a workspace container",
      builder: { type },
      handler: runCommand(dropFromWorkspace),
    })
    .demandCommand()
    .help()
    .argv;
}

void main();
