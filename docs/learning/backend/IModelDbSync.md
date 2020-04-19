# Synchronizing with an iModel

As a local [briefcase](../Glossary.md#briefcase), a [BriefcaseDb]($backend) represents a version of an iModel. Briefcases are synchronized via [ChangeSets](../Glossary.md#changeset). Use [BriefcaseDb.pullAndMergeChanges]($backend) to update a local BriefcaseDb to incorporate recent changes made by other users. This will [pull](../Glossary.md#pull) all of the new ChangeSets and [merge](../Glossary.md#merge) them into the briefcase file. If there are any local changes, they will be rebased on top of the changes from merged ChangeSets.

See [Concurrency Control](./ConcurrencyControl.md) for more on read-write workflows.
