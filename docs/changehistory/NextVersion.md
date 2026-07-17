---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Electron 43 support](#electron-43-support)
  - [@itwin/core-backend](#itwincore-backend)
    - [ChangesetReader.setBatchSize](#changesetreadersetbatchsize)
  - [@itwin/core-geometry](#itwincore-geometry)
    - [Region Boolean improvements](#region-boolean-improvements)

## Electron 43 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 43](https://www.electronjs.org/blog/electron-43-0).

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

## @itwin/core-geometry

### Region Boolean improvements

[RegionBooleanXYOptions]($core-geometry) has three new options to control input and output of [RegionOps.regionBooleanXY]($core-geometry):
| Option name | Type | Default Value | Description |
|---|---|---|---|
| `simplifyUnion` | boolean | `false` | Whether to post-process the result to remove extraneous interior edges |
| `operationGroupA` | [RegionBinaryOpType]($core-geometry) | `RegionBinaryOpType.Union` | Operation to apply to the regions of the first input argument |
| `operationGroupB` | [RegionBinaryOpType]($core-geometry) | `RegionBinaryOpType.Union` | Operation to apply to the regions of the second input argument |

#### RegionBooleanXYOptions.simplifyUnion

The previous/default behavior of `RegionOps.regionBooleanXY` results in `UnionRegion`s with algorithmically inserted bridge edges removed, but with other interior edges remaining. Passing `simplifyUnion: true` not only removes interior edges but also returns the simplest region type.

For example, consider the union of four trapezoids to form a "picture frame". The following call produces a (rather naive!) `UnionRegion` in which the four input `Loop`s survive as children, and the hole is only implied:
```ts
const result = RegionOps.regionBooleanXY([t0, t1, t2, t3], undefined, RegionBinaryOpType.Union);
```
![Default Union](./assets/picture-frame-default.jpg "Default Boolean union results in a UnionRegion")

When we utilize the new option, the result is a `ParityRegion`. This simpler output not only lacks extraneous interior edges, but also explicitly captures the outer and hole `Loop`s as children:
```ts
const result = RegionOps.regionBooleanXY([t0, t1, t2, t3], undefined, RegionBinaryOpType.Union, { simplifyUnion: true });
```
![Simplified Union](./assets/picture-frame-simplified.jpg "Simplified Boolean union results in a ParityRegion")

#### RegionBooleanXYOptions.operationGroupA/B

The previous/default behavior of `RegionOps.regionBooleanXY` assumes an implicit union of the regions in each input group. With these new options, you can now specify intersection and parity operations to be performed on the regions in each group, before the main Boolean operation is performed on the groups.

So for example, to subtract the intersection of a 4-loop (green) Venn diagram's inner region from an outer (red) loop, you would previously have to call this method 4 times to perform 3 pairwise Boolean intersections among the Venn loops, followed by a Boolean difference. This code computes the result all in one go:
```ts
const result = RegionOps.regionBooleanXY([v0, v1, v2, v3], outer, RegionBinaryOpType.Parity, { simplifyUnion: true, operationGroupA: RegionBinaryOpType.Intersection });
```
![Venn Input Loops](./assets/venn-loops.jpg "Green Venn loops, red outer loop")![Venn Output Region](./assets/venn-boolean-in-one-go.jpg "Venn intersection subtracted from outer loop")

Note: The equivalent region can be obtained with `RegionBinaryOpType.BMinusA` instead of `RegionBinaryOpType.Parity`. To perform only the 4-way intersection, pass `undefined` for the second input group.