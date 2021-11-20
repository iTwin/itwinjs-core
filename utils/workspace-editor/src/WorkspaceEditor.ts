/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { join, parse } from "path";
import * as Yargs from "yargs";
import * as fs from "fs";
import { EditableWorkspaceFile, IModelHost, IModelJsFs, WorkspaceFile, WorkspaceResourceName } from "@itwin/core-backend";
import { DbResult } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";

/* eslint-disable id-blacklist,no-console */

interface WorkspaceOpts {
  workspaceFile: string;
}

type RscType = "blob" | "string" | "file";

interface AddResourceOption extends WorkspaceOpts {
  resourceName?: WorkspaceResourceName;
  type: RscType;

}
interface AddDirOptions extends AddResourceOption {
  directory: LocalDirName;
  baseName?: string;
  subdirectories?: boolean;
}

interface AddFileOptions extends AddResourceOption {
  file: LocalFileName;
}

interface ListOptions extends WorkspaceOpts {
  strings?: boolean;
  files?: boolean;
  blobs?: boolean;
}

function listWorkspace(args: ListOptions) {
  if (!args.strings && !args.blobs && !args.files)
    args.blobs = args.files = args.strings = true;

  const file = new WorkspaceFile(args.workspaceFile, IModelHost.appWorkspace);
  file.open();
  console.log(`Resources in [${file.db.nativeDb.getFilePath()}]:`);
  if (args.strings) {
    console.log(" strings:");
    file.db.withSqliteStatement("SELECT id,value FROM strings", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        console.log(`  name=[${stmt.getValueString(0)}], size=${stmt.getValueString(1).length}`);
    });
  }
  if (args.blobs) {
    console.log(" blob:");
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
}

function addFile(arg: AddFileOptions & { wsFile: EditableWorkspaceFile, resourceName: WorkspaceResourceName }) {
  if (arg.type === "string") {
    const val = fs.readFileSync(arg.file, "utf-8");
    arg.wsFile.addString(arg.resourceName, val);
  } else if (arg.type === "blob") {
    const val = fs.readFileSync(arg.file);
    arg.wsFile.addBlob(arg.resourceName, val);
  } else {
    arg.wsFile.addFile(arg.resourceName, arg.file);
  }
  console.log(`added [${arg.file}] as ${arg.type} resource [${arg.resourceName}]`);
}

function createWorkspace(args: WorkspaceOpts) {
  const wsFile = new EditableWorkspaceFile(args.workspaceFile, IModelHost.appWorkspace);
  wsFile.create();
  console.log(`created workspace file ${wsFile.db.nativeDb.getFilePath()}`);
  wsFile.close();
}

function embedDir(wsFile: EditableWorkspaceFile, dir: LocalDirName, baseName: string, opts: AddDirOptions) {
  for (const childPath of IModelJsFs.readdirSync(dir)) {
    const file = join(dir, childPath);
    const isDir = IModelJsFs.lstatSync(file)?.isDirectory;
    if (isDir) {
      if (true === opts.subdirectories)
        embedDir(wsFile, file, `${baseName}/${childPath}`, opts);
    } else {
      const parsed = parse(file);
      let resourceName = `${baseName}/${parsed.base}`;
      if (resourceName[0] === "/")
        resourceName = resourceName.slice(1);
      addFile({ wsFile, resourceName, file, ...opts });
    }
  }
}

function addToWorkspace<T extends WorkspaceOpts>(args: T, fn: (ws: EditableWorkspaceFile, args: T) => void) {
  const wsFile = new EditableWorkspaceFile(args.workspaceFile, IModelHost.appWorkspace);
  wsFile.open();
  console.log(`adding to workspace container [${wsFile.db.nativeDb.getFilePath()}]`);
  try {
    fn(wsFile, args);
  } finally {
    wsFile.db.saveChanges();
    wsFile.close();
  }
}

function addDirToWorkspace(args: AddDirOptions) {
  addToWorkspace(args, (wsFile, args) => embedDir(wsFile, args.directory, args.baseName ?? "", args));
}

function addFileToWorkspace(args: AddFileOptions) {
  addToWorkspace(args, (wsFile, args) => {
    if (!IModelJsFs.existsSync(args.file))
      throw new Error(`file [${args.file}] does not exist`);
    const parsed = parse(args.file);
    const resourceName = args.resourceName ?? parsed.base;
    addFile({ ...args, resourceName, wsFile });
  });
}

function dropFromWorkspace(argv: any) {
  console.log(argv);
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
      command: "addFile <workspaceFile> <file>",
      describe: "add a file to a workspace container",
      builder: {
        resourceName: { alias: "r", describe: "resource name for file", string: true },
        type: { alias: "t", describe: "the type of resource to add", choices: ["blob", "string", "file"], default: "file" },
      },
      handler: runCommand(addFileToWorkspace),
    })
    .command({
      command: "addDir <workspaceFile> <directory>",
      describe: "add directory to a workspace container",
      builder: {
        type: { alias: "t", describe: "the type of resource to add", choices: ["blob", "string", "file"], default: "file" },
        subdirectories: { alias: "s", boolean: true, describe: "include subdirectories", default: false },
        baseName: { alias: "b", string: true, describe: "base to prepend to resource name" },
      },
      handler: runCommand(addDirToWorkspace),
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
