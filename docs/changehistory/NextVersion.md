---
publish: false
---
# NextVersion

Table of contents:

- [Data conflict rejection](#data-conflict-rejection)

## Data conflict rejection

When multiple [Briefcase]($backend)s contribute changesets to an iModel, conflicts can arise. For example:

1. Briefcases A and B both modify element X locally.
2. Briefcase A pushes its changes to iModelHub.
3. Briefcase B pulls Briefcase A's changes and attempts to merge them and push its own changes to iModelHub.

The conflict occurs in step 3. These kinds of conflicts are typically prevented through the use of [client-side locking](https://www.itwinjs.org/learning/backend/concurrencycontrol/). But in the absence of locking, the merge would appear to succeed, and Briefcase B would be permitted to push its changes to iModelHub. When any briefcase subsequently tried to download and merge those changes, the merge would fail, rendering the iModel unusable from that point onward.

Now, the conflict will be detected before Briefcase B can push its changes, producing the error "UPDATE/DELETE before value do not match with one in db or CASCADE action was triggered". Briefcase B will have no recourse in this case but to abandon its local changes. In the future, we plan to introduce a mechanism for resolving such conflicts without abandoning changes. In the meanwhile, use of locking is strongly encouraged.
