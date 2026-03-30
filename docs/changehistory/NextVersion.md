---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [iTwin settings workspace](#itwin-settings-workspace)
      - [New APIs](#new-apis)
      - [Usage examples](#usage-examples)
      - [Configuration requirements](#configuration-requirements)

## @itwin/core-backend

### iTwin settings workspace

*Applications* can now store and load named settings dictionaries in an iTwin-scoped workspace, separate from iModel-level settings so the same values can be shared across iModels in that iTwin.

Under the hood, that workspace uses a [SettingsDb]($backend), which is a settings-formatted [WorkspaceDb]($backend) named `settings-db`. In that db, each string resource is one settings dictionary:

- Resource name: dictionary name
- Resource value: JSON dictionary content

Developers still read and write settings dictionaries by name, while container management, versioning, and cloud sync follow the standard workspace model.


#### New APIs

- [EditableWorkspaceContainer.withEditableDb]($backend): Acquire a write lock, get or create an editable tip WorkspaceDb, run an operation, then close and release. Automatically creates a new prerelease version if the tip is already published.
- [IModelHost.getITwinWorkspace]($backend): Load an iTwin-level workspace with all named settings dictionaries.
- [IModelHost.saveSettingDictionary]($backend) and [IModelHost.deleteSettingDictionary]($backend): Save and remove named settings dictionaries in the iTwin's settings container.

These methods read and write dictionaries in the underlying [SettingsDb]($backend). The dictionary name becomes the resource name, allowing multiple independent dictionaries to coexist in the same container. This mirrors the existing [IModelDb.saveSettingDictionary]($backend) / [IModelDb.deleteSettingDictionary]($backend) pattern.

#### Usage examples

Save a settings dictionary to an iTwin:

[[include:WorkspaceExamples.SaveITwinSettings]]

Read it back:

[[include:WorkspaceExamples.GetITwinWorkspace]]

Delete it:

[[include:WorkspaceExamples.DeleteITwinSetting]]

#### Configuration requirements

To use iTwin-scoped settings dictionaries, configure [IModelHost.authorizationClient]($backend) and [BlobContainer.service]($backend) so the backend can query and update the iTwin settings workspace container.

See the [Workspace documentation]($docs/learning/backend/Workspace.md) for full details.
