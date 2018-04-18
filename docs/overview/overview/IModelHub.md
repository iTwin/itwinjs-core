# iModelHub - The Backbone for iModelJs Applications

[iModelHub](https:/www.iModelHub.com) is a cloud service for managing and coordinating access to [iModels](./iModels).

Like [Git](https://git-scm.com/) repositories for source code, in the iModel ecosystem copies of iModels are distributed widely in [Briefcases](../learning/backend/Briefcases). In fact, iModelHub's primary purpose is **not** to hold or process copies of iModels (it does so only to facilitate Briefcase checkout.) Rather, iModelHub's main role is to maintain the sequence of [ChangeSets](../learning/backend/ChangeSets) that forms an iModel's [Timeline](#the-timeline-of-changes). It accepts validated ChangeSets from iModelJs [backends](../learning/backend/index) through a process called [*Check In*](#upload-changesets), and sends them to other validated users when requested through a process called [*Synchronization*](#download-changesets). iModelJs applications determine when and how to Check In and Synchronize.

## The Connection between iModelJs and iModelHub

1. Every iModel has an [identity](iModels#every-imodel-has-a-guid) registered in iModelHub.
2. Users log into iModelHub for authentication.
3. iModelJs backends have an identity registered with iModelHub.
4. iModel owners decide which users and which applications have access to their iModels.

When an iModelJs backend opens an iModel, it is first required to verify with iModelHub that the iModel's owner has granted the right for the current user and application to access his data. In this manner owners can maintain control over who-does-what with their iModels, even if someone receives an unauthorized copy<sup>1</sup>.

## The Timeline of Changes

## Named Versions

## Locks and Codes

## Creating a new iModel in iModelHub

## Connecting to iModelHub

## Download ChangeSets

## Upload ChangeSets

## iModelHub Notifications

---

1. iModelJs does what it can to enforce security for iModels. It makes no guarantee that a determined hacker won't be able to defeat any barriers iModelJs imposes.