# Tutorial: Configuring an iTwin Application with Settings and Workspace Resources

This tutorial walks through configuring a realistic iTwin.js application — **LandscapePro**, a landscape design tool — from scratch. By the end, you'll understand how settings, workspace resources, and the priority system work together.

> **Looking for reference documentation?** This tutorial tells the story end-to-end. For detailed reference on individual APIs, see [Settings](./Settings.md) and [Workspace resources](./Workspace.md). For how the pieces relate, see the [overview](./WorkspacesAndSettings.md).

## What LandscapePro needs

LandscapePro lets users decorate a landscape with trees, shrubs, and other flora. To function, the application needs two kinds of data at run-time:

- **Configuration** — which tools are available, what foliage style to use, which [USDA hardiness zone](https://en.wikipedia.org/wiki/Hardiness_zone) limits apply.
- **Resources** — the actual tree definitions (species, hardiness ranges, light requirements) stored as versioned data in the cloud.

Settings handle the first need. [WorkspaceDb]($backend) containers handle the second. Let's build both, step by step.

## Step 1: Define a settings schema

Every setting in iTwin.js belongs to a [SettingGroupSchema]($backend). The schema describes what settings exist, their types, and how they validate. LandscapePro defines five settings — preferred foliage style, available tools, the default tool, a list of tree databases, and a hardiness range:

```ts
[[include:WorkspaceExamples.SettingGroupSchema]]
```

A few things to notice:

- All setting names share the `"landscapePro"` prefix, keeping them isolated from other applications.
- The `"flora/treeDbs"` setting `extends` a built-in type (`"itwin/core/workspace/workspaceDbList"`) — this is how settings will later point to workspace resources.
- The `"hardinessZone"` type is defined once in `typeDefs` and reused by the `"hardinessRange"` setting's `minimum` and `maximum` properties via `extends`.
- The `"ui/availableTools"` setting has `combineArray: true`, which means multiple dictionaries can each contribute tools and they'll be merged together.

Register the schema shortly after startup so the runtime can validate settings on access:

```ts
[[include:WorkspaceExamples.RegisterSchema]]
```

## Step 2: Load settings at startup

Settings values come from [SettingsDictionary]($backend)s. Let's load one that provides defaults for LandscapePro:

```ts
[[include:WorkspaceExamples.AddDictionary]]
```

Now read the values back:

```ts
[[include:WorkspaceExamples.GetSettings]]
```

`preferredStyle` is `undefined` because our dictionary didn't provide a value for it. The second overload (`getString("...", "default")`) lets you supply a fallback.

> **Tip:** Avoid caching setting values — query them each time you need them, because they can change when a higher-priority dictionary is loaded. If you must cache, listen for the [Settings.onSettingsChanged]($backend) event.

## Step 3: Override settings with a second dictionary

Real applications layer settings from multiple sources. Let's add a second dictionary at a higher priority:

```ts
[[include:WorkspaceExamples.AddSecondDictionary]]
```

The second dictionary is loaded at [SettingsPriority.application]($backend) (200), which is higher than the first dictionary's [SettingsPriority.defaults]($backend) (100). When we read the settings now:

```ts
[[include:WorkspaceExamples.GetMergedSettings]]
```

- `defaultTool` changed from `"place-shrub"` to `"place-koi-pond"` — the higher-priority dictionary wins.
- `preferredStyle` is now `"coniferous"` — the second dictionary filled in the gap.
- `availableTools` contains tools from **both** dictionaries — because `combineArray` is `true` in the schema, arrays are merged rather than replaced.

This is the **settings priority stack** at work. The full priority order, from lowest to highest:

| Priority | Level | Typical use |
|----------|-------|-------------|
| 100 | [SettingsPriority.defaults]($backend) | Settings loaded at startup |
| 200 | [SettingsPriority.application]($backend) | App-supplied overrides |
| 300 | [SettingsPriority.organization]($backend) | Org-wide configuration |
| 400 | [SettingsPriority.iTwin]($backend) | Per-iTwin configuration |
| 500 | [SettingsPriority.branch]($backend) | Per-branch overrides |
| 600 | [SettingsPriority.iModel]($backend) | Per-iModel overrides |

## Step 4: Persist settings to an iTwin

So far, our settings live only in memory. For production, administrators persist settings to the cloud so they're shared across sessions and users. This is typically done by a setup/admin flow: LandscapePro can save settings scoped to an iTwin, and any session that opens the iTwin workspace then sees the same configuration:

```ts
[[include:WorkspaceExamples.SaveLandscapeProToITwin]]
```

[IModelHost.saveSettingDictionary]($backend) writes the dictionary to a cloud-hosted settings container associated with the iTwin. If no default settings container exists yet, this first write creates it. [IModelHost.getITwinWorkspace]($backend) is the read/discovery side only — it loads the iTwin workspace and returns an empty workspace if nothing has been written yet. To read the settings back, open the iTwin workspace:

```ts
[[include:WorkspaceExamples.ReadLandscapeProFromITwin]]
```

The returned [Workspace]($backend) includes the iTwin's settings merged with application defaults. Always call `close()` when finished to release cloud connections.

To delete a saved dictionary, call [IModelHost.deleteSettingDictionary]($backend) with the iTwin ID and dictionary name.

## Step 5: Create workspace resources (tree databases)

Settings tell the application *what to do*. Workspace resources provide the *data to do it with*. LandscapePro needs tree definitions — species, hardiness ranges, light requirements. These are stored in versioned [WorkspaceDb]($backend) containers.

Every `WorkspaceDb` lives inside a [WorkspaceContainer]($backend). Let's create a container and its default database for dogwood trees (*Cornus*):

```ts
[[include:WorkspaceExamples.CreateWorkspaceDb]]
```

Now define what a "tree" resource looks like and add some species. `WorkspaceDb`s use [semantic versioning](https://semver.org/) — each published version is immutable. The process is: acquire the write lock → create a version → add resources → close → release the lock (which publishes):

```ts
[[include:WorkspaceExamples.AddTrees]]
```

Later, we discover a species we forgot. We create a patch version (1.0.1) and a second container for fir trees (*Abies*):

```ts
[[include:WorkspaceExamples.CreatePatch]]
```

We now have two containers: `cornus` at version 1.0.1 (with three dogwood species) and `abies` at version 1.0.0 (with two fir species).

## Step 6: Connect settings to resources

Here's where the two systems come together. We save a setting that tells LandscapePro *which* tree databases to load — pointing the `"landscapePro/flora/treeDbs"` setting at our two `WorkspaceDb` containers:

```ts
[[include:WorkspaceExamples.SaveTreeDbsToITwin]]
```

Because this setting is stored at the iTwin scope, every iModel in the iTwin resolves the same tree databases.

## Step 7: Query resources at runtime

With the setting in place, application code can resolve the tree databases and query them. Here's a function that finds every tree suitable for a given hardiness zone:

```ts
[[include:WorkspaceExamples.getAvailableTrees]]
```

The key call is [Workspace.getWorkspaceDbs]($backend) — it reads the setting, opens the referenced `WorkspaceDb`s, and returns them. Then [Workspace.queryResources]($backend) iterates resources across all databases by name pattern.

## Step 8: Update resource versions

When you publish a new version of a tree `WorkspaceDb`, update the iTwin setting so all iModels pick up the change:

```ts
[[include:WorkspaceExamples.UpdateTreeDbVersionAtITwin]]
```

Here we explicitly reference version `1.1.1` of the cornus database. If we had omitted the `version` property, it would default to the latest available version. Use explicit versions when you need **deterministic, reproducible** behavior — for example, in regulated workflows.

## Step 9: Save settings into an iModel

Sometimes one iModel needs configuration that differs from the rest of its iTwin. Save settings directly into the iModel using [EditTxn.saveSettingDictionary]($backend):

```ts
[[include:WorkspaceExamples.saveSettingDictionary]]
```

These settings are loaded at [SettingsPriority.iModel]($backend) (600) — the highest built-in priority — so they override everything below them. They persist across sessions and are automatically reloaded when the iModel is opened:

```ts
[[include:WorkspaceExamples.QuerySettingDictionary]]
```

The hardiness range comes from the iModel dictionary. The default tool falls through to the app-level dictionary — the priority stack resolves the right value at each level.

## Step 10: Override iTwin settings per iModel

Because iModel priority (600) is higher than iTwin priority (400), you can override any iTwin setting for a specific iModel. For example, if the iTwin says `"naturalistic"` but one iModel represents a formal garden:

```ts
[[include:WorkspaceExamples.OverrideITwinSettingAtIModelLevel]]
```

All other iModels in the iTwin continue using the iTwin-level value.

## Step 11: Reference iTwin settings from an iModel

An iModel doesn't automatically inherit iTwin settings — [IModelDb.workspace]($backend) falls back to [IModelHost.appWorkspace]($backend), not to the iTwin workspace. To bridge them, save a reference to the iTwin settings container inside the iModel:

```ts
[[include:WorkspaceExamples.SaveITwinSettingsReferenceInIModel]]
```

Because the reference has no `version` constraint, the iModel always uses the latest available version of the iTwin settings. This is usually what you want — updates to the iTwin's configuration automatically apply to all its iModels.

### Pinning to a specific version

Sometimes you need reproducibility — a regulatory submission or a client deliverable that must use exactly the settings it was designed with. To pin the iModel to the current version of the iTwin settings, resolve each settings [WorkspaceDb]($backend) and record its exact version:

```ts
[[include:WorkspaceExamples.VersionAndPinITwinSettings]]
```

The key difference is the `version` field. A floating reference (no version) follows the latest; a pinned reference (exact version like `"1.0.0"`) locks the iModel to that snapshot. To unpin later, save the reference again without a version.

## What we built

Starting from nothing, we:

1. **Defined a schema** — described what settings LandscapePro uses and how they validate.
2. **Loaded settings** — provided defaults and overrides using the priority stack.
3. **Persisted settings to an iTwin** — so every iModel shares the same configuration.
4. **Created workspace resources** — versioned tree databases in the cloud.
5. **Connected the two** — settings point to workspace databases; the application resolves them at runtime.
6. **Customized per iModel** — overrode specific settings for one iModel without affecting others.
7. **Pinned versions** — locked an iModel to a specific settings snapshot for reproducibility.

## Next steps

- **[Settings reference](./Settings.md)** — schemas, validation, the full priority system, settings containers, admin workflows.
- **[Workspace resources reference](./Workspace.md)** — WorkspaceDb structure, resource types (string, blob, file), container access control.
- **[Overview](./WorkspacesAndSettings.md)** — how settings, workspace resources, and the three workspace scopes relate.
