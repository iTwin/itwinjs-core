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
* [Domain schemas](../bis/intro/schemas-domains) - the ECSchema-s that define the information for specific [Domains](../bis/intro/glossary/#domain)
* *Profile schemas* - the Schemas of database tables that are either not mapped to domain schemas, or are otherwise used to store meta-data about the mapping of database tables to domain schemas.

The iModel.js API provides for a way to validate (check compatibility) and upgrade all the schemas in the iModel. The methods below can be used with local copies of the iModel:
* Use [BriefcaseDb.validateSchemas]($backend) and [BriefcaseDb.upgradeSchemas]($backend) to validate and upgrade schemas in briefcases - the upgrade process involves acquiring schema locks to avoid concurrent schema changes by different users. (Use [BriefcaseManager.downloadBriefcase]($backend) to download the briefcase to be validated/upgraded)
* Use [StandaloneDb.validateSchemas]($backend) and [StandaloneDb.upgradeSchemas]($backend) to validate and upgrade schemas in standalone files. In this case there is neither a need to acquire schema locks, nor to push changes to the iModel Hub.
