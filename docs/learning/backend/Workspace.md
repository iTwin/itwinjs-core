# Workspaces in iTwin.js

> Note: Workspaces and Settings are both backend-only concepts.

When an iTwin.js backend starts, [IModelHost.startup]($backend) creates an instance of a [Workspace]($backend), in [IModelHost.appWorkspace]($backend).

`IModelHost.appWorkspace` can be used to customize the session according to the choices of the application, including the default values for its settings.

Whenever an application opens an iModel using the [IModelDb]($backend) class, it creates an instance of a [Workspace]($backend) in [IModelDb.workspace]($backend) to customize the session according to the choices made by administrators for the iTwin and the iModel.

When combined, the `IModelHost.appWorkspace` and the `IModelDb.workspace` customize the session according to the:

1. application's defaults
2. organization of the user
3. current iTwin
4. current iModel

In the list above, later entries tend to change more frequently and, in the case of duplicate values, later entries override earlier ones.

[Workspace]($backend)s expresses the current state of the session in two forms:

  1. [Settings](#settings)
  2. [WorkspaceDb](#workspaceDbs)

`Settings` are *named parameters* that an application defines and whose values are supplied at runtime. `WorkspaceDb`s hold *named resources* (i.e. data) that the application uses. `Settings` and `WorkspaceDb`s are often related in application logic, e.g.:

- a Setting may contain the "formula" to find a resource
- a `WorkspaceDb`s may hold a resource that defines a group of `Settings`

This means that there must be some way to initialize the process. That can either be in the form of [Settings stored inside an iModel](#imodel-settings) and automatically loaded when it opens, or some external file (e.g. outside of a WorkspaceDb) or service that supplies the initial Settings values.

## Settings

Settings are named parameters, defined by applications but supplied at runtime so that their values may vary according to circumstances across and even within sessions. At runtime, Settings are just JavaScript primitives, and may be accessed via [Settings.getSetting]($backend) by supplying a `SettingName`. Setting lookup is generally very efficient, so settings should *not* be cached in application code and should instead be retrieved as needed. That way they cannot get out of sync as they change.

### SettingNames

A [SettingName]($backend) used by applications to retrieve the current value of a Setting. A `SettingName` must be unique across all applications, so it should be formed as a "path", with the parts separated by a "/". By convention, the first entry in the path is the "application id", and all Settings for an application should start with the same value. Groups of related settings for an application should have the same path prefix. The settings editor will split the path parts of a `SettingName` (using the "/" delimiter) as "tabs" for editing.

For example:

```ts
"energyAnalysis/formats/totalWork"
"energyAnalysis/formats/totalHours"
"energyAnalysis/units/power"
"energyAnalysis/units/temperature"
"energyAnalysis/startupMode"
"iot-scan-visualization/ports/cameras"
"vibration-map/filters/scope"
"vibration-map/filters/prefabricated"
```

`SettingNames` must be valid [JavaScript property names](https://developer.mozilla.org/en-US/docs/Glossary/property/JavaScript), but should *not* contain periods or spaces.

### SettingSchema

A single `Setting` is defined according to the rules of [JSON Schema](https://json-schema.org/) via a [SettingSchema]($backend). The primary objective of creating a [SettingSchema]($backend) is to advertise the existence, meaning, and "form" of a Setting. Users supply values for setting using a settings editor, and are presented with the information from `SettingsSchema`s to guide their choices. In addition, `SettingSchema`s may also supply a default value so users can understand what happens if they don't provide a value for a Setting.

### SettingTypes

A `SettingSchema` defines the *type* of a Setting as one of:

- string
- number
- integer
- boolean
- array
- object

The Settings Editor will enforce that the values supplied for a Setting is the correct type.

### SettingSchemas

Applications can define groups of related `SettingSchema`s in the form of [SettingSchemaGroup]($backend)s, registered at runtime with the [SettingSchemas]($backend) class. A settings editor can present the settings for each group together, or each individually as appropriate.

#### Example SettingSchemaGroup

```ts
{
  "$id": "myApp schema",
  "$schema": "http://itwinjs.org./schema-json/Settings.schema.json",
  "title": "MyApp settings",
  "description": "the settings for myApplication",
  "type": "object",
  "groupName": "myApp",
  "order": 3,
  "properties": {
    "myApp/list/clickMode": {
      "type": "string",
      "enum": [
        "singleClick",
        "doubleClick"
      ],
      "default": "singleClick",
      "description": "click mode for the list"
    },
    "myApp/tree/indent": {
      "type": "number",
      "default": 8,
      "minimum": 0,
      "maximum": 40,
      "description": "tree indent setting"
    },
    "myApp/tree/label": {
      "type": "string",
      "default": "default label",
      "description": "label at top of tree"
    },
    "myApp/categories": {
      "type": "array",
      "description": "possible categories for placement",
      "items": {
        "type": "string",
        "description": "category names"
      }
    },
    "myApp/lastCheck/items": {
      "type": "array",
      "description": "array of items",
      "items": {
        "type": "object",
        "required": [
          "name",
          "volume"
        ],
        "properties": {
          "volume": {
            "type": "number",
            "description": "the volume of held by this item"
          },
          "name": {
            "type": "string",
            "description": "the name of the item"
          }
        }
      },
      "myApp/templateResources": {
        "type": "array",
        "description": "array of templates to load",
        "items": {
          "type": "object",
          "required": [
            "container",
            "templateName"
          ],
          "properties": {
            "container": {
              "type": "string",
              "description": "resource container name"
            },
            "template": {
              "type": "object",
              "description": "name of template file in container",
              "required": [
                "name"
              ]
              "properties": {
                "name": {
                  "type": "string",
                  "description": "template file name",
                },
                "loadByDefault: {
                  "type": "boolean",
                  "default": "true"
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### SettingDictionaries

The *values* for one or more Settings may be established by creating a JavaScript object with properties matching [SettingName]($backend)s.

E.g.:

```ts
[[include:Settings.addDictionaryDefine]]
```

> Note: The types of the properties should match the `SettingType` declared in the SettingGroupSec.

Then, the dictionary can be given a [DictionaryName]($backend), and a [SettingsPriority]($backend) and be added to the current [Settings]($backend):

```ts
[[include:Settings.addDictionary]]
```

Values in `SettingDictionary`s with a higher `SettingsPriority` override values in dictionaries with a lower priority.

E.g.:

```ts
[[include:Settings.addITwinDictionary]]
```

then

E.g.:

```ts
[[include:Settings.dropITwinDictionary]]
```

Settings may also be stored externally, in JSON. That can be either stringified JSON (via [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)) stored in a `WorkspaceDb`, or in a `.json` file.

> Hint: iTwin.js supports [JSON5](https://json5.org/) format to permit comments in settings files. [VSCode](https://code.visualstudio.com/) recognizes the `.json5` extension to edit JSON5 content with comments.

### Settings loaded at application startup

When [IModelhost.startup](#backend) is called, all files with the extension ".json" or ".json5" in the `@itwin/core-backend` package `assets\Settings` directory, plus all files listed by [IModelHostConfiguration.workspace.settingsFiles]($backend), are loaded into [IModelHost.appWorkspace.settings]($backend).

### iModel-based Settings

Every iModel can hold a set of `SettingDictionary`s that are automatically loaded when the iModel is opened. This can be used to supply values that should be present every session, for example a list of required `WorkspaceDb`s.

To save a `SettingDictionary` in an iModel, use [IModelDb.saveSettingDictionary]($backend).

## WorkspaceDbs

[WorkspaceDb]($backend)s are SQLite databases that hold `workspace resource`s.

## Cloud-based Workspaces

Cloud-based `WorkspaceContainer`s provide a mechanism for storing and retrieving `WorkspaceDb`s through a secure, reliable, and highly available cloud api.

Data stored in cloud-based `WorkspaceDb`s:

- can be versioned
- can have fine-grained access permissions, or may be publicly accessible
- can be accessed directly from cloud storage without pre-downloading
- is automatically *cached* locally for fast access
- can be fully downloaded for offline use
- is automatically synched when changes are made

The `WorkspaceContainer` apis abstract the cloud storage implementation, so the may be configured to use any cloud storage system (e.g. Azure, AWS, Google, etc.)

### Cloud storage fundamentals

Cloud-based storage systems provide access to data through a top-level concept called a "storage account". A storage account is assigned a unique name (the "account name") by the cloud provider, and is registered to a single organization who pays for its use. Within a storage account, data is stored in named groups called "containers". Containers names must be unique within a storage account, and generally have strict rules on format and length. It is generally expected that container names are not human-readable, but are instead identifiers like GUIDs, perhaps with a prefix or suffix. Containers can each have independent access rights, and users and applications are granted permissions to read, write, create, etc. by authenticating their identity and then obtaining a container-specific (usually expiring) "shared access signature token" or `sasToken` from the storage authority.

### WorkspaceContainer and WorkspaceDb

A [WorkspaceContainer]($backend) is a special type of cloud container that (only) holds [WorkspaceDb]($backend)s. [WorkspaceDb]($backend)s are databases that hold [workspace resources](#workspace-resources).

Conceptually, you can picture the hierarchy like this:

- Cloud Storage Account  (usually provided by service provider, e.g. Bentley)
  - `WorkspaceContainer`
    - `WorkspaceDb`
      - `WorkspaceResource`

Each `WorkspaceContainer` may hold many `WorkspaceDb`s, though it is common for `WorkspaceContainer`s to hold (versions of) a single `WorkspaceDb`. There is no limit on the number of `WorkspaceDbs` within a `WorkspaceContainer` or accessed during a session, nor is there a limit on the number of resources held within a `WorkspaceDb`.

However, when deciding how to organize workspace data, keep in mind:

- Access rights are per-`WorkspaceContainer`. That is, if a user has permission to access a `WorkspaceContainer`, they will have access to all `WorkspaceDb`s within it.
- For offline access, `WorkspaceDb`s are saved as files on local computers, and must be downloaded before going offline and then updated whenever new versions are created. Large downloads can be time consuming, so breaking large sets of resources into multiple `WorkspaceDb`s can be helpful.
- `WorkspaceDb`s are versioned. There is no versioning of individual resources within a `WorkspaceDb`.

### WorkspaceContainer.Name and WorkspaceContainer.Id

Every `WorkspaceContainer` has a unique identifier called a [WorkspaceContainer.Id]($backend). `WorkspaceContainer.Id`s may be GUIDs or any other identifier scheme that guarantees uniqueness. When the WorkspaceContainer is stored in the cloud, the `WorkspaceContainer.Id` identifies the name  con Since `WorkspaceContainer.Id`s can therefore be long and hard to recognize, `WorkspaceContainer`s can also be identified with a shorter, human recognizable `WorkspaceContainer.Name`. This not only provides an easier to recognize and understand scheme for interacting with `WorkspaceContainer`s, but also provides a level of indirection that can be useful for substituting different `WorkspaceContainer`s for the same `WorkspaceContainer.Name` at runtime, for example for versioning.

#### Workspace related SettingsSchemas

The Workspace subsystem used 3 Setting values:

1. `cloud/accounts`
2. `cloud/containers`
3. `workspace/databases`

defined by the following `SettingSchema`s:

```ts
    "cloud/accounts": {
      "type": "array",
      "description": "array of cloud accounts",
      "cumulative": true,
      "items": {
        "type": "object",
        "required": [
          "name",
          "accessName",
          "storageType"
        ],
        "properties": {
          "name": {
            "type": "string",
            "description": "the alias name of the cloud account, referenced from setting values"
          },
          "accessName": {
            "type": "string",
            "description": "the accessName for the cloud account"
          },
          "storageType": {
            "type": "string",
            "description": "the storageType of the cloud account"
          }
        }
      }
    },
    "cloud/containers": {
      "type": "array",
      "description": "array of cloud containers",
      "cumulative": true,
      "items": {
        "type": "object",
        "required": [
          "name",
          "containerId"
        ],
        "properties": {
          "name": {
            "type": "string",
            "description": "the alias name of this cloud container"
          },
          "containerId": {
            "type": "string",
            "description": "the containerId of this cloud container"
          },
          "accountName": {
            "type": "string",
            "description": "the account name for this cloud container. Must be an entry in \"cloud/accounts\""
          }
        }
      }
    },
    "workspace/databases": {
      "type": "array",
      "cumulative": true,
      "description": "array of workspace databases",
      "items": {
        "type": "object",
        "required": [
          "name",
          "dbName",
          "containerName"
        ],
        "name": {
          "type": "string",
          "description": "the alias name of the workspace database"
        },
        "properties": {
          "dbName": {
            "type": "string",
            "description": "the name of the database within its cloud container"
          },
          "containerName": {
            "type": "string",
            "description": "the cloud container name"
          },
          "version": {
            "type": "string",
            "description": "the (semver) range of acceptable versions"
          },
          "includePrerelease": {
            "type": "boolean",
            "description": "include prerelease version as acceptable versions"
          },
          "priority": {
            "type": "number",
            "description": "for sorted databases, higher values are searched first"
          },
          "prefetch": {
            "type": "boolean",
            "description": "if true, pre-fetch all of the data from the cloud in the background"
          }
        }
      }
    },
```

For example:

```ts
[[include:Settings.containerAlias]]
```

### CloudContainer Shared Access Signature (SAS) Tokens

To access a CloudContainer, users must first obtain a Shared Access Signature (aka a "sasToken") by supplying user credentials from the container authority. A `sasToken` provides access for a specific purpose for a limited time. `sasTokens` expire, usually after a few hours, and must be "refreshed" before they expire for sessions that outlive them.

Administrators may provide access to CloudContainers to groups of users via RBAC rules. Normally most users are provided readonly access to WorkspaceContainers, since they have no need or ability to change workspace content. Only a small set of trusted administrators are granted rights to modify the content of WorkspaceContainers.

If a WorkspaceContainer is marked for offline use, it is downloaded using a valid sasToken, but is available without the token thereafter. When the user goes online again, a new sasToken must be obtained to refresh the WorkspaceContainer if it has been modified.

A few special "public" WorkspaceContainers may be read by anyone, without needing an sasToken.

### Creating and Editing WorkspaceContainers

`WorkspaceDb`s are always created and modified by administrators rather than users. They are created and edited with the `WorkspaceEditor` utility. See README.md for details. To edit a WorkspaceDb, administrators must first obtain a writeable sasToken from the container authority.

#### WorkspaceContainer Locks


#### WorkspaceDb Versions

## Workspace Resources

A `WorkspaceDb` holds a set of resources, each with a [WorkspaceResource.Name]($backend) and a resource type.

Possible resource types are:

- `string` resources that hold strings. They may be loaded with [WorkspaceDb.getString]($backend).
- `blob` resources that hold `Uint8Array`s. They may be loaded with [WorkspaceDb.getBlob]($backend).
- `file` resources that hold arbitrary files. They may be extracted to local files with [WorkspaceDb.getFile]($backend)

> Note: files are zipped as they are stored in `WorkspaceContainer`s.

### WorkspaceResource.Names

[WorkspaceResource.Name]($backend)s identify resources within a `WorkspaceDb`. There are no restrictions on the format of a `WorkspaceResource.Name`, other than they are limited to 1024 characters and may not start or end with a blank character.

> Note: `WorkspaceResource.Name`s must be unique for each resource type. But, it is possible to have a `string`, a `blob`, and a `file` resource in the same `WorkspaceDb` with the same `WorkspaceResource.Name`.

### SettingDictionary Resources

It is often useful to store `SettingDictionary`s in a `WorkspaceContainer`, so they may be distributed, versioned, aliased, and access controlled. This can be easily accomplished by storing the stringified JSON representation of the `SettingDictionary` as a `string` resource and using [Workspace.loadSettingsDictionary]($backend) to load it.

## WorkspaceEditor
