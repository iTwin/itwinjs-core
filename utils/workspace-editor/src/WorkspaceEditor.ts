/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as glob from "glob";
import { join } from "path";
import * as readline from "readline";
import * as Yargs from "yargs";
import {
  CloudSqlite, EditableWorkspaceDb, IModelHost, IModelHostConfiguration, IModelJsFs, ITwinWorkspaceDb, WorkspaceContainerId, WorkspaceDbName,
  WorkspaceResourceName,
} from "@itwin/core-backend";
import { DbResult, StopWatch } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";

// cspell:ignore nodir
/* eslint-disable id-blacklist,no-console */

/** Properties for accessing a blob storage account. */
interface BlobAccountProps {
  /** Token that provides required access (read/write/create/etc.) for blob store operation. */
  sasToken: string;
  /** Name for blob store user account */
  accountName: string;
  /** The string that identifies the storage type. Default = "azure?sas=1" */
  storageType: string;
}

/** Allows overriding the location of WorkspaceDbs. If not present, defaults to `${homedir}/iTwin/Workspace` */
interface EditorOpts extends BlobAccountProps {
  /** Directory for WorkspaceDbs */
  directory?: LocalDirName;
  containerId: WorkspaceContainerId;
}

/** Id of WorkspaceDb for operation */
interface WorkspaceDbOpt extends EditorOpts {
  dbName: WorkspaceDbName;
}

/** Resource type names */
type RscType = "blob" | "string" | "file";

/** Options for adding, updating, extracting, or deleting resources from a WorkspaceDb */
interface ResourceOption extends WorkspaceDbOpt {
  rscName?: WorkspaceResourceName;
  update: boolean;
  type: RscType;
}

/** Options for deleting resources from a WorkspaceDb */
interface DeleteResourceOpts extends ResourceOption {
  rscName: WorkspaceResourceName;
}

/** Options for extracting resources from a WorkspaceDb */
interface ExtractResourceOpts extends ResourceOption {
  rscName: WorkspaceResourceName;
  fileName: LocalFileName;
}

/** Options for adding or updating local files as resources into a WorkspaceDb */
interface AddFileOptions extends ResourceOption {
  files: LocalFileName;
  root?: LocalDirName;
}

/** Options for listing the resources in a WorkspaceDb */
interface ListOptions extends WorkspaceDbOpt {
  strings?: boolean;
  files?: boolean;
  blobs?: boolean;
}

interface TransferOptions extends BlobAccountProps, WorkspaceDbOpt {
  /** If present, name of local file for download.  */
  localFile?: string;
}

/** Options for uploading a WorkspaceDb to blob storage */
interface UploadOptions extends TransferOptions {
  initialize: boolean;
  replace: boolean;
}

/** Create a new empty WorkspaceDb  */
async function createWorkspaceDb(args: WorkspaceDbOpt) {
  const wsFile = new EditableWorkspaceDb(args.dbName, IModelHost.appWorkspace.getContainer(args));
  wsFile.create();
  console.log(`created WorkspaceDb ${wsFile.sqliteDb.nativeDb.getFilePath()}`);
  wsFile.close();
}

/** open, call a function to process, then close a WorkspaceDb */
function processWorkspace<W extends ITwinWorkspaceDb, T extends WorkspaceDbOpt>(args: T, ws: W, fn: (ws: W, args: T) => void) {
  ws.open();
  console.log(`WorkspaceDb [${ws.sqliteDb.nativeDb.getFilePath()}]`);
  try {
    fn(ws, args);
  } finally {
    ws.close();
  }
}

/** Open for write, call a function to process, then close a WorkspaceDb */
function editWorkspace<T extends WorkspaceDbOpt>(args: T, fn: (ws: EditableWorkspaceDb, args: T) => void) {
  processWorkspace(args, new EditableWorkspaceDb(args.dbName, IModelHost.appWorkspace.getContainer(args)), fn);
}

/** Open for read, call a function to process, then close a WorkspaceDb */
function readWorkspace<T extends WorkspaceDbOpt>(args: T, fn: (ws: ITwinWorkspaceDb, args: T) => void) {
  processWorkspace(args, new ITwinWorkspaceDb(args.dbName, IModelHost.appWorkspace.getContainer(args)), fn);
}

/** List the contents of a WorkspaceDb */
async function listWorkspaceDb(args: ListOptions) {
  readWorkspace(args, (file, args) => {
    if (!args.strings && !args.blobs && !args.files)
      args.blobs = args.files = args.strings = true;

    if (args.strings) {
      console.log(" strings:");
      file.sqliteDb.withSqliteStatement("SELECT id,value FROM strings", (stmt) => {
        while (DbResult.BE_SQLITE_ROW === stmt.step())
          console.log(`  name=[${stmt.getValueString(0)}], size=${stmt.getValueString(1).length}`);
      });
    }
    if (args.blobs) {
      console.log(" blobs:");
      file.sqliteDb.withSqliteStatement("SELECT id,value FROM blobs", (stmt) => {
        while (DbResult.BE_SQLITE_ROW === stmt.step())
          console.log(`  name=[${stmt.getValueString(0)}], size=${stmt.getValueBlob(1).length}`);
      });
    }
    if (args.files) {
      console.log(" files:");
      file.sqliteDb.withSqliteStatement("SELECT name FROM be_EmbedFile", (stmt) => {
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

/** Add or Update files into a WorkspaceDb. */
async function addResource(args: AddFileOptions) {
  editWorkspace(args, (wsFile, args) => {
    glob.sync(args.files, { cwd: args.root ?? process.cwd(), nodir: true }).forEach((filePath) => {
      const file = args.root ? join(args.root, filePath) : filePath;
      if (!IModelJsFs.existsSync(file))
        throw new Error(`file [${file}] does not exist`);
      const name = args.rscName ?? filePath;
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

/** Extract a single resource from a WorkspaceDb into a local file */
async function extractResource(args: ExtractResourceOpts) {
  readWorkspace(args, (file, args) => {
    const verify = <T>(val: T | undefined): T => {
      if (val === undefined)
        throw new Error(` ${args.type} resource "${args.rscName}" does not exist`);
      return val;
    };

    if (args.type === "string") {
      fs.writeFileSync(args.fileName, verify(file.getString(args.rscName)));
    } else if (args.type === "blob") {
      fs.writeFileSync(args.fileName, verify(file.getBlob(args.rscName)));
    } else {
      verify(file.getFile(args.rscName, args.fileName));
    }
    console.log(` ${args.type} resource [${args.rscName}] extracted to "${args.fileName}"`);
  });
}

/** Delete a single resource from a WorkspaceDb */
async function deleteResource(args: DeleteResourceOpts) {
  editWorkspace(args, (wsFile, args) => {
    if (args.type === "string")
      wsFile.removeString(args.rscName);
    else if (args.type === "blob")
      wsFile.removeBlob(args.rscName);
    else
      wsFile.removeFile(args.rscName);
    console.log(` deleted ${args.type} resource [${args.rscName}]`);
  });
}

function getDbFileName(args: WorkspaceDbOpt): LocalFileName {
  return new ITwinWorkspaceDb(args.dbName, IModelHost.appWorkspace.getContainer(args)).localFile;
}

/** Vacuum a local WorkspaceDb file, usually immediately prior to uploading. */
async function vacuumWorkspaceDb(args: WorkspaceDbOpt) {
  const localFile = getDbFileName(args);
  IModelHost.platform.DgnDb.vacuum(localFile);
  console.log(`${localFile} vacuumed`);
}

/** Either upload or download a WorkspaceDb to/from a WorkspaceContainer. Shows progress % during transfer */
async function performTransfer(direction: CloudSqlite.TransferDirection, args: TransferOptions) {
  const localFile = args.localFile ?? getDbFileName(args);
  const info = `${direction} ${localFile}, containerId=${args.containerId}, WorkspaceDbName=${args.dbName} : `;

  let last = 0;
  const onProgress = (loaded: number, total: number) => {
    if (loaded > last) {
      last = loaded;
      const message = ` ${(loaded * 100 / total).toFixed(2)}%`;
      readline.cursorTo(process.stdout, info.length);
      process.stdout.write(message);
    }
    return 0;
  };
  process.stdout.write(info);
  const timer = new StopWatch(direction, true);
  await CloudSqlite.transferDb(direction, { ...args, localFile, onProgress });
  readline.cursorTo(process.stdout, info.length);
  process.stdout.write(`complete, ${timer.elapsedSeconds.toString()} seconds`);
}

/** Upload a WorkspaceDb to a WorkspaceContainer. */
async function uploadWorkspaceDb(args: UploadOptions) {
  if (args.initialize)
    await CloudSqlite.initializeContainer(args);
  return performTransfer("upload", args);
}

/** Download a WorkspaceDb from a WorkspaceContainer. */
async function downloadWorkspaceDb(args: TransferOptions) {
  return performTransfer("download", args);
}

/** Delete a WorkspaceDb from a WorkspaceContainer. */
async function deleteWorkspaceDb(args: BlobAccountProps & WorkspaceDbOpt) {
  await CloudSqlite.deleteDb(args);
  console.log(`deleted WorkspaceDb [${args.dbName}] from containerId: ${args.containerId}`);
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
  const type = { alias: "t", describe: "the type of resource", choices: ["blob", "string", "file"], required: true };
  const update = { alias: "u", describe: "update (i.e. replace) rather than add the files", boolean: true, default: false };
  Yargs.usage("Edits or lists contents of a WorkspaceDb");
  Yargs.wrap(Math.min(130, Yargs.terminalWidth()));
  Yargs.strict();
  Yargs.config();
  Yargs.default("config", "workspaceEditor.json");
  Yargs.help();
  Yargs.version("V2.0");
  Yargs.options({
    directory: { alias: "d", describe: "directory to use for WorkspaceContainers", string: true },
    containerId: { alias: "c", describe: "WorkspaceContainerId for WorkspaceDb", string: true, required: true },
    sasToken: { alias: "s", describe: "shared access signature token", string: true, default: "" },
    accountName: { alias: "a", describe: "cloud storage account name for container", string: true, default: "" },
    storageType: { describe: "storage module type", string: true, default: "azure?sas=1" },
  });
  Yargs.command({
    command: "create <dbName>",
    describe: "create a new WorkspaceDb",
    handler: runCommand(createWorkspaceDb),
  });
  Yargs.command({
    command: "list <dbName>",
    describe: "list the contents of a WorkspaceDb",
    builder: {
      strings: { alias: "s", describe: "list string resources", boolean: true, default: false },
      blobs: { alias: "b", describe: "list blob resources", boolean: true, default: false },
      files: { alias: "f", describe: "list file resources", boolean: true, default: false },
    },
    handler: runCommand(listWorkspaceDb),
  });
  Yargs.command({
    command: "add <dbName> <files>",
    describe: "add or update files into a WorkspaceDb",
    builder: {
      name: { alias: "n", describe: "resource name for file", string: true },
      root: { alias: "r", describe: "root directory. Path parts after this will be saved in resource name", string: true },
      update,
      type,
    },
    handler: runCommand(addResource),
  });
  Yargs.command({
    command: "extract <dbName> <rscName> <fileName>",
    describe: "extract a resource from a WorkspaceDb into a local file",
    builder: { type },
    handler: runCommand(extractResource),
  });
  Yargs.command({
    command: "deleteResource <dbName> <rscName>",
    describe: "delete a resource from a WorkspaceDb",
    builder: { type },
    handler: runCommand(deleteResource),
  });
  Yargs.command({
    command: "upload <dbName>",
    describe: "upload a WorkspaceDb to cloud storage",
    builder: {
      initialize: { alias: "i", describe: "initialize container", boolean: true, default: false },
      localFile: { alias: "l", describe: "name of source local file", string: true, required: false },
    },
    handler: runCommand(uploadWorkspaceDb),
  });
  Yargs.command({
    command: "download <dbName>",
    describe: "download a WorkspaceDb from cloud storage to local file",
    builder: {
      localFile: { alias: "l", describe: "name of target local file", string: true, required: false },
    },
    handler: runCommand(downloadWorkspaceDb),
  });
  Yargs.command({
    command: "deleteDb <dbName>",
    describe: "delete a WorkspaceDb from cloud storage",
    handler: runCommand(deleteWorkspaceDb),
  });
  Yargs.command({
    command: "vacuum <dbName>",
    describe: "vacuum a WorkspaceDb",
    handler: runCommand(vacuumWorkspaceDb),
  });
  Yargs.demandCommand();
  Yargs.argv;
}

void main();
