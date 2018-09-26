# Writing to iModels using IModelDb

An IModelDb also serves as a staging area where a [backend](../Glossary.md#backend) can change the content of an iModel and then submit the changes to iModelHub.

A backend can make the following kinds of changes:
* [Create or update Elements](./CreateElements.md)
* [Create or update Models](./CreateModels.md)
* [Reserve Codes](./ReserveCodes.md)

Use [IModelDb.saveChanges]($backend) to commit changes locally. [IModelDb.txns]($backend) manages local transactions, it supports local undo/redo.

## Pushing changes to iModelHub
Use [IModelDb.pushChanges]($backend) to push local changes to iModelHub as a changeset, so that others can see them. After a changeset is pushed to iModelHub, it becomes part of the iModel's permanent timeline. This method automatically [pulls and merges](./IModelDbSync.md) new ChangeSets from iModelHub.

> Only a single application can push to iModelHub at a time. IModelDb.pushChanges automatically retries push on appropriate failures. However, it is possible that all retry attempts fail, if there are a lot of other applications pushing at the same time. In that case, push should be attempted again later.

An app that modifies models, elements, or codes must use [ConcurrencyControl](./ConcurrencyControl.md) to coordinate with other users.