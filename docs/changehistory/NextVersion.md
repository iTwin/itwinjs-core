---
publish: false
---
# NextVersion

## ChangesetIndex vs. ChangesetId

A changeset represents the delta (i.e. the "set of changes") between two points on an iModel's timeline. It can be identified by two means: a [ChangesetId]($common) and a [ChangesetIndex]($common) - every changeset has both once it has been pushed to iModelHub. A `ChangesetId` is a string that is formed from the checksum of the contents of the changeset and its parent `ChangesetId`. A `ChangesetIndex` is a small sequential integer representing the position of the changeset on the iModel's timeline. Later changesets will always have a larger `ChangesetIndex` than earlier changesets. However, it is not possible to compare two `ChangesetId`s and tell anything about their relative position on the timeline.

Much of the `iTwin.js` api that refers to changesets takes a `ChangesetId` as an argument. That is unfortunate, since `ChangesetIndex` is often required to determine order of changesets. Obtaining the `ChangesetIndex` from a `ChangesetId` requires a round-trip to iModelHub. This version begins the process of reworking the api to prefer `ChangesetIndex` as the identifier for changesets. However, for backwards compatibility, the new types [ChangesetIndexAndId]($common) (both values are known) and [ChangesetIdWithIndex]($common) (Id is known, index may be undefined) are used many places. Ultimately only `ChangesetIndex` will be used to identify changesets, and you should prefer it in any new api that identifies changesets.
