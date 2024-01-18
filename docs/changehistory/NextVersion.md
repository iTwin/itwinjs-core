---
publish: false
---
# NextVersion

1. Fail pull/merge/push when conflict handler detect data conflicts

## Fail pull/merge/push when conflict handler detect data conflicts

`BriefcaseDb.pushChanges()` will fail with following error, if their was data conflict detected.

> _`UPDATE/DELETE before value do not match with one in db or CASCADE action was triggered`_

### What is data conflict?

Data conflict come in two flavours,

1. Dirty reads happen when current briefcase modify a element that is also modified by another briefcase and both try to push their changes. The first one will succeed and second one will fail. This happen as second briefcase will fail to apply incoming changeset as old value of modified incoming element does not match the current value for that element in local briefcase.
2. Parent row has been deleted in incoming changeset while current briefcase created child rows for same element. This may result in `CASCADE DELETE` on current briefcase deleting data created locally. But same child rows also part of txn which will be pushed to hub with no parent rows and thus fail to apply on any other briefcase.

Generally this will be prevented by locks that is required when changing elements. But locks are client side safety mechanism and can fail or bypassed resulting in merge conflicts. Previously such conflict were suppress and were allowed to be pushed to hub that then could not be applied by a some other briefcase.

What to do when `BriefcaseDb.pushChanges()` fails?
As of now their is no good recourse other then abandoning local changes and doing `BriefcaseDb.pullChanges()`. But this current change will prevent iModel to become unusable for other users. In future a more robust merge will be provided to let local briefcase resolve such issues or decided what do when fatal conflicts happens during merge.
