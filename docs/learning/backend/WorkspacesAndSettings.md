# Workspaces and Settings

Two recurring run-time needs in non-trivial iTwin.js applications are **configuration** (which tools are available, what units to use, which data sources are active) and **resources** (binary assets like fonts, textures, and templates). iTwin.js provides two complementary systems to address these needs:

- **[Settings]($backend)** — a priority-ordered stack of key-value configuration pairs. Configuration flows from cloud-hosted settings containers into the active [Settings]($backend) runtime, where values can be read by name.
- **[Workspace resources](./Workspace.md)** — versioned binary assets stored in [WorkspaceDb]($backend) containers. Settings tell the application *which* `WorkspaceDb`s to load; the application then retrieves resources from them.

These two systems are deliberately separate. If everything were stored in workspace containers, there would be no way to know which container to open first. Settings containers solve this bootstrapping problem — they are loaded first and tell the application which workspace containers to open.

At runtime, settings and resources are accessed through one of three workspace scopes:

| Workspace | Scope | Access |
|---|---|---|
| [IModelHost.appWorkspace]($backend) | Application-wide defaults and configuration | Available immediately after [IModelHost.startup]($backend) |
| [IModelHost.getITwinWorkspace]($backend) | iTwin-scoped settings shared across all iModels in an iTwin; falls back to `appWorkspace` | Requires an iTwinId; discovers/loads settings only; no iModel needed |
| [IModelDb.workspace]($backend) | iModel-specific overrides; falls back to `appWorkspace` for unresolved settings. Does **not** automatically include iTwin-scoped settings | Available when an iModel is open |

All three scopes use the same [Settings priority stack](./Settings.md#settings-priorities) — iTwin-level and iModel-level settings both override application defaults. `getITwinWorkspace` is independent from `IModelDb.workspace` — its settings are only available to an iModel if explicitly referenced (see [Referencing iTwin settings from an iModel](./Settings.md#referencing-itwin-settings-from-an-imodel)). `getITwinWorkspace` is also discovery-only: the first default iTwin settings container is created on first write via [IModelHost.saveSettingDictionary]($backend), not on read. See [Choosing the right workspace](./Workspace.md#choosing-the-right-workspace) for guidance on when to use each scope.

## Scope and priority

Settings from multiple sources are merged using a priority stack. A higher-priority dictionary overrides a lower-priority one for any given setting name.

In practice:
- **Organization-wide defaults** are stored in a settings container and loaded at [SettingsPriority.iTwin]($backend) (400).
- **iModel-specific overrides** are loaded at [SettingsPriority.iModel]($backend) (600) — iModel wins over iTwin.
- **Application defaults** are loaded at [SettingsPriority.application]($backend) (200) — overrideable by any cloud-backed settings.

> The full priority stack also includes a separate [SettingsPriority.organization]($backend) (300) level — see [Settings priorities](./Settings.md#settings-priorities) for the complete list.

## Recommended reading order

> **Prefer hands-on learning?** Start with the [tutorial](./WorkspaceTutorial.md) — it introduces each concept as the code demands it, then come back here for reference.

1. **This overview** — understand the two systems and three workspace scopes.
2. **[Settings](./Settings.md)** — how to define settings schemas, load dictionaries, read values, and create/manage settings containers in the cloud.
3. **[Workspace resources](./Workspace.md)** — how to create, version, and access binary resources stored in [WorkspaceDb]($backend) containers.
4. **[Tutorial: Configuring an iTwin Application](./WorkspaceTutorial.md)** — a hands-on walkthrough that builds a complete application configuration end-to-end.
