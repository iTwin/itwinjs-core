---
publish: false
---
# NextVersion

## Frame timing statistics

Timing statistics for each rendered frame of a viewport can be collected using the `enableFrameStatsCallback` method of [Viewport]($frontend) like this:

```
// Note: vp should be an instance of Viewport
vp.enableFrameStatsCallback((frameStats: FrameStats) => {
  // This callback function will be called whenever a frame finishes rendering.
  // The frameStats object will contain timing details about the frame.
});
```

To disable the collection of timing statistics, pass `undefined` into the `enableFrameStatsCallback` method.
