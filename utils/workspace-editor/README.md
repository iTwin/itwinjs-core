# WorkspaceEditor

**WorkspaceEditor** is a command line utility for creating and editing `WorkspaceResources` in iTwin `WorkspaceFile`s.

An iTwin `WorkspaceFile` may hold many `WorkSpaceResources`, each with a `WorkspaceResourceName` and `WorkspaceResourceType`. `WorkspaceEditor` adds, updates, deletes, and extracts *local files* into/from a `WorkspaceFile`.

## Workspace Resource Types

There are 3 `WorkspaceResourceType`s that may be accessed by `@itwin-backend` applications at runtime via the `WorkspaceContainer` api:
 1. `string` accessed via the `getString` method
 2. `blob`  binary data accessed via the `getBlob` method
 3. `file`  extracted to a local file via the `getFile` method

WorkspaceEditor commands accept a `--type` argument to specify which `WorkspaceResourceType` to use. The default is `file`.

## The WorkspaceFile Directory

`WorkspaceFile`s are located in iTwin.js in the `WorkspaceContainerDir` directory. It is specified as a directory name in the `workspace.containerDir` member on the `configuration` argument of  `IModelHost.startup`. The default value is `%localappdata%\iTwin\Workspace`. WorkspaceEditor will normally create and edit `WorkspaceFiles` in the default directory, but if you wish to use a different directory, use the `--directory` option to specify a different `WorkspaceContainerDir` location.

## WorkspaceId

The WorkspaceEditor commands all take a `WorkspaceId` option to specify the `WorkspaceFile` on which to operate. `WorkspaceId` become the resolved name of the `WorkspaceContainerName` from the Workspace api. `WorkspaceIds` must be less than 255 characters, may not have leading or trailing whitespace, and may not use any reserved path specification characters (see documentation for `WorkspaceContainerId` for details.) The `WorkspaceFile` filename is formed from the `WorkspaceContainerDir` plus the `WorkspaceId` plus the `.itwin-workspace` file extension.

## WorkspaceEditor Commands

The following WorkspaceEditor commands are available:

### Create

Create a new empty `WorkspaceFile`.

Example:
```sh
> WorkspaceEdit create proj112
created WorkspaceFile C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112.itwin-workspace
```

### Add

Add one or more local files into a `WorkspaceFile`.

`--type` specifies the type of resource(s) to add.
`--name` specifies the name of the resource. Defaults to the name of the local file.
`--root` specifies a root directory when adding multiple files. The parts of the path after the root are saved in the resource name (see example below.)
`--update` indicates that an existing resource should be updated (i.e. replaced.)

> Note: `--name`  is only applicable when adding a single file.

Examples:
```sh
> WorkspaceEditor add proj112 -n equipment-data D:\data\equip.dat
WorkspaceFile [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112.itwin-workspace]
 added "D:\data\equip.dat" as file resource [equipment-data]
```

```sh
> WorkspaceEditor add proj112 -string *.json
WorkspaceFile [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112.itwin-workspace]
 added "specs.json" as string resource [specs.json]
 added "vendor.json" as string resource [vendor.json]
 ```

```sh
 > WorkspaceEditor add proj112 -t blob -r d:\projData\112\ **\*.dict
WorkspaceFile [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112.itwin-workspace]
 added "d:\projData\112\\TernKit\KDEO5814.dict" as blob resource [TernKit/KDEO5814.dict]
 added "d:\projData\112\\TernKit\KDEO5815.dict" as blob resource [TernKit/KDEO5815.dict]
 added "d:\projData\112\\UniSpace\KDEO5814.dict" as blob resource [UniSpace/KDEO5814.dict]
 added "d:\projData\112\\UniSpace\KDEO5815.dict" as blob resource [UniSpace/KDEO5815.dict]
 added "d:\projData\112\\Sparks\KDEO5814.dict" as blob resource [Sparks/KDEO5814.dict]
 added "d:\projData\112\\Sparks\KDEO5815.dict" as blob resource [Sparks/KDEO5815.dict]
 added "d:\projData\112\\Sparks\KDEO5816.dict" as blob resource [Sparks/KDEO5816.dict]
 ```

### List

List the contents of a `WorkspaceFile`. By default it will show all 3 resource types. To limit the output to specific types, supply the `--strings`, `--blobs`, or `--files` options.

Examples:

```sh
> WorkspaceEditor list proj112
WorkspaceFile [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112.itwin-workspace]
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
> WorkspaceEditor list proj112 --strings
WorkspaceFile [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112.itwin-workspace]
 strings:
  name=[specs.json], size=12050
  name=[vendor.json], size=31335
```

### Extract

Extract a `WorkspaceResource` from a `WorkspaceFile` into a local file.

Example:
```sh
> WorkspaceEditor extract proj112 -t blob UniSpace/KDEO5815.dict d:\temp\kd.dict
WorkspaceFile [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112.itwin-workspace]
 blob resource [UniSpace/KDEO5815.dict] extracted to "d:\temp\kd.dict"
```

### Delete

Delete an existing `WorkspaceResource` from a `WorkspaceFile`.

Example:
```sh
> WorkspaceEditor delete proj112 -t blob UniSpace/KDEO5815.dict
WorkspaceFile [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112.itwin-workspace]
 deleted blob resource [UniSpace/KDEO5815.dict]
```

### Vacuum

[Vacuum](https://www.sqlite.org/lang_vacuum.html) a `WorkspaceFile`. This can make a `WorkspaceFile` smaller and more efficient to access.

Example:
```sh
> WorkspaceEditor vacuum proj112
WorkspaceFile [C:\Users\User.Name\AppData\Local\iTwin\Workspace\proj112.itwin-workspace] vacuumed
```
