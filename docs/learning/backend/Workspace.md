# Workspaces in iTwin.js

When an iTwin.js backend starts, [IModelHost.startup]($backend) creates an instance of a [Workspace]($backend), in [IModelHost.workspace]($backend).

`IModelHost.workspace` customizes the session according to the choices of the:
 1. host application(s)
 2. organization of the user
 3. current iTwin
 4. current iModel
 5. current "activity" being performed

In the list above, later entries tend to change more frequently and, in the case of conflicting choices, later entries override earlier ones.

`IModelHost.workspace` expresses the current state of the session in two forms:
  1. [Settings](#settings)
  2. [WorkspaceContainers](#workspacecontainers)

`Settings` are *named parameters* that an application defines and whose values are supplied at runtime. `WorkspaceContainers` hold *named resources* (i.e. data) that the application uses. `Settings` and `WorkspaceContainers` are often related in application logic, e.g.:

 - a Setting may contain the "formula" to find a resource
 - a `WorkspaceContainer` may hold a resource that defines a group of Settings

This means that there must be some way to initialize the process. That should be some external (e.g. outside of WorkspaceContainer) service that supplies the initial Settings values.

## Settings

Settings are named parameters, defined by applications but supplied at runtime so that their values may vary according to circumstances across and even within sessions.

### SettingSpecs

Applications can define groups of related "settings specifications" in the form of [SettingsGroupSpec]($backend)s, registered at runtime with the [SettingsSpecRegistry]($backend) class. In this way users or administrators can be aware of the list of an application's Settings. Also, each [SettingSpec]($backend) defines the type, purpose, constraints, and default values for a setting. The Settings Editor (future) can be used to provide values for Settings using the [SettingSpec]($backend)s.

`SettingsGroupSpec` are defined according to the rules of [JSON Schema](https://json-schema.org/).

#### SettingNames

A [SettingName]($backend) is defined by an application in a [[SettingSpec]]. A `SettingName` must be unique across all applications, so it should be formed as a "path", with the parts separated by a "/". The first entry in the path is the "application id", and all Settings for an application should start with the same value. Groups of related settings for an application should have the same path prefix. The settings editor will split the path parts of a `SettingName` (using the "/" delimiter) as "tabs" for editing.

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
[[include:Settings.Settings.addITwinDictionary]]
```

then

E.g.:
```ts
[[include:Settings.Settings.dropITwinDictionary]]
```

Of course `SettingDictionary`s wouldn't be very useful if you could only define them in JavaScript. Their real value comes from storing them externally, in JSON. That can be either stringified JSON (via [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)) stored in a `WorkspaceContainer`, or in a `.json` file.

> Hint: iTwin.js supports [JSON5](https://json5.org/) format to permit comments in settings files. [VSCode](https://code.visualstudio.com/) recognizes the `.json5` extension to edit JSON5 content with comments.

## WorkspaceContainers

[WorkspaceContainer]($backend)s are

