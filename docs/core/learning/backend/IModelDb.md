# Accessing local Briefcases via the IModelDb class

The [IModelDb]($backend) class class provides methods for opening, closing, and accessing a [briefcase](../Glossary.md#briefcase) (i.e. a local copy of an iModel.) An instance of IModelDb in memory holds a briefcase file open.

An IModelDb is used by a service or by the backend of an iModel.js app.

Use [IModelDb.open]($backend) to obtain and open an IModelDb from iModelHub.

> When acquiring a briefcase this way ([SyncMode.PullAndPush]($backend) and [AccessMode.Exclusive]($backend)), [ExclusiveAccessOption.TryReuseOpenBriefcase]($backend) should be specified when possible. See [briefcase id](../imodelhub/briefcases.md#briefcase-id).

Use [IModelDb.close]($backend) to close the local briefcase.

Note that an [AccessToken](../common/AccessToken.md) is an argument to IModelDb.open.

> Normally, a backend opens an IModelDb at the request of a user who has an AccessToken.