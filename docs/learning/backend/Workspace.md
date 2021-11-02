# Workspaces in iTwin.js

When an iTwin.js backend starts, [IModelHost.startup]($backend) creates an instance of a [Workspace]($backend), in [IModelHost.appWorkspace]($backend).

`IModelHost.appWorkspace` customizes the session according to the choices of the host application(s), including the default values for its settings.

Whenever an application opens an iModel using the [IModelDb]($backend) class, it creates an instance of a [Workspace]($backend) in [IModelDb.workspace]($backend) to customize the session according to the choices made by administrators for the organization, the iTwin and the iModel.

When combined, the `IModelHost.appWorkspace` and the `IModelDb.workspace` customize the session according to the:

 1. application's defaults
 2. organization of the user
 3. current iTwin
 4. current iModel

In the list above, later entries tend to change more frequently and, in the case of conflicting choices, later entries override earlier ones.

[Workspace]($backend)s expresses the current state of the session in two forms:
  1. [Settings](#settings)
  2. [WorkspaceContainers](#workspacecontainers)

`Settings` are *named parameters* that an application defines and whose values are supplied at runtime. `WorkspaceContainers` hold *named resources* (i.e. data) that the application uses. `Settings` and `WorkspaceContainers` are often related in application logic, e.g.:

 - a Setting may contain the "formula" to find a resource
 - a `WorkspaceContainer` may hold a resource that defines a group of Settings

This means that there must be some way to initialize the process. That should be some external (e.g. outside of WorkspaceContainer) service that supplies the initial Settings values.

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

## WorkspaceContainers

[WorkspaceContainer]($backend)s are named containers of a group of [workspace resources](#workspace-resources). There is no limit on the number of `WorkspaceContainers` accessed during a session, nor is there a limit on the number of resources held within a `WorkspaceContainer`. However, keep in mind:

 - Access rights are per-`WorkspaceContainer`. That is, if a user has permission to access a `WorkspaceContainer`, they will have access to all resources within it.
 - For offline access, `WorkspaceContainer`s are saved as files on local computers, and must be initially downloaded and re-downloaded whenever they are updated. Multi-gigabyte downloads can be time consuming.
 - WorkspaceContainers are versioned as a whole. There is no versioning of individual resources within a WorkspaceContainer.

Generally, it is expected that a single `WorkspaceContainer` will hold a related set of resources for a single "scope" (e.g. organization, discipline, iTwin, iModel, etc.) for an appropriate set of users.

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

### Cloud-backed WorkspaceContainers

`WorkspaceContainer`s are meant to be the distribution system for application resources, so users need to be sure they're always using the correct version of resources - which may or may not be the newest version, depending on their workflow. That may be accomplished either by *brute force* (e.g. copying files around), or much better, by using a cloud *workspace service*. The `Workspace` API is virtually the same either way.

When using a cloud workspace service, every call to [Workspace.getContainer]($backend) first checks whether the local copy of the `WorkspaceContainer` is up-to-date with the cloud version, and synchronizes it if not. When using the "offline" mode, the `WorkspaceContainer` is fully downloaded to a local file in the [Workspace.containerDir]($backend) directory, with the name `${containerId}.itwin-workspace-container`.

When using brute force, `Workspace.containerDir` may be a directory on a shared file server, or the `.itwin-workspace-container` files may be copied around some other way.

### Creating WorkspaceContainers

`WorkspaceContainers` are always created and modified by administrators rather than users, usually on desktop computers. They are created as local files using [EditableWorkspaceFile.create]($backend), and modified using the other methods on `EditableWorkspaceFile`.

When using a cloud workspace service, the cloud container is created by calling [EditableWorkspaceFile.upload]($backend).

### WorkspaceContainer Editing and Synchronization

To modify the cloud version of `WorkspaceContainer`s, the `CloudContainer` process must be must be running and a writable cloud access token must first be obtained. There may only be one editor at a time per `WorkspaceContainer`. Changes are automatically uploaded when the `WorkspaceContainer` is closed. Then, whenever any user attempts to access it using [Workspace.getContainer]($backend), their local copy will automatically be update with the latest changes.

### WorkspaceContainer Versioning


## Workspace Resources

A `WorkspaceContainer` holds a set of resources, each with a [WorkspaceResourceName]($backend) and a resource type.

Possible resource types are:

 - `string` resources that hold strings. They may be loaded with [WorkspaceContainer.getString]($backend).
 - `blob` resources that hold `Uint8Array`s. They may be loaded with [WorkspaceContainer.getBlob]($backend).
 - `file` resources that hold arbitrary files. They may be extracted to local files with [WorkspaceContainer.getFile]($backend)

> Note: files are zipped as they are stored in `WorkspaceContainer`s.

### WorkspaceResourceNames

[WorkspaceResourceName]($backend)s identify resources within a `WorkspaceContainer`. There are no restrictions on the format of a `WorkspaceResourceName`, other than they are limited to 1024 characters and may not start or end with a blank character.

> Note: WorkspaceResourceNames must be unique for each resource type. But, it is possible to have a `string`, a `blob`, and a `file` resource in the same `WorkspaceContainer` with the same `WorkspaceResourceName`.

### SettingDictionary Resources

It is often useful to store `SettingDictionary`s in a `WorkspaceContainer`, so they may be distributed, versioned, aliased, and access controlled. This can be easily accomplished by storing the stringified JSON representation of the `SettingDictionary` as a `string` resource and using [Workspace.loadSettingsDictionary]($backend) to load it.
