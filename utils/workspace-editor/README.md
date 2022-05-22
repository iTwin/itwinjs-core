# WorkspaceEditor

**WorkspaceEditor** is a command line utility for creating and editing `WorkspaceResources` in iTwin `WorkspaceDb`s, and for uploading and downloading `WorkspaceDb`s to cloud `WorkspaceContainer`s.

An iTwin `WorkspaceDb` may hold many `WorkSpaceResources`, each with a `WorkspaceResourceName` and `WorkspaceResourceType`. `WorkspaceEditor` adds, updates, deletes, and extracts *local files* into/from a `WorkspaceDb`.

## Workspace Resource Types

There are 3 `WorkspaceResourceType`s that may be accessed by `@itwin-backend` applications at runtime via the `WorkspaceContainer` api:

 1. `string` accessed via the `getString` method
 2. `blob`  binary data accessed via the `getBlob` method
 3. `file`  extracted to a local file via the `getFile` method

Several `WorkspaceEditor` commands require a `--type` argument to specify which `WorkspaceResourceType` to use.

## The WorkspaceContainer Directory

`WorkspaceDb`s are located by iTwin.js inside a `WorkspaceContainer` subdirectory within the `WorkspaceContainerDir` directory. `WorkspaceContainerDir` is specified as a directory name in the `workspace.containerDir` member on the `configuration` argument of  `IModelHost.startup`. The default value is `%localappdata%/iTwin/Workspace`. WorkspaceEditor will normally create and edit `WorkspaceDb`s in the default directory, but if you wish to use a different directory, supply the `--directory` option to specify a different `WorkspaceContainerDir` location.

## Workspace dbName

The WorkspaceEditor commands all take a `dbName` option to specify the `WorkspaceDb` on which to operate. The WorkspaceDb is located inside the `WorkspaceContainerId` specified with the --containerId argument. `WorkspaceDbName`s must be less than 255 characters, may not have leading or trailing whitespace, and may not use any reserved path specification characters (see documentation for `WorkspaceDbName` for details.) The `WorkspaceDb` filename is formed via: `${WorkspaceContainerDir}/${WorkspaceContainerId}/${WorkspaceDbName}.itwin-workspace`.

## WorkspaceEditor Config file

`WorkspaceEditor` accepts the `--config` option to specify the name of a JSON file that holds values for `WorkspaceEditor` options. By default, `WorkspaceEditor` looks in the current directory for a file named `workspaceEditor.json`.

Example:

```sh
> WorkspaceEdit --config myConfig.json list db1
...
```

```json
> cat myConfig.json
{
  "directory": "d:/projData/112/",
  "containerId": "proj112",
  "accountName": "smsblob1",
  "sasToken": "<valid token here>"
}
```

> Note: config files **must** have a `.json` extension.

## WorkspaceEditor Commands

The following WorkspaceEditor commands are available:

### Create

Create a new empty `WorkspaceDb`.

Example:

```sh
> WorkspaceEdit create proj
created WorkspaceDb C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112\proj.itwin-workspace
```

### Add

Add one or more local files as resources into a `WorkspaceDb`.

`--type` specifies the type of resource(s) to add. Required
`--name` specifies the name of the resource. Defaults to the name of the local file.
`--root` specifies a root directory when adding multiple files. The parts of the path after the root are saved in the resource name (see example below.)
`--update` indicates that an existing resource should be updated (i.e. replaced.)

> Note: `--name`  is only applicable when adding a single file.

Examples:

```sh
> WorkspaceEditor add proj -n equipment-data D:\data\equip.dat
WorkspaceDb [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112\proj.itwin-workspace]
 added "D:\data\equip.dat" as file resource [equipment-data]
```

```sh
> WorkspaceEditor add proj -string *.json
WorkspaceDb [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112\proj.itwin-workspace]
 added "specs.json" as string resource [specs.json]
 added "vendor.json" as string resource [vendor.json]
 ```

```sh
 > WorkspaceEditor add proj -t blob -r d:\projData\112\ **\*.dict
WorkspaceDb [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112\proj.itwin-workspace]
 added "d:\projData\112\TernKit\KDEO5814.dict" as blob resource [TernKit/KDEO5814.dict]
 added "d:\projData\112\TernKit\KDEO5815.dict" as blob resource [TernKit/KDEO5815.dict]
 added "d:\projData\112\UniSpace\KDEO5814.dict" as blob resource [UniSpace/KDEO5814.dict]
 added "d:\projData\112\UniSpace\KDEO5815.dict" as blob resource [UniSpace/KDEO5815.dict]
 added "d:\projData\112\Sparks\KDEO5814.dict" as blob resource [Sparks/KDEO5814.dict]
 added "d:\projData\112\Sparks\KDEO5815.dict" as blob resource [Sparks/KDEO5815.dict]
 added "d:\projData\112\Sparks\KDEO5816.dict" as blob resource [Sparks/KDEO5816.dict]
 ```

### List

List the contents of a `WorkspaceDb`. By default it will show all 3 resource types. To limit the output to specific types, supply the `--strings`, `--blobs`, or `--files` options.

Examples:

```sh
> WorkspaceEditor list proj
WorkspaceDb [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112\proj.itwin-workspace]
 strings:
  name=[specs.json], size=12050
  name=[vendor.json], size=31335
 blobs:
  name=[TernKit/KDEO5814.dict], size=144221
  name=[TernKit/KDEO5815.dict], size=89600
  name=[UniSpace/KDEO5814.dict], size=144384
  name=[UniSpace/KDEO5815.dict], size=89600
  name=[Sparks/KDEO5814.dict], size=144384
  name=[Sparks/KDEO5815.dict], size=109056
  name=[Sparks/KDEO5816.dict], size=70144
 files:
  name=[equipment-data], size=14484, ext="dat", date=Thu Mar 12 2015 13:52:51 GMT-0400
```

```sh
> WorkspaceEditor list proj --strings
WorkspaceDb [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112\proj.itwin-workspace]
 strings:
  name=[specs.json], size=12050
  name=[vendor.json], size=31335
```

### Extract

Extract a `WorkspaceResource` from a `WorkspaceDb` into a local file.

Example:
```sh
> WorkspaceEditor extract proj -t blob UniSpace/KDEO5815.dict d:\temp\kd.dict
WorkspaceDb [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112\proj.itwin-workspace]
 blob resource [UniSpace/KDEO5815.dict] extracted to "d:\temp\kd.dict"
```

### Delete

Delete an existing `WorkspaceResource` from a `WorkspaceDb`.

Example:
```sh
> WorkspaceEditor delete proj -t blob UniSpace/KDEO5815.dict
WorkspaceDb [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112\proj.itwin-workspace]
 deleted blob resource [UniSpace/KDEO5815.dict]
```

### Vacuum

[Vacuum](https://www.sqlite.org/lang_vacuum.html) a `WorkspaceDb`. This can make a `WorkspaceDb` smaller and more efficient to access.

Example:
```sh
> WorkspaceEditor vacuum proj
WorkspaceDb [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112\proj.itwin-workspace] vacuumed
```
