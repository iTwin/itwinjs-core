/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as glob from "glob";
import * as readline from "readline";
import * as os from "os";
import { join } from "path";
import * as Yargs from "yargs";
import {
  CloudSqlite, EditableWorkspaceDb, IModelHost, IModelHostConfiguration, IModelJsFs, ITwinWorkspaceDb, WorkspaceContainerId, WorkspaceDbName,
  WorkspaceResourceName,
} from "@itwin/core-backend";
import { DbResult, StopWatch } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";

// cspell:ignore nodir
/* eslint-disable id-blacklist,no-console */

/** Allows overriding the location of WorkspaceDbs. If not present, defaults to `${homedir}/iTwin/Workspace` */
interface EditorOpts {
  /** Directory for WorkspaceDbs */
  directory?: LocalDirName;
}

/** Id of WorkspaceDb for operation */
interface WorkspaceDbOpt extends EditorOpts {
  containerId: WorkspaceContainerId;
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

/** Properties for accessing a blob storage account. */
interface BlobAccountProps {
  /** Token that provides required access (read/write/create/etc.) for blob store operation. */
  sasToken: string;
  /** Name for blob store user account */
  accountName: string;
  /** The string that identifies the storage type. Default = "azure?sas=1" */
  storageType: string;
}

/** Options for uploading a WorkspaceDb to blob storage */
interface UploadOptions extends BlobAccountProps, WorkspaceDbOpt {
  initialize: boolean;
  replace: boolean;
}

/** Options for downloading a WorkspaceDb from blob storage */
interface DownloadOptions extends BlobAccountProps, WorkspaceDbOpt {
  /** If present, name of local file for download.  */
  localFile?: string;
}

/** Create a new empty WorkspaceDb  */
async function createWorkspaceDb(args: WorkspaceDbOpt) {
  const wsFile = new EditableWorkspaceDb(args.dbName, IModelHost.appWorkspace.getContainer(args));
  wsFile.create();
  console.log(`created WorkspaceDb ${wsFile.sqliteDb.nativeDb.getFilePath()}`);
  wsFile.close();
}

/** open, call a function to process, then close a WorkspaceDb */
function processWorkspace<W extends ITwinWorkspaceDb, T>(args: T, ws: W, fn: (ws: W, args: T) => void) {
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

async function vacuumWorkspaceDb(args: WorkspaceDbOpt) {
  const ws = new ITwinWorkspaceDb(args.dbName, IModelHost.appWorkspace.getContainer(args));
  IModelHost.platform.DgnDb.vacuum(ws.localFile);
  console.log(`${ws.localFile} vacuumed`);
}

async function performTransfer(direction: CloudSqlite.TransferDirection, args: CloudSqlite.ContainerAccessProps & CloudSqlite.DbProps) {
  const onProgress = (loaded: number, total: number) => {
    if (total > 0) {
      const message = `${direction} ${args.localFile} ... ${(loaded * 100 / total).toFixed(2)}%`;
      process.stdout.write(message);
      readline.moveCursor(process.stdout, -1 * message.length, 0);
      if (loaded >= total)
        process.stdout.write(os.EOL);
    }
    return 0;
  };
  const timer = new StopWatch(direction, true);
  await CloudSqlite.transferDb(direction, { ...args, onProgress });
  console.log(`${direction} of ${args.localFile} complete, ${timer.elapsedSeconds.toString()} seconds`);
}

async function uploadWorkspaceDb(args: UploadOptions) {
  const ws = new ITwinWorkspaceDb(args.dbName, IModelHost.appWorkspace.getContainer(args));
  if (args.initialize)
    await CloudSqlite.initializeContainer(args);

  return performTransfer("upload", { ...args, localFile: ws.localFile });
}

async function downloadWorkspaceDb(args: DownloadOptions) {
  const ws = new ITwinWorkspaceDb(args.dbName, IModelHost.appWorkspace.getContainer(args));
  const localFile = args.localFile ?? ws.localFile;
  return performTransfer("download", { ...args, localFile });
}

async function deleteWorkspaceDb(args: BlobAccountProps & WorkspaceDbOpt) {
  return CloudSqlite.deleteDb(args);
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
  const accountOpts = {
    sasToken: { alias: "s", describe: "shared access signature token", string: true, required: true },
    accountName: { alias: "a", describe: "user account name", string: true, required: true },
    storageType: { describe: "storage module type", string: true, default: "azure?sas=1" },
  };

  Yargs.usage("Edits or lists contents of a WorkspaceDb")
    .wrap(Math.min(130, Yargs.terminalWidth()))
    .strict()
    .config()
    .default("config", "workspaceEditor.json")
    .help()
    .version("V1.0")
    .options({
      directory: { alias: "d", describe: "directory to use for WorkspaceContainers", string: true },
      containerId: { alias: "c", describe: "WorkspaceContainerId for WorkspaceDb", string: true, required: true },
    })
    .command({
      command: "create <dbName>",
      describe: "create a new WorkspaceDb",
      handler: runCommand(createWorkspaceDb),
    })
    .command({
      command: "list <dbName>",
      describe: "list the contents of a WorkspaceDb",
      builder: {
        strings: { alias: "s", describe: "list string resources", boolean: true, default: false },
        blobs: { alias: "b", describe: "list blob resources", boolean: true, default: false },
        files: { alias: "f", describe: "list file resources", boolean: true, default: false },
      },
      handler: runCommand(listWorkspaceDb),
    })
    .command({
      command: "add <dbName> <files>",
      describe: "add or update files into a WorkspaceDb",
      builder: {
        name: { alias: "n", describe: "resource name for file", string: true },
        root: { alias: "r", describe: "root directory. Path parts after this will be saved in resource name", string: true },
        update,
        type,
      },
      handler: runCommand(addResource),
    })
    .command({
      command: "extract <dbName> <rscName> <fileName>",
      describe: "extract a resource from a WorkspaceDb into a local file",
      builder: { type },
      handler: runCommand(extractResource),
    })
    .command({
      command: "deleteResource <dbName> <rscName>",
      describe: "delete a resource from a WorkspaceDb",
      builder: { type },
      handler: runCommand(deleteResource),
    })
    .command({
      command: "upload <dbName>",
      describe: "upload a WorkspaceDb to cloud storage",
      builder: {
        initialize: { alias: "i", describe: "initialize container", boolean: true, default: false },
        ...accountOpts,
      },
      handler: runCommand(uploadWorkspaceDb),
    })
    .command({
      command: "download <dbName>",
      describe: "download a WorkspaceDb from cloud storage to local file",
      builder: {
        localFile: { alias: "l", describe: "name of local file", string: true, required: false },
        ...accountOpts,
      },
      handler: runCommand(downloadWorkspaceDb),
    })
    .command({
      command: "deleteDb <dbName>",
      describe: "delete a WorkspaceDb from cloud storage",
      builder: {
        ...accountOpts,
      },
      handler: runCommand(deleteWorkspaceDb),
    })
    .command({
      command: "vacuum <dbName>",
      describe: "vacuum a WorkspaceDb",
      handler: runCommand(vacuumWorkspaceDb),
    })
    .demandCommand()
    .argv;
}

void main();
