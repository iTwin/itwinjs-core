# Briefcases

[Briefcases](../Glossary.md#briefcase) are local copies of iModel that users can *acquire* to work with the iModel. Users can make changes to their copy of iModel and then [*push*](../Glossary.md#briefcase) them as a single [Changeset](../Glossary.md#changeset) file into iModelHub.

## Changesets

![Briefcase synchronization](./sync.gif)

Briefcases synchronize their changes through changesets. Changesets form a linear [timeline](./index.md#the-timeline-of-changes-to-an-imodel) of iModel changes. To do this, changesets have to be in a strict order and must be *based on* a single parent changeSet.

### ChangesetId

A ChangesetId is a 40 value that is used to validate changesets. A ChangesetId is generated from the ChangesetId of its parent as well as a hash of its contents. Since ChangesetIds are essentially random strings of numbers, they are not useful for determining changeset sequences.

### ChangesetIndex

Once a changeset is pushed to iModelHub it is stored on a timeline

## BriefcaseId

Each Briefcase has a unique 24 bit integer id. BriefcaseId is stored in a briefcase file after download, and is used to identify where changes have occurred.

- Every ElementId contains the BriefcaseId from which it was created.
- Every Changeset has the BriefcaseId of the Briefcase that pushed it.
- [Locks](../backend/ConcurrencyControl.md) are associated with BriefcaseIds on the server.

> Since BriefcaseIds are limited, it is recommended to reuse briefcases instead of acquiring new ones. There are limits how many Briefcases a single user can acquire per minute/total to prevent users accidentally acquiring too many Briefcases.

## Working with briefcases

To work with Briefcases, [BriefcaseDb]($backend) methods should be used instead of calling iModelHub API directly:

- [Acquiring and opening a briefcase](../backend/IModelDb.md)
- [Pulling changes](../backend/IModelDbSync.md)
- [Creating and pushing changes](../backend/IModelDbReadwrite.md)
