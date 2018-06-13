# Using Views in iModelJs

A *View* renders geometry from one or more [Models]($docs/bis/intro/model-fundamentals) of an iModel in a web browser. iModelJs applications
can embed and interact with Views anywhere on a web page via an `HTMLCanvas` element.

Multiple Views may be simultaneously visible on the same web page, and are coordinated via the [ViewManager]($frontend) class.

## ViewDefinition Elements

A *View* is saved in an iModel as an element of the [ViewDefinition]($backend) class. `ViewDefinition`s hold all the information necessary to show the same content across sessions.
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
async method called [IModelConnection.Views.load]($frontend) that returns a promise when the `ViewState` and all other `State` objects required to display a
View are ready. The [Viewport]($frontend) class expects loaded `ViewState` objects.

## Types of ViewDefinitions

There are subclasses of `ViewDefinition` to show different types of `Models` in various ways.

Here are several significant subclasses:

* `ViewDefinition`
  * `SpatialViewDefinition` - shows a view of one or more 3d `SpatialModel`s
  * `DrawingViewDefinition` - shows a view of a single 2d `DrawingModel`
  * `SheetViewDefinition` - shows a view of a single 2d `SheetModel`

For each subclass of `xxxViewDefinition`, there is a corresponding `xxxViewState` class in the frontend.

## Loading Views from an iModel

There is a method called [IModelConnection.Views.getViewList]($frontend) that returns an array of [ViewSpec]($frontend)s in a convenient
format for User Interfaces. This can be used to present a list of possible views by name in a List.

For example:

``` ts
[[include:IModelConnection.Views.getViewList]]
```

Once a view is selected from the list, it may be loaded with:

``` ts
[[include:IModelConnection.Views.load]]
```

> Note that in the examples above, `getSpatialViews` and `loadOneView` are `async`, and you must use `await` when you call them.

## Using Viewports

`ViewState` objects hold the state of a `ViewDefinition` (*what* is shown in a View) in the frontend.

To connect a ViewState to a rectangular region on a web page, you create instances of the [Viewport]($frontend) class. The constructor of `Viewport` takes an `HTMLCanvas` and a
(fully loaded) ViewState. In this manner, Viewports form the connection between a rectangular region on your web page and a set of
Element and Models in the iModel, a display [Frustum]($frontend), a DisplayStyle, and the iModelJs rendering system.

> Note: before creating a `Viewport`, be sure to call [IModelApp.startup]($frontend).

## ViewManager

The `Viewport` class is responsible for displaying Views, as defined by its `ViewState`. However, typically the purpose of showing a View is to allow the user
to modify the View itself, or to interact with its contents. To facilitate that, we need to connect the event system of the browser with `Viewport`s
via the [ViewManager]($frontend) class.

## Viewing Tools

The iModelJs library supplies controls for allowing users to modify their

## DisplayStyles

## ModelSelectors

## CategorySelectors

## Auxiliary Coordinate Systems

## Reality Data

## View Thumbnails
