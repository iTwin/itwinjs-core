# Workspaces in iTwin.js

> Note: Workspaces and Settings are both backend-only concepts.

When an iTwin.js backend starts, [IModelHost.startup]($backend) creates an instance of a [Workspace]($backend), in [IModelHost.appWorkspace]($backend).

`IModelHost.appWorkspace` customizes the session according to the choices of the host application(s), including the default values for its settings.

Whenever an application opens an iModel using the [IModelDb]($backend) class, it creates an instance of a [Workspace]($backend) in [IModelDb.workspace]($backend) to customize the session according to the choices made by administrators for the organization, the iTwin and the iModel.

When combined, the `IModelHost.appWorkspace` and the `IModelDb.workspace` customize the session according to the:

1. application's defaults
2. organization of the user
3. current iTwin
4. current iModel

In the list above, later entries tend to change more frequently and, in the case of duplicate values, later entries override earlier ones.

[Workspace]($backend)s expresses the current state of the session in two forms:

  1. [Settings](#settings)
  2. [WorkspaceDbs](#workspaceDbs)

`Settings` are *named parameters* that an application defines and whose values are supplied at runtime. `WorkspaceContainers` hold *named resources* (i.e. data) that the application uses. `Settings` and `WorkspaceContainers` are often related in application logic, e.g.:

- a Setting may contain the "formula" to find a resource
- a `WorkspaceContainer` may hold a resource that defines a group of Settings

This means that there must be some way to initialize the process. That can either be in the form of [Settings stored inside an iModel](#imodel-settings) and automatically loaded when it opens, or some external (e.g. outside of WorkspaceContainer) service that supplies the initial Settings values.

## Settings

Settings are named parameters, defined by applications but supplied at runtime so that their values may vary according to circumstances across and even within sessions.

### SettingSpecs

Applications can define groups of related "settings specifications" in the form of [SettingsGroupSpec]($backend)s, registered at runtime with the [SettingsSpecRegistry]($backend) class. In this way users or administrators can be aware of the list of an application's Settings. Also, each [SettingSpec]($backend) defines the type, purpose, constraints, and default values for a setting. The Settings Editor (future) is used to provide values for Settings using the [SettingSpec]($backend)s.

`SettingsGroupSpec` are defined according to the rules of [JSON Schema](https://json-schema.org/).

#### SettingNames

A [SettingName]($backend) is defined by an application in a [SettingSpec]($backend). A `SettingName` must be unique across all applications, so it should be formed as a "path", with the parts separated by a "/". The first entry in the path is the "application id", and all Settings for an application should start with the same value. Groups of related settings for an application should have the same path prefix. The settings editor will split the path parts of a `SettingName` (using the "/" delimiter) as "tabs" for editing.

For example:

```ts
"energyAnalysis/formats/totalWork"
"energyAnalysis/formats/generationUnits"
"iot-scan-visualization/ports/cameras"
"vibration-map/filters/scope"
"vibration-map/filters/prefabricated"
```

#### SettingTypes

A [SettingSpec]($backend) defines the *type* of a Setting as one of:

- string
- number
- integer
- boolean
- array
- object

The Settings Editor will enforce that the values supplied for a Setting is the correct type.

#### Example SettingGroupSec

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

The values for one or more Settings may be established by creating a JavaScript object with properties matching [SettingName]($backend)s.

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

Of course `SettingDictionary`s wouldn't be very useful if you could only define them in JavaScript. Their real value comes from storing them externally, in JSON. That can be either stringified JSON (via [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)) stored in a `WorkspaceContainer`, or in a `.json` file.

> Hint: iTwin.js supports [JSON5](https://json5.org/) format to permit comments in settings files. [VSCode](https://code.visualstudio.com/) recognizes the `.json5` extension to edit JSON5 content with comments.

### iModel-based Settings

Every iModel can hold a set of `SettingDictionary`s that are loaded every session. This can be used to supply values that should be present every session, for example a list of required `WorkspaceDb`s.

To save a `SettingDictionary` in an iModel, use [IModelDb.saveSettingDictionary]($backend).

## Cloud Workspaces

`WorkspaceContainer`s provide a mechanism for storing and retrieving `Workspace` data through a secure, reliable, and highly available cloud api.

Data stored in cloud-based `WorkspaceContainers`:
  - can be versioned
  - can have fine-grained access permissions, or may be publicly accessible
  - can be accessed directly from cloud storage
  - is automatically *cached* locally for fast access
  - can be downloaded for offline use
  - is automatically synched when it changes

The `WorkspaceContainer` apis abstract the cloud storage implementation, so the may be configured to use any cloud storage system (e.g. Azure, AWS, Google, etc.)

### Cloud storage fundamentals

Cloud-based storage systems provide access to data through a top-level concept called a "storage account". A storage account is assigned a unique name (the "account name") by the cloud provider, and is registered to a single organization who pays for its use. Within a storage account, data is stored in named groups called "containers". Containers names must be unique within a storage account, and generally have strict rules on format and length. It is generally expected that container names are not human-readable, but are instead identifiers like GUIDs, perhaps with a prefix or suffix. Containers can each have independent access rights, and users and applications are granted permissions to read, write, create, etc. by authenticating their identity and then obtaining a container-specific (usually expiring) "shared access signature token" or `sasToken` from the storage authority.

### WorkspaceContainer and WorkspaceDb

A [WorkspaceContainer]($backend) is a special type of cloud container that (only) holds [WorkspaceDb]($backend)s. [WorkspaceDb]($backend)s are files that hold [workspace resources](#workspace-resources).

Conceptually, you can picture the hierarchy like this:

- Cloud Storage Account  (usually provided by service provider, e.g. Bentley)
  - `WorkspaceContainer`
    - `WorkspaceDb`
      - `WorkspaceResource`

Each `WorkspaceContainer` may hold many `WorkspaceDb`s, though it is common for `WorkspaceContainer`s to hold a single `WorkspaceDb`. There is no limit on the number of `WorkspaceDbs` within a `WorkspaceContainer` or accessed during a session, nor is there a limit on the number of resources held within a `WorkspaceDb`.

However, when deciding how to organize workspace data, keep in mind:

- Access rights are per-`WorkspaceContainer`. That is, if a user has permission to access a `WorkspaceContainer`, they will have access to all `WorkspaceDb`s within it.
- For offline access, `WorkspaceDb`s are saved as files on local computers, and must be downloaded before going offline and then re-downloaded whenever they are updated. Large downloads can be time consuming, so breaking large sets of resources into multiple `WorkspaceDb`s can be helpful.
- `WorkspaceContainers` and `WorkspaceDb`s may be versioned. There is no versioning of individual resources within a `WorkspaceDb`.

### WorkspaceContainerName and WorkspaceContainerId

Every `WorkspaceContainer` has a unique identifier called a [WorkspaceContainerId]($backend). `WorkspaceContainerId`s may be GUIDs or any other identifier scheme that guarantees uniqueness. Since `WorkspaceContainerId`s can therefore be long and hard to recognize, `WorkspaceContainer`s can also be identified with a shorter, human recognizable `WorkspaceContainerName`. This not only provides an easier to recognize and understand scheme for interacting with `WorkspaceContainer`s, but also provides a level of indirection that can be useful for substituting different `WorkspaceContainer`s for the same `WorkspaceContainerName` at runtime, for example for versioning.

#### The `workspace/container/alias` Setting

A `WorkspaceContainerId` is *resolved* from a `WorkspaceContainerName` via the [Workspace.resolveContainerId]($backend) method. It does so by looking through all current [Workspace.settings]($backend) of type:

```ts
    "workspace/container/alias": {
      "type": "array",
      "description": "array of workspace container aliases",
      "items": {
        "type": "object",
        "required": [
          "name",
          "id"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "the id of the workspace container"
          },
          "name": {
            "type": "string",
            "description": "the name of the workspace container"
          }
        }
      },
```

with entries whose `name` property matches the `WorkspaceContainerName` value. The highest priority `workspace/container/alias` setting for a `WorkspaceContainerName` becomes its `WorkspaceContainerId`. If no matching `workspace/container/alias` setting is found, the `WorkspaceContainerName` becomes the `WorkspaceContainerId`.

For example:

```ts
[[include:Settings.containerAlias]]
```

> Note: more than one `WorkspaceContainerName` may resolve to the same `WorkspaceContainerId`.

### Creating and Editing WorkspaceContainers

`WorkspaceContainers` are always created and modified by administrators rather than users. They are created and edited with the `WorkspaceEditor` utility. See README.md for details.

## Workspace Resources

A `WorkspaceDb` holds a set of resources, each with a [WorkspaceResourceName]($backend) and a resource type.

Possible resource types are:

- `string` resources that hold strings. They may be loaded with [WorkspaceDb.getString]($backend).
- `blob` resources that hold `Uint8Array`s. They may be loaded with [WorkspaceDb.getBlob]($backend).
- `file` resources that hold arbitrary files. They may be extracted to local files with [WorkspaceDb.getFile]($backend)

> Note: files are zipped as they are stored in `WorkspaceContainer`s.

### WorkspaceResourceNames

[WorkspaceResourceName]($backend)s identify resources within a `WorkspaceDb`. There are no restrictions on the format of a `WorkspaceResourceName`, other than they are limited to 1024 characters and may not start or end with a blank character.

> Note: `WorkspaceResourceName`s must be unique for each resource type. But, it is possible to have a `string`, a `blob`, and a `file` resource in the same `WorkspaceDb` with the same `WorkspaceResourceName`.

### SettingDictionary Resources

It is often useful to store `SettingDictionary`s in a `WorkspaceContainer`, so they may be distributed, versioned, aliased, and access controlled. This can be easily accomplished by storing the stringified JSON representation of the `SettingDictionary` as a `string` resource and using [Workspace.loadSettingsDictionary]($backend) to load it.
