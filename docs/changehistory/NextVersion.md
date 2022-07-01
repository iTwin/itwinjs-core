---
publish: false
---
# NextVersion

Table of contents:

- [Display system](#display-system)
  - [Dynamic schedule scripts](#dynamic-schedule-scripts)
- [Deprecations](#deprecations)

## Display system

### Dynamic schedule scripts

[Timeline animation](../learning/display/TimelineAnimation.md) enables the visualization of change within an iModel over a period of time. This can be a valuable tool for, among other things, animating the contents of a viewport to show the progress of an asset through the phases of its construction. However, one constraint has always limited the utility of this feature: the instructions for animating the view were required to be stored on a persistent element - either a [DisplayStyle]($backend) or a [RenderTimeline]($backend) - in the [IModel]($common).

That constraint has now been lifted. This makes it possible to create and apply ad-hoc animations entirely on the frontend. For now, support for this capability must be enabled when calling [IModelApp.startup]($frontend) by setting [TileAdmin.Props.enableFrontendScheduleScripts]($frontend) to `true`, as in this example:

```ts
   await IModelApp.startup({
     tileAdmin: {
      enableFrontendScheduleScripts: true,
    },
  });
```

Then, you can create a new schedule script using [RenderSchedule.ScriptBuilder]($common) or [RenderSchedule.Script.fromJSON]($common) and apply it by assigning to [DisplayStyleState.scheduleScript]($frontend). For example, given a JSON representation of the script:

```ts
  function updateScheduleScript(viewport: Viewport, props: RenderSchedule.ScriptProps): void {
    viewport.displayStyle.scheduleScript = RenderSchedule.Script.fromJSON(props);
  }
```

## Deprecations

### @itwin/core-bentley

The AuthStatus enum has been removed. This enum has fallen out of use since the authorization refactor in 3.0.0, and is no longer a member of [BentleyError]($core-bentley).

The beta functions [Element.collectPredecessorIds]($core-backend) and [Element.getPredecessorIds]($core-backend) have been deprecated and replaced with [Element.collectReferenceIds]($core-backend) and [Element.getReferenceIds]($core-backend), since the term "predecessor" has been inaccurate since 3.2.0, when the transformer became capable of handling cyclic references and not just references to elements that were inserted before itself (predecessors).

### @itwin/core-mobile

IOSApp, IOSAppOpts, and AndroidApp have been removed in favor of [MobileApp]($core-mobile) and [MobileAppOpts]($core-mobile). Developers were previously discouraged from making direct use of [MobileApp]($core-mobile), which was a base class of the two platform specific mobile apps. This distinction has been removed, as the implementation of the two apps was the same. IOSAppOpts, now [MobileAppOpts]($core-mobile), is an extension of [NativeAppOpts]($core-frontend) with the added condition that an [AuthorizationClient]($core-common) is never provided.

IOSHost, IOSHostOpts, AndroidHost, and AndroidHostOpts have been removed in favor of [MobileHost]($core-mobile) for the same reasons described above.
