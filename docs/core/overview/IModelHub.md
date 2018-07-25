# iModelHub - The Backbone for iModelJs Applications

[iModelHub](http:/www.iModelHub.com) is a cloud service for managing and coordinating access to [iModels](./iModels).

Like [Git](https://git-scm.com/) repositories for source code, in the iModel ecosystem copies of iModels are distributed widely in [Briefcases](../learning/backend/Briefcases). In fact, iModelHub's primary purpose is *not* to hold or process copies of iModels (it does so only to facilitate Briefcase checkout.) Rather, iModelHub's main role is to maintain the sequence of [ChangeSets](../learning/backend/ChangeSets) that forms an iModel's [Timeline](#the-timeline-of-changes-to-an-imodel). Like and accounting system does for financial transactions, iModelHub holds a ledger of all changes to an iModel.

iModelHub accepts ChangeSets from iModelJs [backends](../learning/backend/index) through a process called [*Check In*](#upload-changesets), and sends them to other validated users when requested through a process called [*Synchronization*](#download-changesets). iModelJs applications determine when and how to Check In and Synchronize.

## The Connection between iModelJs and iModelHub

1. Every iModel has an [identity](./iModels#every-imodel-has-a-guid) registered in iModelHub.
2. Users log into iModelHub for authentication.
3. iModelJs backends have an identity, registered with iModelHub.
4. iModel owners decide, via iModelHub, which users and which applications have access to their iModels.

When an iModelJs backend opens an iModel, it is first required to verify with iModelHub that the iModel's owner has granted the right for the current user and application to access the briefcase. In this manner owners can maintain control over who-does-what with their iModels, even if someone receives an unauthorized copy<sup>1</sup>.

> This means that applications written using iModelJs require a valid project on iModelHub.

## The Timeline of Changes to an iModel

iModelHub holds an immutable ledger of all changes to an iModel. Similar to an accounting system for financial data, the ledger can provide a reliable record of what-happened-when and by whom.
Since the ledger is reliable, immutable and append-only (i.e. it is not possible to *revise history*), it forms a timeline that can be referenced externally as an authoritative record of the state-of-the-iModel
as of a given point in time. In this manner, iModelHub provides the means to *sign the timeline* rather than create external (and potentially forgeable) snapshots for archival or reference.

## Named Versions

Every ChangeSet on the timeline creates a *new version* of the iModel. However, some points on the timeline can represent important milestones or significant events to be saved (e.g. for a design review.)
iModelHub provides a way to mark a point on the timeline with a name. These timepoints are referred to as **Named Versions**. Since a specific action must be taken to create them, they are treated specially by
iModelHub with caching to make them faster to access.

## Locks and Codes

iModels are meant to be distributed widely in the form of Briefcases, and each Briefcase may be edited independently. However, certain actions among the distributed Briefcases are best coordinated to avoid
conflicting changes. iModelHub provides services for acquiring [locks and codes](../learning/backend/ConcurrencyControl) for this purpose.

## Creating a new iModel in iModelHub

When an iModel is first created, it is uploaded to iModelHub, assigned a Guid, associated with a connected context, and its timeline is initialized.
iModelHub provides tools to configure access to the iModel by users and applications. As new users and agents connect to iModelHub to access the iModel, they are each assigned
briefcases with a unique Id.

## Uploading and Download ChangeSets

A local Briefcase holds the state of an iModel as of a given point in time, plus changes made locally, if any. To receive changes made by others, users *synchronizes* their Briefcase from iModelHub.
Any ChangeSets pushed to iModelHub by other users are downloaded and merged into the local Briefcase.

To permanently save your changes, you upload them in the form of a ChangeSet to iModelHub. You must always synchronize your Briefcase with iModelHub before you can upload changes.
iModelHub enforces that ChangeSets it accepts must always be *based on* (i.e. synchronized with) the most recent ChangeSet. This is what establishes the linear timeline of changes.

## iModelHub Notifications

Applications can register listeners for notifications from iModelHub. It is possible therefore to create Agents that react to every ChangeSet, performing validation, tracking, synchronization with external systems, etc. Since each Agent works on a local Briefcase synchronized with ChangeSets, each can be deployed independently and the system is infinitely scalable.

---

1. iModelJs does what it can to enforce security for iModels. It makes no guarantee that a determined hacker won't be able to defeat any barriers iModelJs imposes.