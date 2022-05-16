# WorkspaceEditor

**WorkspaceEditor** is a command line utility for creating and editing `WorkspaceResources` in iTwin `WorkspaceDb`s, and for uploading, downloading, and editing `WorkspaceDb`s in cloud `WorkspaceContainer`s.

An iTwin `WorkspaceDb` may hold many `WorkSpaceResources`, each with a `WorkspaceResource.Name` and type. `WorkspaceEditor` adds, updates, deletes, and extracts *local files* into/from a `WorkspaceDb`.

## Workspace Resource Types

There are 3 `WorkspaceResourceType`s that may be accessed by `@itwin-backend` applications at runtime via the `WorkspaceDb` api:

 1. `string` accessed via the `getString` method
 2. `blob`  binary data accessed via the `getBlob` method
 3. `file`  extracted to a local file via the `getFile` method

Several `WorkspaceEditor` commands require a `--type` argument to specify which `WorkspaceResourceType` to use.

## The WorkspaceContainer Directory

`WorkspaceDb`s may be either local files or from cloud `WorkspaceContainers`. When creating new `WorkspaceDb`s, it is sometimes useful to just work with a local file until all resources have been imported, before uploading the WorkspaceDb to the cloud container.

`WorkspaceDb`s are located by iTwin.js inside a `WorkspaceContainer` subdirectory within the `WorkspaceContainerDir` directory. `WorkspaceContainerDir` is specified as a directory name in the `workspace.containerDir` member on the `configuration` argument of  `IModelHost.startup`. The default value is `%localappdata%/iTwin/Workspace`.

WorkspaceEditor will normally create and edit `WorkspaceDb`s in the default directory, but if you wish to use a different directory, supply the `--directory` option to specify a different `WorkspaceContainerDir` location.

## Workspace dbName

The WorkspaceEditor commands all take a `dbName` option to specify the `WorkspaceDb` on which to operate. The WorkspaceDb is located inside the `WorkspaceContainer` specified with the --containerId argument. `WorkspaceDbName`s must be less than 255 characters, may not have leading or trailing whitespace, and may not use any reserved path specification characters (see documentation for `WorkspaceDbName` for details.) The `WorkspaceDb` filename is formed via: `${WorkspaceContainerDir}/${WorkspaceContainerId}/${WorkspaceDbName}.itwin-workspace`.

## WorkspaceEditor Config file

`WorkspaceEditor` accepts the `--config` option to specify the name of a JSON file that holds values for `WorkspaceEditor` options. By default, `WorkspaceEditor` looks in the current directory for a file named `workspaceEditor.json`.

Example:

```sh
> WorkspaceEditor --config myConfig.json listDb db1
...
```

```json
myConfig.json:

{
  "containerId": "5d385232-a2ec-4f31-b74b-8201c027848d",
  "accessName": "smsblob1",
  "storageType": "azure?sas=1",
  "user": "workspace editor example",
  "accessToken": "<valid token here>"
}
```

> config files *must* have a `.json` extension.

## WORKSPACE_EDITOR_xxx Environment Variables

Any command line option may also be specified by setting a shell environment variable with the option's name after the prefix `WORKSPACE_EDITOR_`.

For example, config files may also be specified by setting the environment variable `WORKSPACE_EDITOR_CONFIG`.

```cmd
set WORKSPACE_EDITOR_CONFIG=d:\projData\config.json
```

To specify camelCase options, separate the words with an underbar, e.g.:

```cmd
set WORKSPACE_EDITOR_ACCESS_TOKEN=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
```

> `WORKSPACE_EDITOR_` environment variable names are *case sensitive* and must be ALL CAPS

## WorkspaceEditor Commands

The following WorkspaceEditor commands are available:

```sh
> WorkspaceEditor

Edits or lists contents of a WorkspaceDb

Commands:
  WorkspaceEditor add <dbName> <files>                   add files into a WorkspaceDb
  WorkspaceEditor replace <dbName> <files>               replace files in a WorkspaceDb
  WorkspaceEditor remove <dbName> <rscName>              remove a resource from a WorkspaceDb
  WorkspaceEditor extract <dbName> <rscName> <fileName>  extract a resource from a WorkspaceDb into a local file
  WorkspaceEditor listDb <dbName>                        list the contents of a WorkspaceDb
  WorkspaceEditor deleteDb <dbName>                      delete a WorkspaceDb from a cloud container
  WorkspaceEditor createDb <dbName>                      create a new WorkspaceDb
  WorkspaceEditor copyDb <dbName> <newDbName>            make a copy of a WorkspaceDb in a cloud container with a new name
  WorkspaceEditor versionDb <dbName>                     make a new version of a WorkspaceDb
  WorkspaceEditor vacuumDb <dbName>                      vacuum a WorkspaceDb
  WorkspaceEditor importDb <dbName> <localFileName>      import a WorkspaceDb into a cloud container
  WorkspaceEditor exportDb <dbName> <localFileName>      export a WorkspaceDb from a cloud container to a local file
  WorkspaceEditor queryDbs [like]                        query the list of WorkspaceDbs in a cloud container
  WorkspaceEditor acquireLock                            acquire the write lock for a cloud container
  WorkspaceEditor releaseLock                            release the write lock for a cloud container
  WorkspaceEditor clearWriteLock                         clear the write lock for a cloud container. Note: this can be dangerous!
  WorkspaceEditor purgeWorkspace                         purge deleted blocks from a WorkspaceContainer
  WorkspaceEditor initializeWorkspace                    initialize a WorkspaceContainer (empties if already initialized)
```

## Commands that operate on WorkspaceDbs

All of the examples in this section use `local.json` for config:

```
set WORKSPACE_EDITOR_CONFIG=r:\local.json
```

```json
r:\local.json:
{
  "directory": "r:/workspaces",
  "containerId": "proj112"
}
```

The name of the `WorkspaceDb` is supplied with the `dbName` argument. For cloud-based `WorkspaceContainers`, `dbName` may either include the version number (e.g. `pipe-spec:1.3.2`) or, if no version is supplied, the highest version is used.

### createDb \<dbName>

Create a new empty `WorkspaceDb`.

Example:

```sh
> WorkspaceEditor createDb proj
created WorkspaceDb r:\workspaces\proj112\proj.itwin-workspace
```

### add \<dbName> \<files>

Add one or more local files as resources into a `WorkspaceDb`.

`--rscName` specifies the name of the resource. Defaults to the name of the local file.
`--root` specifies a root directory when adding multiple files. The parts of the path after the root are saved in the resource name (see example below.)
`--type` specifies the type of resource(s) to add. Required

> Note: `--rscName`  is only applicable when adding a single file.

Examples:

```sh
> WorkspaceEditor add proj --rscName=equipment-data --type=file r:\data\equip.dat
WorkspaceDb [r:\workspaces\proj112\proj.itwin-workspace]
 added "r:/data/equip.dat" as file resource [equipment-data]

> WorkspaceEditor add proj --type=string --root=r:\json *
WorkspaceDb [r:\workspaces\proj112\proj.itwin-workspace]
 added "r:\json\contracts.json" as string resource [contracts.json]
 added "r:\json\firecode.json" as string resource [firecode.json]
 added "r:\json\specs.json" as string resource [specs.json]
 added "r:\json\vendor.json" as string resource [vendor.json]

 > WorkspaceEditor add proj --type=blob --root=r:\dict **\*.dict
WorkspaceDb [r:\workspaces\proj112\proj.itwin-workspace]
 added "r:\dict\Sparks\KDE05814.dict" as blob resource [Sparks/KDE05814.dict]
 added "r:\dict\Sparks\KDE05815.dict" as blob resource [Sparks/KDE05815.dict]
 added "r:\dict\Sparks\KDE05816.dict" as blob resource [Sparks/KDE05816.dict]
 added "r:\dict\Sparks\KDE05922.dict" as blob resource [Sparks/KDE05922.dict]
 added "r:\dict\Sparks\KDE05929.dict" as blob resource [Sparks/KDE05929.dict]
 added "r:\dict\TernKit\TRN02324.dict" as blob resource [TernKit/TRN02324.dict]
 added "r:\dict\TernKit\TRN05314.dict" as blob resource [TernKit/TRN05314.dict]
 added "r:\dict\TernKit\TRN05814.dict" as blob resource [TernKit/TRN05814.dict]
 added "r:\dict\TernKit\TRN09911.dict" as blob resource [TernKit/TRN09911.dict]
 added "r:\dict\UniSpace\KRT05554.dict" as blob resource [UniSpace/KRT05554.dict]
 added "r:\dict\UniSpace\KRT05800.dict" as blob resource [UniSpace/KRT05800.dict]
 added "r:\dict\UniSpace\KRT05814.dict" as blob resource [UniSpace/KRT05814.dict]
 added "r:\dict\UniSpace\KRT05820.dict" as blob resource [UniSpace/KRT05820.dict]
 added "r:\dict\UniSpace\KRT06519.dict" as blob resource [UniSpace/KRT06519.dict]
```

### replace \<dbName> \<files>

Replace an existing resource in a `WorkspaceDb` with a new version.

Takes the same arguments as `add`.

### remove \<dbName> \<rscName>

Remove an existing `WorkspaceResource` from a `WorkspaceDb`.

Example:

```sh
> WorkspaceEditor remove proj --type blob UniSpace/KRT06519.dict
WorkspaceDb [r:\workspaces\proj112\proj.itwin-workspace]
 removed blob resource [UniSpace/KRT06519.dict]
```

### extract \<dbName> \<rscName> \<fileName>

Extract a `WorkspaceResource` from a `WorkspaceDb` into a local file, leaving the `WorkspaceResource` unchanged in the `WorkspaceDb`.

Example:

```sh
> WorkspaceEditor extract proj -t blob UniSpace/KRT05820.dict d:\temp\kd.dict
WorkspaceDb [r:\workspaces\proj112\proj.itwin-workspace]
 blob resource [UniSpace/KRT05820.dict] extracted to "d:\temp\kd.dict"
```

### listDb \<dbName>

List the contents of a `WorkspaceDb`. By default it will show all 3 resource types. To limit the output to specific types, supply the `--strings`, `--blobs`, or `--files` options.

Examples:

```sh
> WorkspaceEditor list proj
WorkspaceDb [r:\workspaces\proj112\proj.itwin-workspace]
 strings:
  name=contracts.json, size=17K
  name=firecode.json, size=3K
  name=specs.json, size=8K
  name=vendor.json, size=46K
 blobs:
  name=Sparks/KDE05814.dict, size=224K
  name=Sparks/KDE05815.dict, size=307K
  name=Sparks/KDE05816.dict, size=32K
  name=Sparks/KDE05922.dict, size=56K
  name=Sparks/KDE05929.dict, size=15K
  name=TernKit/TRN02324.dict, size=405
  name=TernKit/TRN05314.dict, size=67K
  name=TernKit/TRN05814.dict, size=7K
  name=TernKit/TRN09911.dict, size=3K
  name=UniSpace/KRT05554.dict, size=2K
  name=UniSpace/KRT05800.dict, size=5K
  name=UniSpace/KRT05814.dict, size=13K
  name=UniSpace/KRT05820.dict, size=7K
 files:
  name=equipment-data, size=134K, ext="dat", date=Tue Jul 08 2021 13:55:19 GMT-0400 (Eastern Daylight Time)

> WorkspaceEditor list proj --strings
WorkspaceDb [r:\workspaces\proj112\proj.itwin-workspace]
 strings:
  name=contracts.json, size=17K
  name=firecode.json, size=3K
  name=specs.json, size=8K
  name=vendor.json, size=46K
```

### vacuumDb

[Vacuum](https://www.sqlite.org/lang_vacuum.html) a `WorkspaceDb`. This can make a `WorkspaceDb` smaller and more efficient to access.

Example:

```sh
> WorkspaceEditor vacuumDb proj
Vacuuming r:\workspaces\proj112\proj.itwin-workspace ... done
```

## Commands that operate on Cloud WorkspaceContainers

The following `WorkspaceEditor` commands work only on cloud-based `WorkspaceContainers`.

All of the examples in this section use `cloud.json` for config:

```
set WORKSPACE_EDITOR_CONFIG=r:\cloud.json
```

```json
r:\cloud.json:
{
  "directory": "r:/workspaces",
  "accessName": "<storage account name here>",
  "accessToken": "<storage account key here>",
  "storageType": "azure?sas=0",
  "containerId": "5d385232-a2ec-4f31-b74b-8201c027848d",
  "user": "Example editor admin"
}
```

When operating on cloud `WorkspaceContainer`s, WorkspaceEditor must first [obtain the write lock](#acquirelock) on the container. If successful, the lock is held on the container and all changes are only made locally (i.e. not visible to users) until [the write lock is released](#releaselock). Only a single administrator may be editing a cloud WorkspaceContainer at a time. Most WorkspaceEditor commands will fail if the write lock is not held.

The normal workflow for changing a `WorkspaceDb` in a cloud `WorkspaceContainer` involves running WorkspaceEditor multiple times to:

1. Acquire the write lock on the container using [acquireLock](#acquirelock)
2. Create a new version (major, minor, or patch) of the `WorkspaceDb` using [versionDb](#versiondb-dbname)
3. Edit the new version using one or more [add](#add-dbname-files), [replace](#replace-dbname-files), or [remove](#remove-dbname-rscname) resource commands.
4. Release the write lock using [releaselock](#releaselock)

### initializeWorkspace

Initialize or empty the contents of a cloud `WorkspaceContainer`. This command should be used after a cloud storage container is first created, or to empty an existing previously-initialized storage container.

Since this command will destroy any existing contents of the container, should be used with care. There is an `Are you sure...` prompt to avoid accidents. The `--noPrompt` option can be used from scripts.

Example:

```sh
> WorkspaceEditor initializeWorkspace
Are you sure you want to initialize container [5d385232-a2ec-4f31-b74b-8201c027848d]"? [y/n]: y
container "5d385232-a2ec-4f31-b74b-8201c027848d initialized

 -or-

> WorkspaceEditor initializeWorkspace --noPrompt
container "5d385232-a2ec-4f31-b74b-8201c027848d initialized
```

### acquireLock

Attempt to acquire the write lock for the cloud `WorkspaceContainer`. This command places the value of the `--user` argument in the lock state of cloud container, so if another user attempts to acquire the write lock before it is released, they will see an error message indicating that the lock is currently held and by whom.

Example:

```sh
> WorkspaceEditor acquireLock
acquired lock for container [5d385232-a2ec-4f31-b74b-8201c027848d]
```

> While the write lock is held, all changes to the `WorkspaceContainer` are stored locally and cannot be seen by users until the lock is released.

> The write lock expires after one hour and may thereafter be acquired by others. If no other editor has acquired the lock, it may be re-acquired. However, if someone else acquires the lock, all local changes are lost and must be abandoned.

### releaseLock

Attempt to upload any local changes to the cloud `WorkspaceContainer` and, upon success, release the write lock.

Example:

```sh
> WorkspaceEditor releaseLock
released lock for container [5d385232-a2ec-4f31-b74b-8201c027848d]
```

### clearWriteLock

Clear the write lock currently held by another (failed) editor. This command "steals" the lock away from its current owner. After this command, the original holder of the write lock will fail when/if it attempts to release its lock and will lose all its changes.

> This command is not normally ever needed, and should only be used in extreme cases when it is know to be safe.

Example:

```sh
> WorkspaceEditor clearWriteLock
write lock cleared for container [5d385232-a2ec-4f31-b74b-8201c027848d]
```

### importDb \<dbName> \<localFileName>

Import a locally-created `WorkspaceDb` file into a cloud container. The first argument determines the name of the WorkspaceDb within the cloud container. If you don't supply an initial version number, in the form ":major.minor.patch", it will be "1.0.0". The second argument is the name of the local file (without the ".itwin-workspace" extension), including the local container name (since local container names often differ from cloud container names).

Examples:

```sh
> WorkspaceEditor importDb project proj112\proj
Vacuuming r:\workspaces\proj112\proj.itwin-workspace ... done
import r:\workspaces\proj112\proj.itwin-workspace, container=5d385232-a2ec-4f31-b74b-8201c027848d, dbName=project:1.0.0 : complete, 0.044 seconds

- or -

> WorkspaceEditor importDb project:2.0.2 proj112\proj
Vacuuming r:\workspaces\proj112\proj.itwin-workspace ... done
import r:\workspaces\proj112\proj.itwin-workspace, container=5d385232-a2ec-4f31-b74b-8201c027848d, dbName=project:2.0.2 : complete, 0.044 seconds
```

### versionDb \<dbName>

Create a new version of an existing WorkspaceDb so it may be edited. All of the resource editing commands will only work after the `versionDb` command and before the `releaseLock` command.

After creating a new version of a WorkspaceDb, you must release the write lock for the new version to be visible to users. After the write lock is released on a version of a `WorkspaceDb` **it becomes immutable** and may never be modified again.

`dBName` indicates the source database from which the new version is created. `dbName` may include the source version number (e.g. `pipe-spec:1.3.2`). If no version is supplied the highest version is used.

The `--versionType` option determines how the current version number is incremented (default is "patch").

For example, suppose the latest version is `pipe-spec:1.3.2`:

```sh

> WorkspaceEditor versionDb pipe-spec --versionType=major
created new version: [pipe-spec:2.0.0] from [pipe-spec:1.3.2] in container [5d385232-a2ec-4f31-b74b-8201c027848d]

 - or -

> WorkspaceEditor versionDb pipe-spec:1.3.2 --versionType=minor
created new version: [pipe-spec:1.4.0] from [pipe-spec:1.3.2] in container [5d385232-a2ec-4f31-b74b-8201c027848d]

 - or -

> WorkspaceEditor versionDb pipe-spec --versionType=patch
created new version: [pipe-spec:1.3.3] from [pipe-spec:1.3.2] in container [5d385232-a2ec-4f31-b74b-8201c027848d]

 - or -

> WorkspaceEditor versionDb pipe-spec
created new version: [pipe-spec:1.3.3] from [pipe-spec:1.3.2] in container [5d385232-a2ec-4f31-b74b-8201c027848d]

```

> The examples above are not intended to illustrate sequential commands. Once you make a new version of a WorkspaceDb, you may begin editing it. But you cannot make another version until you release the write lock.

### queryDbs [glob]

Show a list of all `WorkspaceDb` in a cloud `WorkspaceContainer`.

The optional `glob` argument can be used to filter the results using the SQLite [GLOB](https://www.sqlite.org/lang_expr.html#glob) operator.

Examples:

```sh
> WorkspaceEditor queryDbs
WorkspaceDbs in container [5d385232-a2ec-4f31-b74b-8201c027848d], writeLocked, has local changes
 "ame-ria:1.0.0", size=24M, 0M downloaded (0%)
 "base-data:1.0.0", size=144M, 0M downloaded (0%)
 "base-data:1.0.1", size=144M, 12M downloaded (9%)
 "proj:1.0.0", size=4M, 4M downloaded (100%)
 "proj:1.0.1", size=4M, 4M downloaded (100%)
 "proj:1.1.0", size=4M, 4M downloaded (100%), editable

> WorkspaceEditor queryDbs b*
WorkspaceDbs in container [5d385232-a2ec-4f31-b74b-8201c027848d], writeLocked, has local changes
 "base-data:1.0.0", size=144M, 0M downloaded (0%)
 "base-data:1.0.1", size=144M, 12M downloaded (9%)
```

The output also shows:

- whether the write lock is held
- whether there are local changes to be uploaded
- whether there are garbage blocks that can be purged
- for each `WorkspaceDb`:
  - its full name with version
  - its total size
  - number of bytes downloaded and percentage
  - whether the database is editable

### exportDb \<dbName> \<localFileName>

Export a `WorkspaceDb` from a cloud `WorkspaceContainer` into a local file.

Example:

```sh
> WorkspaceEditor exportDb proj:1.0.1 d:\temp\proj
export d:\temp\proj.itwin-workspace, container=5d385232-a2ec-4f31-b74b-8201c027848d, dbName=proj:1.0.1 : complete, 0.013 seconds
```

> `dbName` must include a version number.

### deleteDb \<dbName>

Delete a `WorkspaceDb` from a cloud `WorkspaceContainer`.

Example:

```sh
> WorkspaceEditor deleteDb proj3dt:2.0.0
deleted WorkspaceDb [proj3dt:2.0.0] from container [5d385232-a2ec-4f31-b74b-8201c027848d]
```

This command is not normally used, since older versions of `WorkspaceDb`s may be used by existing or archived projects. It should *only* be used when it can be known that the `WorkspaceDb` is no longer needed for any purpose. Otherwise, leaving old versions in the cloud has very little downside.

> `dbName` must include a version number.

### purgeWorkspace

Delete currently unused blocks from a cloud `WorkspaceContainer`. This is only necessary or useful after vacuuming databases.

## @ scripts

It is sometimes necessary to run WorkspaceEditor in *batch mode*, for example during pipeline jobs. If the first argument to WorkspaceEditor begins with an "@", the rest of the argument is a file name from which WorkspaceEditor commands are executed in sequence.

The second argument can specify the config file for the script.

> In @ scripts, anything after an **`#`** is treated as a comment and blank lines are ignored.

For example, to run the examples above:

Assume a file called `importAll.txt` contains:

```sh
> cat importAll.txt

# Create a new local WorkspaceDb file and import resources into it

createDb proj # create a new blank WorkspaceDb
add proj --rscName=equipment-data --type=file r:\data\equip.dat # add file
add proj --type=string --root=r:\json * # add strings
add proj --type=blob --root=r:\dict **\*.dict # add blob
listDb proj # so we can tell it worked
```

run `importAll.txt` as an @ script using `local.json` as config:

```sh
> WorkspaceEditor @importAll.txt --config=r:\local.json
created WorkspaceDb r:\workspaces\proj112\proj.itwin-workspace
WorkspaceDb [r:\workspaces\proj112\proj.itwin-workspace]
 added "r:/data/equip.dat" as file resource [equipment-data]
WorkspaceDb [r:\workspaces\proj112\proj.itwin-workspace]
 added "r:\json\contracts.json" as string resource [contracts.json]
 added "r:\json\firecode.json" as string resource [firecode.json]
 added "r:\json\specs.json" as string resource [specs.json]
 added "r:\json\vendor.json" as string resource [vendor.json]
WorkspaceDb [r:\workspaces\proj112\proj.itwin-workspace]
 added "r:\dict\Sparks\KDE05814.dict" as blob resource [Sparks/KDE05814.dict]
 added "r:\dict\Sparks\KDE05815.dict" as blob resource [Sparks/KDE05815.dict]
 added "r:\dict\Sparks\KDE05816.dict" as blob resource [Sparks/KDE05816.dict]
 added "r:\dict\Sparks\KDE05922.dict" as blob resource [Sparks/KDE05922.dict]
 added "r:\dict\Sparks\KDE05929.dict" as blob resource [Sparks/KDE05929.dict]
 added "r:\dict\TernKit\TRN02324.dict" as blob resource [TernKit/TRN02324.dict]
 added "r:\dict\TernKit\TRN05314.dict" as blob resource [TernKit/TRN05314.dict]
 added "r:\dict\TernKit\TRN05814.dict" as blob resource [TernKit/TRN05814.dict]
 added "r:\dict\TernKit\TRN09911.dict" as blob resource [TernKit/TRN09911.dict]
 added "r:\dict\UniSpace\KRT05554.dict" as blob resource [UniSpace/KRT05554.dict]
 added "r:\dict\UniSpace\KRT05800.dict" as blob resource [UniSpace/KRT05800.dict]
 added "r:\dict\UniSpace\KRT05814.dict" as blob resource [UniSpace/KRT05814.dict]
 added "r:\dict\UniSpace\KRT05820.dict" as blob resource [UniSpace/KRT05820.dict]
 added "r:\dict\UniSpace\KRT06519.dict" as blob resource [UniSpace/KRT06519.dict]
WorkspaceDb [r:\workspaces\proj112\proj.itwin-workspace]
 strings:
  name=contracts.json, size=17K
  name=firecode.json, size=3K
  name=specs.json, size=8K
  name=vendor.json, size=46K
 blobs:
  name=Sparks/KDE05814.dict, size=224K
  name=Sparks/KDE05815.dict, size=307K
  name=Sparks/KDE05816.dict, size=32K
  name=Sparks/KDE05922.dict, size=56K
  name=Sparks/KDE05929.dict, size=15K
  name=TernKit/TRN02324.dict, size=405
  name=TernKit/TRN05314.dict, size=67K
  name=TernKit/TRN05814.dict, size=7K
  name=TernKit/TRN09911.dict, size=3K
  name=UniSpace/KRT05554.dict, size=2K
  name=UniSpace/KRT05800.dict, size=5K
  name=UniSpace/KRT05814.dict, size=13K
  name=UniSpace/KRT05820.dict, size=7K
  name=UniSpace/KRT06519.dict, size=687
 files:
  name=equipment-data, size=134K, ext="dat", date=Tue Jul 08 2014 13:55:19 GMT-0400 (Eastern Daylight Time)
```

Then, a separate file called `createCloud.txt` contains:

```sh
> cat createCloud.txt

# initialize container and import WorkspaceDb from previous step

initializeWorkspace --noPrompt # don't prompt for yes/no
importDb project proj112\proj # import WorkspaceDb from local directory into cloud container.
queryDbs # so we can tell it worked
```
run `createCloud.txt` as an @ script using `cloud.json` for config:

```sh
> WorkspaceEditor @r:\createCloud.txt --config=r:\cloud.json
container "5d385232-a2ec-4f31-b74b-8201c027848d initialized
Vacuuming r:\workspaces\proj112\proj.itwin-workspace ... done
import r:\workspaces\proj112\proj.itwin-workspace, container=5d385232-a2ec-4f31-b74b-8201c027848d, dbName=project:1.0.0 : complete, 0.047 seconds
WorkspaceDbs in container [5d385232-a2ec-4f31-b74b-8201c027848d]
 "project:1.0.0", size=4M, 0M downloaded (0%)
 ```
