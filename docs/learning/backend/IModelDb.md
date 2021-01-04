# Opening an iModel via the IModelDb class

## Opening a local *briefcase* of an iModel managed by iModelHub

The [BriefcaseManager]($backend) class provides a method to download a [briefcase](../Glossary.md#briefcase) (i.e. a local copy of an iModel.).
Once downloaded, the [BriefcaseDb]($backend) class provides methods for opening, closing, and accessing the briefcase. An instance of BriefcaseDb in memory holds a briefcase file open.

Use [BriefcaseManager.downloadBriefcase]($backend) to download a briefcase, and [BriefcaseDb.open]($backend) to open the downloaded briefcase.

Use [BriefcaseDb.close]($backend) to close the local briefcase.

Note that an [AccessToken](../common/AccessToken.md) is an argument to BriefcaseDb.open.


## Opening a *snapshot* iModel

The [SnapshotDb]($backend) class also provides methods for opening, closing, and accessing a *snapshot* iModel.
A *snapshot* iModel is a file that is disconnected from iModelHub and therefore does not have a change timeline.
Once created, a *snapshot* iModel is read-only and cannot be changed.
This makes *snapshot* iModels ideal for archival or data transfer purposes.

Use [SnapshotDb.openFile]($backend) to open an existing *snapshot* iModel.

Use [SnapshotDb.close]($backend) to close the *snapshot* iModel.
