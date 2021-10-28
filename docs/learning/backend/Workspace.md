# Workspaces in iTwin.js

When an iTwin.js backend starts, [IModelHost.startup]($core-backend) creates an instance of a [Workspace]($core-backend), in [IModelHost.workspace]($core-backend).

`IModelHost.workspace` customizes the session according to the "wishes" of the:
 1. host application(s)
 2. organization of the user
 3. current iTwin
 4. current iModel
 5. current "activity" being performed

In the list above, later entries tend to change more frequently and, in the case of conflicting wishes, later entries override earlier ones.

`IModelHost.workspace` expresses the current state of the session in two forms:
  1. [Settings](#settings)
  2. [WorkspaceContainers](#workspacecontainers)

`Settings` are *named parameters* that an application defines and whose values are supplied at runtime. `WorkspaceContainers` hold "resources" (i.e. data) that the application uses. `Settings` and `WorkspaceContainers` are often related in application logic, e.g.:

 - a Setting may contain the "formula" to find a resource
 - a `WorkspaceContainer` may hold a resource that defines a group of Settings

This means that there must be some way to initialize the process. That should be some external (e.g. outside of WorkspaceContainer) service that supplies the initial Settings values.

## Settings

Settings are parameters, defined by

### SettingSpecs

### SettingNames

A [SettingName]($backend) is defined by an application in a [[SettingSpec]]. A `SettingName` must be unique across all applications, so it should be formed as a "path", with the parts separated by a "/". The first entry in the path is the "application id", and all Settings for an application should start with the same value. Groups of related settings for an application should have the same path prefix. The settings editor will split the path parts of a `SettingName` (using the "/" delimiter) as "tabs" for editing.

For example:
```ts
  "energyAnalysis/formats/totalWork"
  "energyAnalysis/formats/generationUnits"
  "iot-scan-visualization/ports/cameras"
  "vibration-map/filters/scope"
  "vibration-map/filters/prefabricated"
```
### SettingTypes

A SettingSpec defines the *type* of a Setting as one of:

  - string
  - number
  - integer
  - boolean
  - array
  - object

The Settings Editor will enforce that the values supplied for a Setting is the correct type.

## WorkspaceContainers

