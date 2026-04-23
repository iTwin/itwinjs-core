# Settings

[Settings]($backend) are how administrators configure an iTwin.js application for end-users. A setting is a named value — a `string`, `number`, `boolean`, object, or array — that controls application behavior at run-time. Settings can live at different levels of persistence — in-memory app defaults, cloud-backed iTwin settings, or iModel-specific overrides — and the runtime resolves them by priority so higher-priority values win.

> **New to this topic?** Start with the [Workspaces and Settings overview](./WorkspacesAndSettings.md) to understand how [Settings]($backend), settings containers, and [WorkspaceDb]($backend) relate before diving in here.

## What is a setting?

A setting controls application behavior. For example, an application might provide a check box to toggle "dark mode"; whether users can see that check box in the first place could be controlled by a setting. Each individual's dark mode choice is a user preference, not a setting.

A [Setting]($backend) is a name-value pair. The value can be:

- A `string`, `number`, or `boolean`;
- An `object` containing properties of any of these types; or
- An `array` containing elements of one of these types.

A [SettingName]($backend) must be unique, 1 to 1024 characters long with no leading nor trailing whitespace, and should begin with the schema prefix of the [schema](#settings-schemas) that defines it. For example, LandscapePro might define:

```
  "landscapePro/ui/defaultToolId"
  "landscapePro/ui/availableTools"
  "landscapePro/flora/preferredStyle"
  "landscapePro/flora/treeDbs"
  "landscapePro/hardinessRange"
```

Forward slashes create logical groupings, similar to file paths.

## Settings schemas

The metadata describing a group of related [Setting]($backend)s is defined in a [SettingGroupSchema]($backend). The schema is based on [JSON Schema](https://json-schema.org/), with the following additions:

- `schemaPrefix` (required) — a unique name for the schema. All names in the schema inherit this prefix.
- `description` (required) — a description appropriate for displaying to a user.
- `settingDefs` — an object of [SettingSchema]($backend)s describing individual settings, indexed by name.
- `typeDefs` — an object of [SettingSchema]($backend)s describing reusable types that can be referenced by other schemas.
- `order` — an optional integer used to sort schemas in a user interface.

We can define the LandscapePro schema programmatically as follows:

```ts
[[include:WorkspaceExamples.SettingGroupSchema]]
```

This schema defines 5 `settingDefs` and 1 `typeDef`. The "landscapePro" prefix is implicitly included in each name — for example, the full name of "hardinessRange" is "landscapePro/hardinessRange".

The "hardinessZone" typeDef represents a [USDA hardiness zone](https://en.wikipedia.org/wiki/Hardiness_zone) as an integer between 0 and 13. The "hardinessRange" settingDef reuses it for both "minimum" and "maximum" via `extends`. Note that `extends` requires the schema prefix, even within the same schema.

The "flora/treeDbs" settingDef `extends` "workspaceDbList" from the [workspace schema](https://github.com/iTwin/itwinjs-core/blob/master/core/backend/src/assets/Settings/Schemas/Workspace.Schema.json), with prefix "itwin/core/workspace".

### Registering schemas

The set of currently-registered schemas can be accessed via [IModelHost.settingsSchemas]($backend). Register new ones using [SettingsSchemas.addFile]($backend), [SettingsSchemas.addDirectory]($backend), or — for programmatic schemas — [SettingsSchemas.addGroup]($backend):

```ts
[[include:WorkspaceExamples.RegisterSchema]]
```

Register schemas shortly after invoking [IModelHost.startup]($backend), using the [IModelHost.onAfterStartup]($backend) event:

```ts
IModelHost.onAfterStartup.addListener(() => {
  IModelHost.settingsSchemas.addGroup(landscapeProSchema);
});
```

For brevity, some of the extract snippets later in this article call `IModelHost.settingsSchemas.addGroup(...)` directly. In an application, register schemas during startup, usually in `IModelHost.onAfterStartup`.

All schemas are unregistered when [IModelHost.shutdown]($backend) is invoked.

### Schema validation behavior

Validation occurs lazily when you **retrieve** a setting value — not when the value is stored. When you call methods like [Settings.getString]($backend), [Settings.getObject]($backend), or [Settings.getBoolean]($backend), the value is validated against the registered schema for that setting name:

- If **no schema** is registered for the setting name, the value passes through unchecked.
- If a schema **is** registered, type mismatches throw an error — for example, if the schema declares a setting to be a `string` but the dictionary supplies a `number`.
- For `object` types, `required` fields are enforced and `extends` references are resolved recursively.

Because validation happens on retrieval, register your schemas early — ideally via [IModelHost.onAfterStartup]($backend) — so that type errors are caught as soon as the setting is first accessed.

## Settings dictionaries

A [SettingsDictionary]($backend) supplies values for one or more [Setting]($backend)s. The [Settings]($backend) for the current session can be accessed via the `settings` property of [IModelHost.appWorkspace]($backend).

> **Dictionary structure tips:** Prefix all setting names with the [schemaPrefix](#settings-schemas) of the schema that defines them to avoid collisions. Use forward-slash grouping (e.g., `"landscapePro/ui/"`, `"landscapePro/flora/"`) to organize related settings — prefer flat keys over deeply nested objects. Keep individual dictionary files focused on a single concern so administrators can override only what they need at a particular [SettingsPriority]($backend).

Let's load a settings dictionary that provides values for some of the LandscapePro settings:

```ts
[[include:WorkspaceExamples.AddDictionary]]
```

Now access the values via `IModelHost.appWorkspace.settings`:

```ts
[[include:WorkspaceExamples.GetSettings]]
```

Note that `getString` returns `undefined` for "landscapePro/preferredStyle" because our dictionary didn't provide a value for it. The overloads of that function (and similar functions like [Settings.getBoolean]($backend) and [Settings.getObject]($backend)) allow specifying a default value.

> Note: In general, avoid caching setting values — just query them each time you need them, because they can change at any time. If you must cache (for example, when populating a user interface), listen for the [Settings.onSettingsChanged]($backend) event.

Any number of dictionaries can be added to [Workspace.settings]($backend). Let's add another:

```ts
[[include:WorkspaceExamples.AddSecondDictionary]]
```

This dictionary adds a value for "landscapePro/flora/preferredStyle", and defines new values for two settings already defined in the previous dictionary. When we look up those settings again:

```ts
[[include:WorkspaceExamples.GetMergedSettings]]
```

"landscapePro/flora/preferredStyle" is no longer `undefined`. The value of "landscapePro/ui/defaultTool" has been overwritten. And "landscapePro/ui/availableTools" contains the merged contents of both dictionaries — because the `settingDef` has [SettingSchema.combineArray]($backend) set to `true`.

### Settings priorities

Configurations are often layered. [SettingsPriority]($backend) defines which dictionaries take precedence — the highest-priority dictionary that provides a value for a given setting name wins.

Specific values:

- [SettingsPriority.defaults]($backend) (100) — settings loaded automatically at startup.
- [SettingsPriority.application]($backend) (200) — settings supplied by the application to override or supplement defaults.
- [SettingsPriority.organization]($backend) (300) — settings applied to all iTwins in an organization.
- [SettingsPriority.iTwin]($backend) (400) — settings applied to a particular iTwin and all its iModels.
- [SettingsPriority.branch]($backend) (500) — settings applied to all branches of a particular iModel.
- [SettingsPriority.iModel]($backend) (600) — settings applied to one specific iModel.

A [SettingsDictionary]($backend) of `application` priority or lower resides in [IModelHost.appWorkspace]($backend). iTwin-scoped settings are loaded into the workspace returned by [IModelHost.getITwinWorkspace]($backend) — see [iTwin settings](#itwin-settings). Settings of even higher priority (branch and iModel) are stored in an [IModelDb.workspace]($backend) — see [iModel settings](#imodel-settings).

In practice, an organization admin can set org-wide defaults at `organization` priority. An iTwin-level admin can selectively override settings for their iTwin at `iTwin` priority without affecting other iTwins. For example, to add a dictionary at iTwin priority:

```ts
[[include:Settings.addITwinDictionary]]
```

When that iTwin's settings are no longer needed, drop the dictionary:

```ts
[[include:Settings.dropITwinDictionary]]
```

> Note: The examples above use [Settings.addDictionary]($backend), which loads dictionaries into memory for the current session only — they are **not** persisted to any container or iModel. For cloud-backed iTwin and organization settings — where dictionaries are fetched from settings containers on demand — see [Settings containers](#settings-containers) below.

What about "landscapePro/ui/availableTools"? In the LandscapePro schema, the corresponding `settingDef` has [SettingSchema.combineArray]($backend) set to `true`, meaning that when multiple dictionaries provide a value for the setting, they are merged into a single array, eliminating duplicates, and sorted in descending order by dictionary priority.

### How settings are stored

The sections below cover three progressively richer ways to work with settings:

- **Session-only (in-memory):** [Settings.addDictionary]($backend) loads a dictionary for the current session. Good for testing, app defaults, and short-lived overrides.
- **iTwin persisted:** [IModelHost.saveSettingDictionary]($backend) writes named dictionaries to the iTwin's cloud-hosted settings container. Changes persist across sessions and are shared with other users.
- **iModel persisted:** [EditTxn.saveSettingDictionary]($backend) writes named dictionaries directly into the iModel.
- **Settings container (cloud-managed storage):** A settings container stores settings as key-value pairs in a dedicated cloud container with its own versioning and access control — see [Settings containers](#settings-containers).

## iTwin settings

Each iTwin has its own workspace with its own [Settings]($backend) that can override and/or supplement the application workspace's settings. In the default iTwin-settings workflow, these settings are stored as named [SettingsDictionary]($backend)s in a single auto-discoverable cloud container tagged with `containerType: "settings"`, in its default `settings-db` [WorkspaceDb]($backend), scoped to that iTwin. Whenever [IModelHost.getITwinWorkspace]($backend) is called, all named dictionaries in that container are loaded into the returned [Workspace.settings]($backend) at [SettingsPriority.iTwin]($backend). An application working in the context of a particular iTwin should resolve setting values by asking [IModelHost.getITwinWorkspace]($backend), which will fall back to [IModelHost.appWorkspace]($backend) if the iTwin's setting dictionaries don't provide a value for the requested setting.

Before using iTwin settings, ensure two services are configured:

- [IModelHost.authorizationClient]($backend) — so the backend can acquire user tokens.
- [BlobContainer.service]($backend) — so settings containers can be discovered and opened.

With those in place, load the iTwin workspace scope:

```ts
[[include:WorkspaceExamples.GetITwinWorkspace]]
```

The returned [Workspace]($backend) gives you access to all settings and resources associated with the iTwin.

> **Important:** The workspace returned by [IModelHost.getITwinWorkspace]($backend) is caller-owned. Call `close()` on it when you are finished to release cloud connections and cached data.
>
> [IModelHost.getITwinWorkspace]($backend) is discovery-only. If no settings container exists yet, it returns an empty workspace. The first default settings container is created on first write via [IModelHost.saveSettingDictionary]($backend).

### Saving iTwin settings

To save a named settings dictionary for an iTwin, call [IModelHost.saveSettingDictionary]($backend) with a dictionary name and a [SettingsContainer]($backend) of key-value pairs:

```ts
[[include:WorkspaceExamples.SaveITwinSettings]]
```

If no settings container exists for the specified iTwin yet, [IModelHost.saveSettingDictionary]($backend) creates the default one automatically on first write. The dictionary name becomes the resource name in that container. Multiple named dictionaries can coexist in the same container.

This write path is typically used by setup/admin code. Ordinary read-only clients usually just call [IModelHost.getITwinWorkspace]($backend).

### Deleting iTwin settings

To remove an entire named dictionary, use [IModelHost.deleteSettingDictionary]($backend):

```ts
[[include:WorkspaceExamples.DeleteITwinSetting]]
```

### Reading iTwin settings

To read iTwin settings, query the `settings` of the [Workspace]($backend) returned by [IModelHost.getITwinWorkspace]($backend):

```ts
[[include:WorkspaceExamples.ReadITwinSettings]]
```

iTwin settings are loaded with [SettingsPriority.iTwin]($backend) priority.

## iModel settings

> **Note:** Storing settings directly in an iModel (via [EditTxn.saveSettingDictionary]($backend)) ties configuration to a single iModel file. Settings cannot be discovered without opening the iModel and cannot be versioned independently. For new projects, consider storing shared settings in a cloud-hosted settings container instead — it is discoverable by iTwinId, versioned independently, and does not require an iModel to be open.
>
> **Migrating older code?** Deprecated [IModelDb.saveSettingDictionary]($backend) and [IModelDb.deleteSettingDictionary]($backend) map to [EditTxn.saveSettingDictionary]($backend) and [EditTxn.deleteSettingDictionary]($backend), typically via `withEditTxn`.

Each [IModelDb]($backend) has its own [Workspace]($backend), accessible via [IModelDb.workspace]($backend). This workspace inherits app-level settings (via [IModelHost.appWorkspace]($backend)) and layers on settings stored inside the iModel itself. iTwin-level settings are not loaded automatically — see [Referencing iTwin settings from an iModel](#referencing-itwin-settings-from-an-imodel) for how to include them. Because iModel-level dictionaries are loaded at [SettingsPriority.iModel]($backend) — the highest built-in priority — they override any lower-priority setting with the same name.

Use iModel settings when a particular iModel needs configuration that differs from the rest of its iTwin, or when you want to persist metadata (like an iTwin settings container reference) inside the iModel so it is available in future sessions.

### Saving iModel settings

To save settings into an iModel, call [EditTxn.saveSettingDictionary]($backend) (via `withEditTxn`) with a dictionary name and a [SettingsContainer]($backend) of key-value pairs:

```ts
[[include:WorkspaceExamples.saveSettingDictionary]]
```

The dictionary name (e.g. `"landscapePro/iModelSettings"`) identifies the dictionary within the iModel. If a dictionary with that name already exists, it is replaced; otherwise a new one is created. You can save multiple dictionaries under different names.

Note that modifying iModel settings requires an exclusive write lock on the entire iModel (obtained automatically by `withEditTxn`) — ordinary users should never do this.

### Deleting iModel settings

To remove an entire settings dictionary from an iModel, use [EditTxn.deleteSettingDictionary]($backend) (via `withEditTxn`):

```ts
[[include:WorkspaceExamples.DeleteIModelSettingDictionary]]
```

### Reading iModel settings

Settings saved into the iModel are automatically loaded into [IModelDb.workspace]($backend). Read them the same way you read any other settings — the priority stack resolves the effective value:

```ts
[[include:WorkspaceExamples.QuerySettingDictionary]]
```

In the example above, `landscapePro/hardinessRange` was saved into the iModel, so it is returned from the iModel's dictionary. But `landscapePro/ui/defaultTool` was not saved at the iModel level, so it falls through to the app-level dictionary that defined it earlier.

### Overriding iTwin settings per iModel

Because [SettingsPriority.iModel]($backend) is higher than [SettingsPriority.iTwin]($backend), any setting saved at the iModel level takes precedence over the same setting at the iTwin level.

For example, suppose the iTwin setting `landscapePro/flora/preferredStyle` is `"naturalistic"` for the entire iTwin, but one particular iModel represents a formal garden:

```ts
[[include:WorkspaceExamples.OverrideITwinSettingAtIModelLevel]]
```

Now when the application reads `landscapePro/flora/preferredStyle` from this iModel's workspace scope, it gets `"formal"`. All other iModels in the iTwin continue to use the iTwin-level value.

### Referencing iTwin settings from an iModel

An iModel doesn't inherently know which iTwin settings container it should use. By saving the container's identity as an iModel-level setting, the iTwin settings become part of the iModel's workspace — so [IModelDb.workspace]($backend) becomes the single place to resolve all settings and resources the iModel uses.

```ts
[[include:WorkspaceExamples.SaveITwinSettingsReferenceInIModel]]
```

The next time the iModel is opened, your application reads the saved reference and passes it to the [IModelHost.getITwinWorkspace]($backend) overload that accepts [WorkspaceDbSettingsProps]($backend):

```ts
[[include:WorkspaceExamples.LoadITwinSettingsFromIModel]]
```

By default this resolves to the latest version of those settings.

### Pinning iTwin settings versions

If you need to pin the iModel to a specific version of the iTwin settings — so that its configuration does not change even when the iTwin settings are updated — save the version alongside the container props:

```ts
[[include:WorkspaceExamples.VersionAndPinITwinSettings]]
```

## Settings containers

A settings container is a cloud container tagged with `containerType: "settings"` that stores settings in its default `settings-db` [WorkspaceDb]($backend). It stores settings as a flat JSON object — [SettingName]($backend) keys mapped to [Setting]($backend) values. The default auto-discovered iTwin-settings workflow assumes one settings container per iTwin; [IModelHost.getITwinWorkspace]($backend) can discover that single container by iTwinId without needing an iModel open.

```mermaid
graph LR
    SDB["Settings container<br/>(cloud)"]
    Dict["SettingsDictionary<br/>(in-memory)"]
    Stack["Settings priority stack<br/>(iTwin workspace,<br/>appWorkspace, or<br/>IModelDb.workspace)"]

    SDB -->|"loadSettingsDictionary() → JSON"| Dict
    Dict -->|"Settings.addJson()\nat specified priority"| Stack
```

This is what distinguishes a settings container from a workspace container: a settings container is where you **start**. You load settings from a settings container, and those settings tell your application which workspace containers hold the binary resources it needs.

### How settings containers fit the priority system

When a settings container is loaded into the runtime via [Workspace.loadSettingsDictionary]($backend), its contents become **one** [SettingsDictionary]($backend) in the [Settings]($backend) priority stack. The priority is **explicitly specified** by the caller via [WorkspaceDbSettingsProps.priority]($backend) — it is not automatically derived from the container's scope.

## Advanced: managing settings containers

> Most applications do not need to manage settings containers directly — [IModelHost.getITwinWorkspace]($backend) handles discovery only, and the default iTwin settings container is created on first write via [IModelHost.saveSettingDictionary]($backend). The workflows below are for **administrators** who need fine-grained control: discovering containers, creating them explicitly, versioning, or updating individual settings.

### Discovering settings containers

You can find settings containers by using [WorkspaceEditor.queryContainers]($backend):

```ts
[[include:SettingsContainer.discoverContainers]]
```

This is useful when building an admin UI that lets users inspect or choose settings containers explicitly, without hardcoding container IDs.

If multiple settings containers exist for the same iTwin, these admin APIs can still return them — but the default convenience APIs ([IModelHost.getITwinWorkspace]($backend) and [IModelHost.saveSettingDictionary]($backend)) cannot automatically choose among them.

To open matching containers for editing in a single call, use [WorkspaceEditor.findContainers]($backend). It queries the service, requests write tokens, and opens each matching container:

```ts
[[include:SettingsContainer.findContainers]]
```

### Creating a settings container and writing settings

The example below creates a new cloud container, writes some initial settings, and publishes them:

```ts
[[include:SettingsContainer.createLocal]]
```

This is an advanced admin workflow. Only use it when you intend to manage settings containers by explicit container identity. If an iTwin already relies on the default [IModelHost.saveSettingDictionary]($backend) + [IModelHost.getITwinWorkspace]($backend) flow, creating an additional `containerType: "settings"` container for the same iTwin will disable automatic container selection for both convenience APIs.

The key steps are:

1. **Create an editor** — call [WorkspaceEditor.construct]($backend). The caller is responsible for calling `close()` when finished.
2. **Create a container** — [WorkspaceEditor.createNewCloudContainer]($backend) with `containerType: "settings"` (this must be specified explicitly; the default is `"workspace"`).
3. **Acquire the write lock** — [EditableWorkspaceContainer.acquireWriteLock]($backend). Only one user can hold the lock at a time.
4. **Open an EditableWorkspaceDb** — [EditableWorkspaceContainer.getEditableDb]($backend) returns an [EditableWorkspaceDb]($backend).
5. **Write settings** — use [EditableWorkspaceDb.updateSettingsResource]($backend) to replace all settings in the resource.
6. **Release the lock** — [EditableWorkspaceContainer.releaseWriteLock]($backend) publishes your changes. Alternatively, [EditableWorkspaceContainer.abandonChanges]($backend) discards them.

> **Important**: Always release the write lock when you are done. Failing to release it will prevent other administrators from modifying the container until the lock expires.

### Updating individual settings

Often you need to change a single setting without touching the rest. [EditableWorkspaceDb.updateSettingsResource]($backend) reads the existing settings, updates the specified entry, and writes the result back — other settings are preserved:

```ts
[[include:SettingsContainer.updateSetting]]
```

To remove a setting entirely, use [EditableWorkspaceDb.removeString]($backend).

To inspect all settings in a container, use [WorkspaceDb.getString]($backend):

```ts
[[include:SettingsContainer.getSettings]]
```

### Versioning

Like all [WorkspaceDb]($backend)s, each settings container uses [semantic versioning](https://semver.org/). Once a version is published to cloud storage it becomes immutable. To evolve settings, create a new version via [EditableWorkspaceContainer.createNewWorkspaceDbVersion]($backend), make changes, and release the write lock. The versioning workflow is the same as described in [creating workspace resources](./Workspace.md#creating-workspace-resources).
