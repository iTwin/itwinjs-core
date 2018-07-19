# Using Views in iModelJs

A *View* renders geometry from one or more [Models]($docs/bis/intro/model-fundamentals) of an iModel in a web browser. iModelJs applications
can embed and interact with Views anywhere on a web page via an `HTMLCanvas` element.

Multiple Views may be simultaneously visible on the same web page, and are coordinated via the [ViewManager]($frontend) class.

## ViewDefinition Elements

A *View* is saved in an iModel as an element of the [ViewDefinition]($backend) class. ViewDefinitions hold all the information necessary to show the same content across sessions.
This includes the camera position, the model(s) displayed, the CategorySelector, the DisplayStyle to use, plus any additional view-specific settings.

## The ViewState Class

The `ViewDefinition` classes (in fact all [Element]($backend) classes) exist only on the backend, because their purpose is to read and write those elements to/from the iModel.
On the frontend, access to the elements needed to display views is provided by the [ElementState]($frontend) classes. The ElementState classes only hold the *state* of elements, not
the methods to read and write elements from the database.

Views are opened by loading a ViewDefinition into a [ViewState]($frontend) object. They begin showing the content as it was saved in the iModel, but users may
modify what they're seeing using [Viewing tools](#viewing-tools). These changes are only temporary (in-memory) unless they are saved back to the iModel
via [IModelDb.Elements.updateElement]($backend).

An instance of a `ViewState` in memory holds references to several other objects, including a [CategorySelectorState]($frontend), a [DisplayStyle3dState]($frontend),
and a [ModelSelectorState]($frontend) (for `SpatialViews`). Since each of these objects must be loaded in the frontend asynchronously, there is an
async method called [IModelConnection.Views.load]($frontend) that returns a promise when the `ViewState` and all other State objects required to display a
View are ready. The [Viewport]($frontend) class expects loaded ViewState objects.

## Types of ViewDefinitions

There are subclasses of `ViewDefinition` to show different types of Models in various ways.

Here are several significant subclasses:

* `ViewDefinition`
  * `SpatialViewDefinition` - shows a view of one or more 3d SpatialModels
  * `DrawingViewDefinition` - shows a view of a single 2d DrawingModel
  * `SheetViewDefinition` - shows a view of a single 2d SheetModel

For each subclass of `xxxViewDefinition`, there is a corresponding `xxxViewState` class in the frontend.

## Loading Views from an iModel

There is a method called [IModelConnection.Views.getViewList]($frontend) that returns an array of [IModelConnection.ViewSpec]($frontend)s in a convenient
format for User Interfaces. This can be used to present a list of possible views by name in a List.

For example:

``` ts
[[include:IModelConnection.Views.getViewList]]
```

Once a view is selected from the list, it may be loaded with:

``` ts
[[include:IModelConnection.Views.load]]
```

> Note that in the examples above, `getSpatialViews` and `loadOneView` are `async`, and you must `await` them.

## Using Viewports

`ViewState` objects hold the state of a `ViewDefinition` (*what* is shown in a View) in the frontend.

To connect a ViewState to a rectangular region on a web page, you create instances of the [Viewport]($frontend) class. The constructor of Viewport takes an `HTMLCanvasElement` and a
(fully loaded) ViewState. In this manner, Viewports form the connection between a rectangular region on your web page and a set of
Element and Models in the iModel, a display [Frustum]($common), a DisplayStyle, and the iModelJs rendering system.

> Note: before creating a Viewport, be sure to call [IModelApp.startup]($frontend).

## ViewManager

The Viewport class is responsible for displaying a View, as defined by its ViewState. However, typically the objective of showing a View is to allow users
to modify the View itself, or to interact with its contents.

To facilitate that, we need to connect the event system of the browser with Viewports via [IModelApp.viewManager]($frontend).

``` ts
[[include:ViewManager.addViewport]]
```

After the viewport is added to the [ViewManager]($frontend), all HTML events for its canvas are directed to the active `Tool` class by the [ToolAdmin]($frontend).

If there is more than one Viewport visible, the ViewManager keeps track of the *Selected Viewport* and treats it specially.

## Viewing Tools

The iModelJs library supplies controls that allow users to modify what is shown in Views via the [ViewTool]($frontend) classes. You can create instances of the
supplied classes (e.g. [WindowAreaTool]($frontend), [FitViewTool]($frontend), [ViewWalkTool]($frontend), [RotateTool]($frontend), etc.) or create your own subclasses for
special viewing operations.

## DisplayStyles

DisplayStyles describe the *styling* that should be applied to the contents of a View.

This includes the :
  * [ViewFlags]($common)
  * [SubCategoryAppearance]($common) visibility and overrides
  * Background color
  * [RenderMode]($common)
  * [Environment]($frontend)
  * [Light]($common)s
  * Other view-specific parameters

They are loaded in memory in the frontend with the [DisplayStyleState]($frontend) class.

DisplayStyles can be named and shared among many ViewDefinitions.

## ModelSelectors

ModelSelectors apply only to SpatialViews. They determine the set of [SpatialModel]($backend)s that are displayed. The Geometry for elements in SpatialModels are always
stored in the iModel's Spatial Coordinate System. They are loaded in memory in the frontend with the [ModelSelectorState]($frontend) class.

Since each 2d Model has its own coordinate system, 2d Views always only show a single Model and therefore don't use ModelSelectors.

ModelSelectors can be named and shared among many ViewDefinitions.

## CategorySelectors

A [CategorySelectorState]($frontend) determines the set of [Category]($backend) that are displayed in a View. They are loaded in memory in the frontend with the [CategorySelectorState]($frontend) class.

CategorySelectors can be named and shared among many ViewDefinitions.

## Auxiliary Coordinate Systems

Views may reference an [AuxCoordSystemState]($frontend) to display coordinate data and distances in different units and orientations.

Auxiliary Coordinate Systems can be named and shared among many ViewDefinitions.

## Reality Data

Reality Data (e.g. [ContextCapture](https://www.bentley.com/en/products/brands/contextcapture) models, Point Cloud models, Maps, etc.) are stored external to iModels, and are accessed via Reality Data Servers. However, in an iModel
you can create `RealityDataModel`s that hold the URL of the Reality Data.

These models are subclasses of [SpatialModel]($backend), and can therefore be included in a `ModelSelector` and can easily be made visible in any SpatialView.

## View Thumbnails

Every view may have a thumbnail that shows an approximation of what it contains. This can be helpful for user interfaces that offer a choice of Views.

## ViewState Parameters

 This is what the parameters to the camera methods, and the values stored by [ViewDefinition3d]($backend) mean.

 ```cmd
                 v-- {origin}
            -----+-------------------------------------- -   [back plane]
            ^\   .                                    /  ^
            | \  .                                   /   |        P
          d |  \ .                                  /    |        o
          e |   \.         {targetPoint}           /     |        s
          l |    |---------------+----------------|      |        i    [focus plane]
          t |     \  ^delta.x    ^               /     b |        t
          a |      \             |              /      a |        i
          . |       \            |             /       c |        v
          z |        \           | f          /        k |        e
            |         \          | o         /         D |        Z
            |          \         | c        /          i |        |
            |           \        | u       /           s |        v
            v            \       | s      /            t |
            -     -       -----  | D -----               |   [front plane]
                  ^              | i                     |
                  |              | s                     |
      frontDist ->|              | t                     |
                  |              |                       |
                  v           \  v  / <- lens angle      v
                  -              + {eyePoint}            -     positiveX ->
```

### Notes

* Up vector (positiveY) points out of the screen towards you in this diagram. Likewise delta.y.

* The view origin is in world coordinates. It is the point at the lower left of the rectangle at the focus plane, projected onto the back plane.

* `[delta.x,delta.y]` are on the focus plane and `delta.z` is from the back plane to the front plane.

* The three view vectors come from:

 ```cmd
  {vector from eyePoint->targetPoint} : -Z (positive view Z points towards negative world Z)
  {the up vector}                     : +Y
  {Z cross Y}                         : +X
  ```

  these three vectors form the rows of the view's [RotMatrix]($geometry)

* Objects in space in front of the front plane or behind the back plane are not displayed.

* The focus plane is not necessarily centered between the front plane and back plane (though it often is).
It should generally be between the front plane and the back plane.

* targetPoint is not stored in the view parameters. Instead it may be derived from `{origin},{eyePoint},[RotMatrix]` and `focusDist`.

* The view volume is completely specified by: `{origin}<delta>[RotMatrix]`

* Perspective is determined by `{eyePoint}`, which is independent of the view volume. Sometimes the eyepoint is not
 on the rectangle on the focus plane (that is, a vector from the eyepoint along the viewZ does not hit the view
center.) This creates a 1-point perspective, which can be disconcerting. It is usually best to keep the camera centered.

* Cameras hold a "lens angle" value which is defines the field-of-view for the camera in radians.
The lens angle value is not used to compute the perspective transform for a view.
Instead, the lens angle value can be used to reposition `{eyePoint}` when the view volume or target changes.

* View volumes where one dimension is very small or large relative to the other dimensions (e.g. "long skinny telescope"
views, or "wide and shallow slices", etc.) are problematic and disallowed based on ratio limits.
