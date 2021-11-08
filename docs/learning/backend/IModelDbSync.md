# Synchronizing with an iModel

A [BriefcaseDb]($backend) is a local file that represents a version of an iModel. Briefcases are synchronized via [Changesets](../Glossary.md#changeset). Use [BriefcaseDb.pullChanges]($backend) to update a local BriefcaseDb to incorporate recent changes made by other users. This will [pull](../Glossary.md#pull) all of the new Changesets and [merge](../Glossary.md#merge) them into the briefcase file. If there are any local changes, they are merged with the incoming changes.
