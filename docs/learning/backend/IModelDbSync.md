# Synchronizing with an iModel

As a local [briefcase](../Glossary.md#briefcase), an [IModelDb]($backend) represents a version of an iModel. Briefcases are synchronized via [ChangeSets](../Glossary.md#changeset). Use [IModelDb.pullAndMergeChanges]($backend) to update a local IModelDb to incorporate recent changes made by other users.

See [Concurrency Control](./ConcurrencyControl.md) for more on read-write workflows.
