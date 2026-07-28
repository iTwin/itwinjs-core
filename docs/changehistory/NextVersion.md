---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Cloud container lifecycle changes](#cloud-container-lifecycle-changes)

## @itwin/core-backend

### Cloud container lifecycle changes

Two cloud container leaks were fixed ([#5017](https://github.com/iTwin/itwinjs-core/issues/5017)): [IModelDb.close]($backend) now closes the iModel's ViewStore, and [IModelHost.shutdown]($backend) now disconnects all V2 checkpoint containers.

Additionally, a connected [CloudSqlite.CloudContainer]($backend) now keeps the process alive until it is disconnected. Previously such a process would exit anyway, silently leaking the connection. If your application hangs at exit after this change, it is leaking a connected container (e.g. a checkpoint, workspace, or ViewStore) - call [IModelHost.shutdown]($backend) before exiting.
