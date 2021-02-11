# IModelConnection

The frontend of an app does not open an iModel directly. Instead, it "connects" to an [IModelDb]($backend) that is managed by a [backend](../backend/index.md) through an
[IModelConnection]($frontend). `IModelConnection` is an abstract class that encapsulates the `IModelDb` on the frontend.

Various subclasses of [IModelConnection]($frontend) are used depending on the type of connection:

- [CheckpointConnection]($frontend)
- [BriefcaseConnection]($frontend)
- [SnapshotConnection]($frontend)
- [BlankConnection](./BlankConnection.md)

[CheckpointConnection]($frontend) is used for **readonly** web frontends connected over HTTP to Checkpoint iModels opened by cloud-based backends. A `CheckpointConnection` is initiated via the static [CheckpointConnection.openRemote]($frontend) method. Due to the stateless nature of HTTP connections, it is important to understand that the backend servicing calls to a `CheckpointConnection` can change during a session, and requests may be directed to more than one backend at the same time. For this reason, `CheckpointConnection`s may only use Checkpoint iModels, so identical copies of the checkpoint will be found on all equivalent backends.

A [SnapshotConnection]($frontend) can be used for readonly connections to a Snapshot iModel. It uses RPC, so may be used from web or native applications.

A [BriefcaseConnection]($frontend) may be used to connect to an editable [BriefcaseDb]($backend). A `BriefcaseConnection` connects to a *dedicated* backend through [Ipc](../IpcInterface.md). That means to create a `BriefcaseConnection`, the backend must have an active [IpcHost]($backend) and the frontend must have an active [IpcApp]($frontend). This will be true for [NativeApp]($frontend)s, the various `MobileApp`s, and `WebEditApps`.

You can create a [BlankConnection](./BlankConnection.md) to show Views from sources other than an iModel.
