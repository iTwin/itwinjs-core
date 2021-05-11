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

## Upgrading schemas in an iModel

Every now and then the schemas in the iModel may become incompatible with newer versions of the software. In these cases it may be recommended, and sometimes even mandatory to upgrade the schemas in the iModel before it can be opened. Note that whether an upgrade is mandatory may depend on if the model is to be opened ReadOnly or ReadWrite - the requirements for the latter are more stringent.

There are two kinds of schemas that typically get upgraded:

- [Domain schemas](../../bis/intro/schemas-domains) - the ECSchema-s that define the information for specific [Domains](../../bis/intro/glossary/#domain)
- *Profile schemas* - the Schemas of database tables that are either not mapped to domain schemas, or are otherwise used to store meta-data about the mapping of database tables to domain schemas.

The iTwin.js API provides for a way to validate (check compatibility) and upgrade all the schemas in the iModel. To upgrade -

- Download a local copy of the iModel as a briefcase with [BriefcaseManager.downloadBriefcase]($backend)
- Call [BriefcaseDb.validateSchemas]($backend) to validate the schemas in the iModel.
- Call [BriefcaseDb.upgradeSchemas]($backend) to upgrade schemas - the upgrade process involves the following steps first for the profile upgrade, and then for the domain schema upgrade:
  - acquiring a schema lock to avoid concurrent schema changes by different users
  - opening the local briefcase
  - making the necessary schema changes to the briefcase
  - capturing these schema changes (if any) as a ChangeSet and pushing it to iModel Hub
  - releasing the schema lock
  - closing the local briefcase
