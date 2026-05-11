# Pull merge & conflict resolution

> NOTE This document is work in progress and Rebase API are **experimental**.

## What is change merging?

Change merging is when a briefcase pulls new changes from the iModel Hub and applies them locally. If the user has any local changes, the incoming changes need to be merged with the local changes. In this document, we are currently strictly talking about low-level SQLite changesets and high-level concepts defined in ECSchemas.

## What is change conflicts

Git is used for text and text is two-dimensional data. Conflicts in two-dimensional data happen when two users change overlapping ranges of text. In a database, an overlapping change can be a change to the same row identified by a primary key. However, it could be more complex as that row might have database constraints like unique index, check, foreign key, triggers, etc., that make this row part of a larger chunk of information. SQLite tracks changes to individual tables/rows. It is up to the application to make changes consistently so as not to violate database constraints. If the database only contains a single table with no constraints, then it's basically the same as a text file as long as there is a primary key.

SQLite records changes by recording INSERT/UPDATE/DELETE operations with old and new values into a binary changeset. The order of changes in the changeset is arbitrary, but once the whole changeset is applied, it should bring the database to a new state that is consistent with all specified database constraints.

Things get interesting when there are local changes specifically to the same data as the incoming changeset. This operation is called pull-merge. Doing that can result in conflicts which from the SQLite perspective is as follows.

|  | Operation | Conflict description                                                   | Type         |
|--|-----------|------------------------------------------------------------------------|--------------|
|  | `INSERT`  | 1. PRIMARY KEY already exists                                          | `Conflict`   |
|  |           | 2. Database constraint violation e.g. UNIQUE, CHECK                    | `Constraint` |
|  | `DELETE`  | 1. PRIMARY KEY does not exist                                          | `NotFound`   |
|  |           | 2. PRIMARY KEY does exist but other fields values does not match       | `Data`       |
|  |           | 3. Database constraint violation e.g. UNIQUE, CHECK caused by update   | `Constraint` |
|  | `UPDATE`  | 1. PRIMARY KEY does not exist                                          | `NotFound`   |
|  |           | 2. PRIMARY KEY exist but data fields values does not match             | `Data`       |
|  |           | 3. Database constraint violation e.g. UNIQUE, CHECK caused by update   | `Constraint` |
|  | -         | Foreign key violations. It is not for given row but for whole changeset | `ForeignKey` |

Above conflict can be resolved in on of the followed allowed ways. A `REPLACE` resolution may cause `CONSTRAINT` conflict afterword if db constrain are voilated by `REPLACE` action. If `CONSTRAINT` conflict is skipped then it can cause `ForeignKey` voliation at the end of changeset apply.

|  | Operation | Conflict     | Skip                        | Replace                                   | Abort   | Default   |
|--|-----------|--------------|-----------------------------|-------------------------------------------|---------|-----------|
|  | `INSERT`  | `Conflict`   | Allowed                     | Allowed but may cause constraint conflict | Allowed | `ABORT`   |
|  |           | `Constraint` | Allowed. Change is ignored. | n/a                                       | Allowed | `SKIP`    |
|  | `DELETE`  | `NotFound`   | Allowed                     | n/a                                       | Allowed | `ABORT`   |
|  |           | `Data`       | Allowed                     | Allowed but may cause constraint conflict | Allowed | `REPLACE` |
|  |           | `Constraint` | Allowed. Change is ignored. | n/a                                       | Allowed | `SKIP`    |
|  | `UPDATE`  | `NotFound`   | Allowed                     | n/a                                       | Allowed | `ABORT`   |
|  |           | `Data`       | Allowed                     | Allowed but may cause constraint conflict | Allowed | `REPLACE` |
|  |           | `Constraint` | Allowed. Change is ignored. | n/a                                       | Allowed | `SKIP`    |
|  | -         | `ForeignKey` | n/a                         | n/a                                       | Allowed | `ABORT`   |

> Note even ForeignKey can be skipped but this will cause db integrity check to fail or any change to db in future may fail.

The foreign key one is the only one that is not associated with a specific row/table as it is a count of FK left unresolved and is a fatal error pointing to an error in application logic.

When SQLite applies a changeset and detects a conflict, it will call the conflict handler and request application feedback on how to resolve it. For the above, we can generally choose `SKIP`, `REPLACE`, or `ABORT`. If we choose `REPLACE`, in some cases, our conflict handler may be called again if replacing the local row causes another conflict due to database constraints. We are looking at one row at a time, but these rows do not exist in isolation. They are connected to the rest of the rows in the same table via constraints, to the table definition via CHECK constraints, or to other tables via foreign keys. This makes change merging in the database a bit more complex.

## Types of change merging methods

Now that we have a somewhat understanding of key concepts about change merging and conflicts, we can talk about how to merge conflicting changes.

itwinjs supports three types of change merging:

1. **Merge**: pull new changes & apply these changes on top of local changes (Removed/unsupported)
2. **Rebase**: pull new changes, rollback local changes, apply new changes, and then apply local changes. (Its default)
3. **Fast-forward**: attempt to apply incomming changes and if it fail then try rebasing.

Note: Since a briefcase as of now use locks to serialize changes between two or more users. The two methods specified does not really make any difference. The locks ensure only one user can change a given element and thus we do not expect low level sqlite conflict for any directly changed data.

### "Merge" method

Merge is simple and straightforward but not flexible and can easily cause the creation of a changeset that might look fine at the local file level but fail when applied to a new file.

It is done as follows:

1. Briefcase pulls new changes.
2. It applies new changes on top of local changes.
   * It depends on locks for changes to be non-conflicting.
   * This method does not record the effect of applying incoming changes. This locally recorded changeset is an unreliable source of truth without locking.
3. If a conflict happens, there is not much we can do except for either skipping the incoming change or replacing the local change. There is no room for actually merging.
4. Conflict resolution is recorded in a rebase buffer, so when pulling more changes, the same resolution will be applied.
   * This is also dangerous because let's say we choose REPLACE for a DATA conflict. And then change that row later in the session. When we push changes, the local change to the row will be ignored.
5. Finally, when all changes are merged, we can push the changes, but without a lock, this could create a changeset that cannot be applied by others.

As we can see from the above, this merge method works fine if you lock individual rows in a table so only one user can change it. This workflow cannot really scale, and without a lock, it is completely useless.

## "Rebase" method

This is a new method that has been implemented that is way more flexible. It is similar to git rebase. It is simple and easy to understand and will never lead to the push of a changeset that cannot be applied without locks.

1. Briefcase pulls new changes.
2. Briefcase local changes are rolled back, so now it's the same as a point in history on the master timeline.
3. New changes from the master are applied and advance local head to the master. No conflicts are expected as we simply update the local briefcase to the master.
4. Local changes from oldest to newest are now applied on top of the master. *Note that the current disk file represents the master and the changeset been applied is the local change made by the user.*
5. This can cause conflicts as we replay local changes on top of the new master tip.
   * With rebase, we have flexibility that we can change data beside simple choices of `SKIP`, `REPLACE`, & `ABORT`.
   * If the application finds a conflict that requires creating new changes or merging incoming and local changes, then it can do so.
   * It also has a 3-way view of what changed. The local changeset been applied has old/new values while the current value in the db represents the master.
   * The whole merge activity is recorded in the changeset, and the local changeset is updated after merging. In other words, the local change is recomputed against the master.
   * Any tool that made those changes can also react to rebase event and update there change against what is new on master.
6. If at any point the rebase fails, it can be resumed. The db is unable to push unstable changes until it resolves it locally first.
7. Finally user can still undo his local changes. Or there undo stack is preserved. They can also push out there changes if needed.

As one of the most important take away in rebase is application control of merge. It has tools that made those changes and can correct redo them over master if needed. Where as "Merge" method is one way and does not give application any control over merge.

## Rebase API workflow

At the moment only one set of changes does not require locks and we will use that as example. Its local properties of briefcase. Currently two user can change them and it can cause conflicts.

We download and open two briefcases for the same iModel, then set a property on b1 and push the changes. Note that the property being set did not exist, so it causes an INSERT operation at the database level.

```ts
  const b1 = ...
  const b2 = ...

  // save a property
  b1.saveFileProperty({ namespace: "test", name: "test" }, "foo");
  b1.saveChanges();
  await b1.pushChanges({ description: "set test to foo" });
```

Now b2 does the same and sets a different value, which also causes an INSERT operation being recorded.

```ts
  b2.saveFileProperty({ namespace: "test", name: "test" }, "goo");
  b2.saveChanges();

  // following will throw exception with error
  // `PRIMARY KEY INSERT CONFLICT - rejecting this changeset`
  await b2.pushChanges({ description: "set test to goo" });
```

Above threw exception as after undoing local changes then applying incoming changes we now have an entry for the key `test` in the db. While locally we recorded an insert operation for the `test` property. This causes a primary key violation. This action leaves the database in rebase mode.

Next, we will install a conflict handler to resolve this issue. This conflict handler concatenates the master value with the local.

```ts
  b2.txns.changeMergeManager.addConflictHandler({
    id: "my", handler: (args: RebaseChangesetConflictArgs) => {
      if (args.cause === DbConflictCause.Conflict) {
        if (args.tableName === "be_Prop") {
          if (args.opcode === DbOpcode.Insert) {
            const localChangedVal = args.getValueText(5, DbChangeStage.New);
            const tipValue = b2.queryFilePropertyString({ namespace: "test", name: "test" });
            b2.saveFileProperty({ namespace: "test", name: "test" }, `${tipValue} + ${localChangedVal}`);
            return DbConflictResolution.Skip; // skip incomming value and continue
          }
        }
      }
      return undefined;
    }
  });
```

We resume rebase and it will resolve the conflict, allowing us to push the changes.

```ts
  // resume rebase see if it resolve the conflict
  b2.txns.changeMergeManager.resume();
  await b2.pushChanges({ description: "set test to goo" });
```

The final value of test pushed will be `foo + goo`.
