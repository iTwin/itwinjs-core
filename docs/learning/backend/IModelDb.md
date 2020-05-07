# Opening an iModel via the IModelDb class

## Opening a local *briefcase* of an iModel managed my iModelHub

The [BriefcaseManager]($backend) class provides a method to download a [briefcase](../Glossary.md#briefcase) (i.e. a local copy of an iModel.).
Once downloaded, the [BriefcaseDb]($backend) class provides methods for opening, closing, and accessing the briefcase. An instance of BriefcaseDb in memory holds a briefcase file open.

An IModelDb is used by a service or by the backend of an iModel.js app.

Use [BriefcaseManager.download]($backend) to download the briefcase, and [BriefcaseDb.open]($backend) to open the briefcase.

> When acquiring a briefcase this way ([SyncMode.PullAndPush]($common) should be specified when possible. See [briefcase id](../imodelhub/briefcases.md#briefcase-id).

Use [BriefcaseDb.close]($backend) to close the local briefcase.

Note that an [AccessToken](../common/AccessToken.md) is an argument to IModelDb.open.

> Normally, a backend opens an IModelDb at the request of a user who has an AccessToken.

## Opening a *snapshot* iModel

The [SnapshotDb]($backend) class also provides methods for opening, closing, and accessing a *snapshot* iModel.
A *snapshot* iModel is a file that is disconnected from iModelHub and therefore does not have a change timeline.
Once created, a *snapshot* iModel is read-only and cannot be changed.
This makes *snapshot* iModels ideal for archival or data transfer purposes.

Use [SnapshotDb.openFile]($backend) to open an existing *snapshot* iModel.

Use [SnapshotDb.close]($backend) to close the *snapshot* iModel.
