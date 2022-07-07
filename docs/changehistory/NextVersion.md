---
publish: false
---
# NextVersion

Table of contents:

- [Display system](#display-system)
  - [Dynamic schedule scripts](#dynamic-schedule-scripts)
  - [Hiliting models and subcategories](#hiliting-models-and-subcategories)
- [Frontend category APIs](#frontend-category-apis)
- [AppUi](#appui)
  - [Auto-hiding floating widgets](#auto-hiding-floating-widgets)
  - [Tool Settings title](tool-settings-title)
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

### Hiliting models and subcategories

Support for hiliting models and subcategories using [HiliteSet]($frontend) has been promoted from `@beta` to `@public`. This allows applications to toggle hiliting of all elements belonging to a set of [Model]($backend)s and/or [SubCategory]($backend)'s. This feature can work in one of two modes, specified by [HiliteSet.modelSubCategoryMode]($frontend):
- Union - an element will be hilited if either its model or its subcategory is hilited; or
- Intersection - an element will be hilited if both its model and its subcategory are hilited.

Applications often work with [Category]($backend)'s instead of subcategories. You can use the new [Categories API](#frontend-category-apis) to obtain the Ids of the subcategories belonging to one or more categories.

## Frontend category APIs

A [Category]($backend) provides a way to organize groups of [GeometricElement]($backend)s. Each category contains at least one [SubCategory]($backend) which defines the appearance of geometry belonging to that subcategory. This information is important for frontend code - for example, the display system needs access to subcategory appearances so that it can draw elements correctly, and applications may want to [hilite subcategories](#hiliting-models-and-subcategories) in a [Viewport]($frontend).

[IModelConnection.categories]($frontend) now provides access to APIs for querying this information. The information is cached upon retrieval so that repeated requests need not query the backend.
- [IModelConnection.Categories.getCategoryInfo]($frontend) provides the Ids and appearance properties of all subcategories belonging to one or more categories.
- [IModelConnection.Categories.getSubCategoryInfo]($frontend) provides the appearance properties of one or more subcategories belonging to a specific category.

## AppUi

### Auto-hiding floating widgets

When a widget is in floating state, it will not automatically hide when the rest of the UI auto-hides. To create a widget that will automatically hide with the in-viewport tool widgets, set the prop hideWithUiWhenFloating to true in the AbstractWidgetProps in your UiProvider.

### Tool Settings title

By default, when the Tool Settings widget is floating, the title will read "Tool Settings". A new setting in UiFramework will use the name of the active tool as the title, instead. To use this feature, call
```ts
  UiFramework.setUseToolAsToolSettingsLabel(true) when your app starts.
```

## Deprecations

### @itwin/core-bentley

The AuthStatus enum has been removed. This enum has fallen out of use since the authorization refactor in 3.0.0, and is no longer a member of [BentleyError]($core-bentley).

The beta functions [Element.collectPredecessorIds]($core-backend) and [Element.getPredecessorIds]($core-backend) have been deprecated and replaced with [Element.collectReferenceIds]($core-backend) and [Element.getReferenceIds]($core-backend), since the term "predecessor" has been inaccurate since 3.2.0, when the transformer became capable of handling cyclic references and not just references to elements that were inserted before itself (predecessors).

### @itwin/core-mobile

IOSApp, IOSAppOpts, and AndroidApp have been removed in favor of [MobileApp]($core-mobile) and [MobileAppOpts]($core-mobile). Developers were previously discouraged from making direct use of [MobileApp]($core-mobile), which was a base class of the two platform specific mobile apps. This distinction has been removed, as the implementation of the two apps was the same. IOSAppOpts, now [MobileAppOpts]($core-mobile), is an extension of [NativeAppOpts]($core-frontend) with the added condition that an [AuthorizationClient]($core-common) is never provided.

IOSHost, IOSHostOpts, AndroidHost, and AndroidHostOpts have been removed in favor of [MobileHost]($core-mobile) for the same reasons described above.


