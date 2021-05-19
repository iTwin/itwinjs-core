---
publish: false
---
# NextVersion

## Promoted APIs

The following formerly `alpha` or `beta` APIs have been promoted to `public`. Public APIs are guaranteed to remain stable for the duration of the current major version of the package.

### [@bentley/bentleyjs-core](https://www.itwinjs.org/reference/bentleyjs-core/)

### [@bentley/imodeljs-common](https://www.itwinjs.org/reference/imodeljs-common/)

* [RenderSchedule]($common) for defining scripts to visualize changes in an iModel over time.
* [DisplayStyleSettings.renderTimeline]($common) for associating a [RenderTimeline]($backend) with a [DisplayStyle]($backend).
* [DisplayStyleSettings.timePoint]($common) for specifying the currently-simulated point along a view's [RenderSchedule.Script]($common).
* [ElementGraphicsRequestProps]($common) for generating [RenderGraphic]($frontend)s from [GeometricElement]($backend)s or arbitrary geometry streams.

### [@bentley/imodeljs-frontend](https://www.itwinjs.org/reference/imodeljs-frontend/)

### [@bentley/imodeljs-backend](https://www.itwinjs.org/reference/imodeljs-backend/)

