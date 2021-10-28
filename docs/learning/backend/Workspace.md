# Workspaces in iTwin.js

When an iTwin.js backend starts, [IModelHost.startup]($core-backend) creates an instance of a [Workspace]($core-backend), in [IModelHost.workspace]($core-backend).

`IModelHost.workspace` customizes the session according to the "wishes" of the:
 1. host application(s)
 2. organization of the user
 3. current iTwin
 4. current iModel
 5. current "activity" being performed

In the list above, later entries tend to change more frequently and, in the case of conflicting wishes, later entries "override" the earlier ones.

`IModelHost.workspace` expresses the state of the session in two forms:
  1. [Settings]($core-backend)
  2. [WorkspaceContainers]($core-backend)

`Settings` are *named parameters* that an application defines and whose values are specified at runtime. `WorkspaceContainers` hold "resources" (i.e. data) that the application uses. `Settings` and `WorkspaceContainers` are often related in application logic, e.g.:
 - a Setting may contain the "formula" to find a resource
 - a `WorkspaceContainer` may hold a

## WorkspaceContainers

## Settings