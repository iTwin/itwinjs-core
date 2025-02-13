# IModelConnection

The frontend of an app does not open an iModel directly. Instead, it "connects" to an [IModelDb]($backend) that is managed by a [backend](../backend/index.md) through an
[IModelConnection]($frontend). `IModelConnection` is an abstract class that encapsulates the `IModelDb` on the frontend.

Various subclasses of [IModelConnection]($frontend) are used depending on the type of connection:

- [CheckpointConnection]($frontend)
- [BriefcaseConnection]($frontend)
- [SnapshotConnection]($frontend)
- [BlankConnection](./BlankConnection.md)

[CheckpointConnection]($frontend) is used to create a **readonly** connection to a Checkpoint of an iModel. A `CheckpointConnection` is initiated via [CheckpointConnection.openRemote]($frontend).

If the current process is a browser frontend, the connection will be to a remote backend using RPC. In that case, due to the nature of RPC requests, the backend servicing this connection may be servicing many simultaneous frontends, and may even change over time.

If the current process is connected to a private backend over IPC (e.g. on a desktop via Electron), the connection will be to an IModelDb of a Checkpoint from that private backend.

The primary difference between a CheckpointConnection using RPC vs. IPC is the lifetime of the [IModelDb]($backend) on the backend. For RPC, only the first client causes the IModelDb to be opened, and [CheckpointConnection.close](($frontend)) is ignored (because there can be
more than one client). For IPC, every call to [CheckpointConnection.openRemote](($frontend)) attempts to open the IModelDb and [CheckpointConnection.close]($frontend)
closes it.

Obviously (because Checkpoints are immutable) `CheckpointConnection`s only allow readonly access.

A [SnapshotConnection]($frontend) can be used for readonly connections to a Snapshot iModel. It uses RPC, so may be used from web or native applications.

A [BriefcaseConnection]($frontend) may be used to connect to an editable [BriefcaseDb]($backend). A `BriefcaseConnection` connects to a *dedicated* backend through [Ipc](../IpcInterface.md). That means to create a `BriefcaseConnection`, the backend must have an active [IpcHost]($backend) and the frontend must have an active [IpcApp]($frontend). This will be true for [NativeApp]($frontend)s, the various `MobileApp`s, and `WebEditApps`.

You can create a [BlankConnection](./BlankConnection.md) to show Views from sources other than an iModel.
