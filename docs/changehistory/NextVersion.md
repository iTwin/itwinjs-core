---
publish: false
---
# NextVersion
## Optimization of geometry in IModelImporter

The geometry produced by [connectors](https://www.itwinjs.org/learning/imodel-connectors/) and [transformation workflows](../learning/transformer/index.md) is not always ideal. One common issue is a proliferation of [GeometryPart]($backend)s to which only one reference exists. In most cases, it would be more efficient to embed the part's geometry directly into the referencing element's [geometry stream](https://www.itwinjs.org/learning/common/geometrystream/).

[IModelImporter.optimizeGeometry]($transformer) has been introduced to enable this kind of optimization. It takes an [OptimizeGeometryOptions]($transformer) object specifying which optimizations to apply, and applies them to all of the 3d geometry in the iModel. Currently, only the optimization described above is supported, but more are expected to be added in the future.

If you are using [IModelImporter]($transformer) directly, you can call `optimizeGeometry` directly. Typically you would want to do so as a post-processing step. It's simple:

```ts
  // Import all of your geometry, then:
  importer.optimizeGeometry({ inlineUniqueGeometryParts: true });
```

If you are using [IModelTransformer]($transformer), you can configure automatic geometry optimization via [IModelTransformOptions.optimizeGeometry]($transformer). If this property is defined, then [IModelTransformer.processAll]($transformer) and [IModelTransformer.processChanges]($transformer) will apply the specified optimizations after the transformation process completes. For example:

```ts
  const options = { inlineUniqueGeometryParts: true };
  const transformer = new IModelTransformer(sourceIModel, targetIModel, options);
  transformer.processAll();
```
