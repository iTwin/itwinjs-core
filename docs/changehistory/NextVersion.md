---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [ChangesetReader.setBatchSize](#changesetreadersetbatchsize)

## @itwin/core-backend

### ChangesetReader.setBatchSize

[ChangesetReader]($backend) now exposes a `setBatchSize(n: number)` method that controls how many change rows are cached in the reader. It is a performance improvement parameter that can be tweaked as per user's choice. Increasing the batch size increases the number of rows read at once and cached in the reader, thereby improving throughput when iterating large changesets but it also increases memory consumption; decreasing it reduces peak memory use. The method must be called before the first [ChangesetReader.step]($backend) call.

Default batch sizes (unchanged behaviour when `setBatchSize` is not called):

| Active configuration | Default |
|---|---|
| `propFilter: InstanceKey` | 100 |
| `propFilter: BisCoreElement` | 20 |
| `propFilter: All`, `abbreviateBlobs: false` | 5 |
| `propFilter: All` (blobs abbreviated or unset) | 10 |

```ts
using reader = ChangesetReader.openFile({ db, fileName: changeset.pathname });
reader.setBatchSize(10);
while (reader.step()) { /* ... */ }
```

**Performance improvement with new caching behaviour in ChangesetReader`**:

| Cache type | Inserts | Before (s) | After (s) | Improvement |
|---|---|---|---|---|
| InMemoryCache | 1,000 | 0.220 | 0.204 | 7.3% |
| InMemoryCache | 10,000 | 2.213 | 1.402 | 36.6% |
| SqliteBackedCache | 1,000 | 0.399 | 0.207 | 48.1% |
| SqliteBackedCache | 10,000 | 3.342 | 1.981 | 40.7% |