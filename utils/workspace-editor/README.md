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

The WorkspaceEditor commands all take a `WorkspaceId` option to specify the `WorkspaceFile` on which to operate. `WorkspaceId` become the resolved name of the `WorkspaceContainerName` from the Workspace api. `WorkspaceIds` must be less than 255 characters, may not have leading or trailing whitespace, and may not use any reserved path specification characters (see documentation for `WorkspaceContainerId` for details.) The `WorkspaceFile` filename is formed from the `WorkspaceContainerDir` plus the `WorkspaceId` with `.itwin-workspace` file extension.

## WorkspaceEditor Commands

The following WorkspaceEditor commands are available:

### Create

Create a new empty `WorkspaceFile`.

Example:
```sh
> WorkspaceEdit create templates
created WorkspaceFile C:\Users\Jane.Jones\AppData\Local\iTwin\Workspace\templates.itwin-workspace
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
> WorkspaceEditor add templates -t string -n startup-settings config.settings
WorkspaceFile [C:\Users\Jane.Jones\AppData\Local\iTwin\Workspace\templates.itwin-workspace]
 added [config.settings] as string resource "startup-settings"
```

```sh
> WorkspaceEditor add templates *.json
WorkspaceFile [C:\Users\Jane.Jones\AppData\Local\iTwin\Workspace\templates.itwin-workspace]
 added [specs.json] as file resource "specs.json"
 added [vendor.json] as file resource "vendor.json"
 ```

 ```sh
 > WorkspaceEditor add templates -t blob -r d:\templates\proj112 **\*.map
WorkspaceFile [C:\Users\Jane.Jones\AppData\Local\iTwin\Workspace\templates.itwin-workspace]
 added [d:\templates\proj112\Masterschanged\SO4814.map] as blob resource "Masterschanged/SO4814.map"
 added [d:\templates\proj112\Masterschanged\SO4815.map] as blob resource "Masterschanged/SO4815.map"
 added [d:\templates\proj112\Mastersorig\SO4814.map] as blob resource "Mastersorig/SO4814.map"
 added [d:\templates\proj112\Mastersorig\SO4815.map] as blob resource "Mastersorig/SO4815.map"
 added [d:\templates\proj112\Sparks\SO4814.map] as blob resource "Sparks/SO4814.map"
 added [d:\templates\proj112\Sparks\SO4815.map] as blob resource "Sparks/SO4815.map"
 added [d:\templates\proj112\Sparks\SO4816.map] as blob resource "Sparks/SO4816.map"
 ```

### List

List the contents of a `WorkspaceFile`. By default it will show all 3 resource types. To limit the output to specific types, supply the `--strings`, `--blobs`, or `--files` options.

Examples:

```sh
> WorkspaceEditor list templates
WorkspaceFile [C:\Users\Jane.Jones\AppData\Local\iTwin\Workspace\templates.itwin-workspace]
 strings:
  name=[startup-settings], size=1205
 blobs:
  name=[Masterschanged/SO4814.map], size=144384
  name=[Masterschanged/SO4815.map], size=89600
  name=[Mastersorig/SO4814.map], size=144384
  name=[Mastersorig/SO4815.map], size=89600
  name=[Sparks/SO4814.map], size=144384
  name=[Sparks/SO4815.map], size=109056
  name=[Sparks/SO4816.map], size=70144
 files:
  name=[specs.json], size=14484, ext="json", date=Thu Mar 12 2015 13:52:51 GMT-0400 (Eastern Daylight Time)
  name=[vendor.json], size=139984, ext="json", date=Thu Mar 22 2015 03:32:21 GMT-0400 (Eastern Daylight Time)
```

```sh
> WorkspaceEditor list templates --strings
WorkspaceFile [C:\Users\Jane.Jones\AppData\Local\iTwin\Workspace\templates.itwin-workspace]
 strings:
  name=[startup-settings], size=1205
```

### Extract

### Delete

### Vacuum
