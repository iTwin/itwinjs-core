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
  CloudSqlite, EditableWorkspaceDb, IModelHost, IModelHostConfiguration, IModelJsFs, IModelJsNative, ITwinWorkspaceDb, WorkspaceDbName,
  WorkspaceResourceName,
} from "@itwin/core-backend";
import { DbResult, Logger, LogLevel, StopWatch } from "@itwin/core-bentley";
import { IModelError, LocalDirName, LocalFileName } from "@itwin/core-common";

// cspell:ignore nodir
/* eslint-disable id-blacklist,no-console */

interface EditorOpts extends CloudSqlite.ContainerAccessProps {
  /** Allows overriding the location of WorkspaceDbs. If not present, defaults to `${homedir}/iTwin/Workspace` */
  directory?: LocalDirName;
}

/** options for performing an operation on a WorkspaceDb */
interface WorkspaceDbOpt extends EditorOpts {
  dbName: WorkspaceDbName;
}
/** options for copying a workspaceDb */
interface CopyWorkspaceDbOpt extends WorkspaceDbOpt {
  newDbName: WorkspaceDbName;
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
interface RemoveResourceOpts extends ResourceOption {
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

type TransferOptions = WorkspaceDbOpt & CloudSqlite.TransferDbProps;

/** Options for uploading a WorkspaceDb to blob storage */
interface UploadOptions extends TransferOptions {
  replace: boolean;
}

const askQuestion = async (query: string) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>((resolve) => rl.question(query, (ans) => { rl.close(); resolve(ans); }));
};

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

function getCloudProps(args: EditorOpts): CloudSqlite.ContainerAccessProps | undefined {
  return args.accountName ? {
    user: args.user,
    sasToken: args.sasToken,
    accountName: args.accountName,
    containerId: args.containerId,
    storageType: args.storageType,
    writeable: true,
  } : undefined;
}

async function loadContainer(args: EditorOpts) {
  const container = IModelHost.appWorkspace.getContainer({ ...args, cloudProps: getCloudProps(args) });
  if (container.cloudContainer) {
    await container.attach();
    await container.cloudContainer.pollManifest();
  }
  return container;
}

async function loadCloudContainer(args: EditorOpts): Promise<IModelJsNative.CloudContainer> {
  const container = await loadContainer(args);
  const cloudContainer = container.cloudContainer;
  if (!cloudContainer)
    throw new Error("no cloud container");
  return cloudContainer;
}

/** Open for write, call a function to process, then close a WorkspaceDb */
async function editWorkspace<T extends WorkspaceDbOpt>(args: T, fn: (ws: EditableWorkspaceDb, args: T) => void) {
  processWorkspace(args, new EditableWorkspaceDb(args.dbName, await loadContainer(args)), fn);
}

/** Open for read, call a function to process, then close a WorkspaceDb */
async function readWorkspace<T extends WorkspaceDbOpt>(args: T, fn: (ws: ITwinWorkspaceDb, args: T) => void) {
  processWorkspace(args, new ITwinWorkspaceDb(args.dbName, await loadContainer(args)), fn);
}

/** List the contents of a WorkspaceDb */
async function listWorkspaceDb(args: ListOptions) {
  await readWorkspace(args, (file, args) => {
    if (!args.strings && !args.blobs && !args.files)
      args.blobs = args.files = args.strings = true;

    if (args.strings) {
      console.log(" strings:");
      file.sqliteDb.withSqliteStatement("SELECT id,value FROM strings", (stmt) => {
        while (DbResult.BE_SQLITE_ROW === stmt.step())
          console.log(`  name=${stmt.getValueString(0)}, size=${stmt.getValueString(1).length}`);
      });
    }
    if (args.blobs) {
      console.log(" blobs:");
      file.sqliteDb.withSqliteStatement("SELECT id,value FROM blobs", (stmt) => {
        while (DbResult.BE_SQLITE_ROW === stmt.step())
          console.log(`  name=${stmt.getValueString(0)}, size=${stmt.getColumnBytes(1)}`);
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
            console.log(`  name=${stmt.getValueString(0)}, size=${info.size}, ext="${info.fileExt}", date=${date.toString()}`);
          }
        }
      });
    }
  });
}

/** Add or Update files into a WorkspaceDb. */
async function addResource(args: AddFileOptions) {
  await editWorkspace(args, (wsFile, args) => {
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
      } catch (e: unknown) {
        console.error(IModelError.getErrorMessage(e));
      }
    });
  });
}

/** Extract a single resource from a WorkspaceDb into a local file */
async function extractResource(args: ExtractResourceOpts) {
  await readWorkspace(args, (file, args) => {
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

/** Remove a single resource from a WorkspaceDb */
async function removeResource(args: RemoveResourceOpts) {
  await editWorkspace(args, (wsFile, args) => {
    if (args.type === "string")
      wsFile.removeString(args.rscName);
    else if (args.type === "blob")
      wsFile.removeBlob(args.rscName);
    else
      wsFile.removeFile(args.rscName);
    console.log(` removed ${args.type} resource [${args.rscName}]`);
  });
}

/** Vacuum a WorkspaceDb. */
async function vacuumWorkspaceDb(args: WorkspaceDbOpt) {
  const container = await loadContainer(args);
  const localFile = new ITwinWorkspaceDb(args.dbName, container).localFileName;
  IModelHost.platform.DgnDb.vacuum(localFile, container.cloudContainer);
  console.log(`${localFile} vacuumed`);
}

/** Either upload or download a WorkspaceDb to/from a WorkspaceContainer. Shows progress % during transfer */
async function performTransfer(container: IModelJsNative.CloudContainer, direction: CloudSqlite.TransferDirection, args: TransferOptions) {
  const localFileName = args.localFileName;
  const info = `${direction === "download" ? "export" : "import"} ${localFileName}, container=${args.containerId}, dbName=${args.dbName} : `;

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
  await CloudSqlite.transferDb(direction, container, { ...args, localFileName, onProgress });
  readline.cursorTo(process.stdout, info.length);
  process.stdout.write(`complete, ${timer.elapsedSeconds.toString()} seconds`);
}

/** import a WorkspaceDb to a WorkspaceContainer. */
async function importWorkspaceDb(args: UploadOptions) {
  const container = await loadCloudContainer(args);
  await CloudSqlite.withWriteLock(container, async () => {
    await performTransfer(container, "upload", args);
  });
}

/** export a WorkspaceDb from a WorkspaceContainer. */
async function exportWorkspaceDb(args: TransferOptions) {
  await performTransfer(await loadCloudContainer(args), "download", args);
}

/** Delete a WorkspaceDb from a WorkspaceContainer. */
async function deleteWorkspaceDb(args: WorkspaceDbOpt) {
  const container = await loadCloudContainer(args);
  await CloudSqlite.withWriteLock(container, async () => {
    container.deleteDatabase(args.dbName);
  });

  console.log(`deleted WorkspaceDb [${args.dbName}], container=${args.containerId}`);
}

/** initialize (empty if it exists) a WorkspaceContainer. */
async function initializeContainer(args: EditorOpts) {
  const container = IModelHost.appWorkspace.getContainer({ ...args, cloudProps: getCloudProps(args) });
  if (undefined === container.cloudContainer)
    throw new Error("No cloud container supplied");
  const yesNo = await askQuestion(`Are you sure you want to initialize container "${args.containerId}"? [y/n]: `);
  if (yesNo.toUpperCase()[0] === "Y") {
    container.cloudContainer?.initializeContainer();
    console.log(`container "${args.containerId} initialized`);
  }
}

/** purge deleted blocks from a WorkspaceContainer. */
async function purgeWorkspace(args: EditorOpts) {
  const container = await loadCloudContainer(args);
  const nGarbage = container.garbageBlocks;
  if (nGarbage === 0) {
    console.log(`container ${args.containerId} has no garbage blocks`);
    return;
  }

  await CloudSqlite.withWriteLock(container, async () => {
    await container.cleanDeletedBlocks();
  });

  console.log(`purged ${nGarbage} blocks from container ${args.containerId}`);
}

/** Make a copy of a WorkspaceDb with a new name. */
async function copyWorkspaceDb(args: CopyWorkspaceDbOpt) {
  const container = await loadCloudContainer(args);
  await CloudSqlite.withWriteLock(container, async () => {
    container.copyDatabase(args.dbName, args.newDbName);
  });

  console.log(`copied WorkspaceDb [${args.dbName}] to [${args.newDbName}], container=${args.containerId}`);
}
/** pin a WorkspaceDb from a WorkspaceContainer. */
async function pinWorkspaceDb(args: WorkspaceDbOpt) {
  const container = await loadCloudContainer(args);
  await container.pinDatabase(args.dbName, true);
  console.log(`pinned WorkspaceDb [${args.dbName}], container=${args.containerId}`);
}

/** pin a WorkspaceDb from a WorkspaceContainer. */
async function unPinWorkspaceDb(args: WorkspaceDbOpt) {
  const container = await loadCloudContainer(args);
  await container.pinDatabase(args.dbName, false);
  console.log(`un-pinned WorkspaceDb [${args.dbName}], container=${args.containerId}`);
}

/** acquire the write lock for a WorkspaceContainer. */
async function acquireLock(args: WorkspaceDbOpt) {
  const container = await loadCloudContainer(args);
  if (container.hasWriteLock)
    throw new Error(`write lock is already held for ${args.containerId}`);
  await container.acquireWriteLock();
  console.log(`acquired lock for container: ${args.containerId}`);
}

/** release the write lock for a WorkspaceContainer. */
async function releaseLock(args: WorkspaceDbOpt) {
  const container = await loadCloudContainer(args);
  if (!container.hasWriteLock)
    throw new Error(`write lock is not held for ${args.containerId}`);

  await container.releaseWriteLock();
  console.log(`released lock for container: ${args.containerId}`);
}

/** clear the write lock for a WorkspaceContainer. */
async function clearWriteLock(args: WorkspaceDbOpt) {
  const container = await loadCloudContainer(args);
  container.clearWriteLock();
  console.log(`write lock cleared for container: ${args.containerId}`);
}

/** query the list of WorkspaceDb in a WorkspaceContainer. */
async function queryWorkspaceDbs(args: WorkspaceDbOpt) {
  const container = await loadCloudContainer(args);
  const writeLockMsg = container.hasWriteLock ? ",  writeLocked" : "";
  const hasLocalMsg = container.hasLocalChanges ? ", has local changes" : "";
  const nGarbage = container.garbageBlocks;
  const garbageMsg = nGarbage ? `, ${nGarbage} garbage block${nGarbage > 1 ? "s" : ""}` : "";
  console.log(`WorkspaceDbs in CloudContainer "${args.containerId}"${writeLockMsg}${hasLocalMsg}${garbageMsg}`);

  const dbs = container.queryDatabases();
  for (const dbName of dbs) {
    const db = container.queryDatabase(dbName);
    if (db) {
      const dirty = db.dirtyBlocks ? `, ${db.dirtyBlocks} dirty` : "";
      const pinned = db.pinned !== 0 ? ", pinned" : "";
      console.log(` "${dbName}", size=${db.totalBlocks * 4}Mb, ${(100 * db.localBlocks / db.totalBlocks).toFixed(0)}% downloaded${dirty}${pinned}`);
    }
  }
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
  Logger.initializeToConsole();
  Logger.setLevel("CloudSqlite", LogLevel.Info);

  const type = { alias: "t", describe: "the type of resource", choices: ["blob", "string", "file"], required: true };
  const update = { alias: "u", describe: "update (i.e. replace) rather than add the files", boolean: true, default: false };
  Yargs.usage("Edits or lists contents of a WorkspaceDb");
  Yargs.wrap(Math.min(150, Yargs.terminalWidth()));
  Yargs.strict();
  Yargs.config();
  Yargs.default("config", "workspaceEditor.json");
  Yargs.help();
  Yargs.version("V2.0");
  Yargs.options({
    directory: { alias: "d", describe: "directory to use for WorkspaceContainers", string: true },
    nRequest: { describe: "number of simultaneous http requests for cloud operations", number: true },
    containerId: { alias: "c", describe: "WorkspaceContainerId for WorkspaceDb", string: true, required: true },
    user: { describe: "user name", string: true, required: true },
    accountName: { alias: "a", describe: "cloud storage account name for container", string: true, default: "" },
    sasToken: { describe: "shared access signature token", string: true, default: "" },
    storageType: { describe: "storage module type", string: true, default: "azure?sas=1" },
  });
  Yargs.command({
    command: "add <dbName> <files>",
    describe: "add or update files into a WorkspaceDb",
    builder: {
      rscName: { alias: "n", describe: "resource name for file", string: true },
      root: { alias: "r", describe: "root directory. Path parts after this will be saved in resource name", string: true },
      update,
      type,
    },
    handler: runCommand(addResource),
  });
  Yargs.command({
    command: "remove <dbName> <rscName>",
    describe: "remove a resource from a WorkspaceDb",
    builder: { type },
    handler: runCommand(removeResource),
  });
  Yargs.command({
    command: "extract <dbName> <rscName> <fileName>",
    describe: "extract a resource from a WorkspaceDb into a local file",
    builder: { type },
    handler: runCommand(extractResource),
  });
  Yargs.command({
    command: "listDb <dbName>",
    describe: "list the contents of a WorkspaceDb",
    builder: {
      strings: { alias: "s", describe: "list string resources", boolean: true, default: false },
      blobs: { alias: "b", describe: "list blob resources", boolean: true, default: false },
      files: { alias: "f", describe: "list file resources", boolean: true, default: false },
    },
    handler: runCommand(listWorkspaceDb),
  });
  Yargs.command({
    command: "deleteDb <dbName>",
    describe: "delete a WorkspaceDb from a cloud container",
    handler: runCommand(deleteWorkspaceDb),
  });
  Yargs.command({
    command: "createDb <dbName>",
    describe: "create a new WorkspaceDb",
    handler: runCommand(createWorkspaceDb),
  });
  Yargs.command({
    command: "copyDb <dbName> <newDbName>",
    describe: "make a copy of a WorkspaceDb in a cloud container with a new name",
    handler: runCommand(copyWorkspaceDb),
  });
  Yargs.command({
    command: "pinDb <dbName>",
    describe: "pin a WorkspaceDb from a cloud container",
    handler: runCommand(pinWorkspaceDb),
  });
  Yargs.command({
    command: "unpinDb <dbName>",
    describe: "un-pin a WorkspaceDb from a cloud container",
    handler: runCommand(unPinWorkspaceDb),
  });
  Yargs.command({
    command: "vacuumDb <dbName>",
    describe: "vacuum a WorkspaceDb",
    handler: runCommand(vacuumWorkspaceDb),
  });
  Yargs.command({
    command: "importDb <dbName> <localFileName>",
    describe: "import a WorkspaceDb into a cloud container",
    handler: runCommand(importWorkspaceDb),
  });
  Yargs.command({
    command: "exportDb <dbName> <localFileName>",
    describe: "export a WorkspaceDb from a cloud container to a local file",
    handler: runCommand(exportWorkspaceDb),
  });
  Yargs.command({
    command: "queryDbs",
    describe: "query the list of WorkspaceDbs in a cloud container",
    handler: runCommand(queryWorkspaceDbs),
  });
  Yargs.command({
    command: "acquireLock",
    describe: "acquire the write lock for a cloud container",
    handler: runCommand(acquireLock),
  });
  Yargs.command({
    command: "releaseLock",
    describe: "release the write lock for a cloud container",
    handler: runCommand(releaseLock),
  });
  Yargs.command({
    command: "clearWriteLock",
    describe: "clear the write lock for a cloud container. Note: this can be dangerous!",
    handler: runCommand(clearWriteLock),
  });
  Yargs.command({
    command: "purgeWorkspace",
    describe: "purge deleted blocks from a WorkspaceContainer",
    handler: runCommand(purgeWorkspace),
  });
  Yargs.command({
    command: "initializeWorkspace",
    describe: "initialize (empty if already exists) a WorkspaceContainer",
    handler: runCommand(initializeContainer),
  });
  Yargs.demandCommand();
  Yargs.argv;
}

void main();
