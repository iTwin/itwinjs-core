# Using Views in iModelJs

A *View* shows geometry from one or more [Models]($docs/bis/intro/model-fundamentals) of an iModel in a web browser. iModelJs applications can embed and interact with Views anywhere on a web page via `HTMLCanvas` elements.

Multiple Views may be simultaneously visible on the same web page, and are coordinated via the [ViewManager]($frontend) class.

## ViewDefinition Elements

A *View* is saved in an iModel as an element of the [ViewDefinition]($backend) class. `ViewDefinition`s hold all the information necessary to show the same content across sessions.
This includes the camera position, the model(s) displayed, the CategorySelector, the DisplayStyle to use, plus any additional view-specific settings.

## The ViewState Class

The `ViewDefinition` classes (in fact all [Element]($backend) classes) exist only on the backend, because their purpose is to read and write those elements to/from the iModel.
On the frontend, access to the elements needed to display views is provided by the [ElementState]($frontend) classes. The ElementState classes only hold the *state* of elements, not
the methods to read and write elements from the database.

 Views are opened by loading a ViewDefinition into memory via the [ViewState]($frontend) class. They begin showing the content as it was saved in the iModel, but users may
 modify what they're seeing using [Viewing tools](#viewing-tools). These changes are only temporary (in-memory) unless they are saved back to the iModel via [IModelDbElements.updateElement]($backend).

An instance of a `ViewState` in memory holds references to several other objects, including a [CategorySelectorState]($frontend), a [DisplayStyle3dState]($frontend), and a [ModelSelectorState]($frontend) (for `SpatialViews`). Since each of these objects must be loaded in the frontend asynchronously, there is an async method called [IModelConnectionViews.load]($frontend) that returns a promise when the `ViewState` and all other `State` objects required to display a View are ready. The `Viewport` class expects loaded `ViewState` objects.

## Types of ViewDefinitions

There are subclasses of `ViewDefinition` to show different types of `Models` in various ways.

Here are several significant subclasses:

* `ViewDefinition`
  * `SpatialViewDefinition` - shows a view of one or more 3d `SpatialModel`s
  * `DrawingViewDefinition` - shows a view of a single 2d `DrawingModel`
  * `SheetViewDefinition` - shows a view of a single 2d `SheetModel`

For each subclass of `ViewDefinition`, there is a corresponding `xxxViewState` class

## The [IModelConnectionViews]($frontend) member of [IModelConnection]($frontend)

## Getting a list of Views from an iModel

[IModelConnectionViews.queryProps]($frontend)

## Using Viewports

> Note: before creating a `Viewport`, be sure to call [IModelApp.startup]($frontend).

## Viewing Tools

The iModelJs library supplies controls for allowing users to modify their

## ViewManager

## DisplayStyles

## ModelSelectors

## CategorySelectors

## Auxiliary Coordinate Systems

## Reality Data

## View Thumbnails
