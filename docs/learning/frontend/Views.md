# Using Views in iModelJs

A *View* shows geometry from one or more `Models` of an iModel in a web browser. iModelJs applications can embed and interact with Views anywhere on a web page via `HTMLCanvas` elements.

Multiple Views may be simultaneously visible on the same web page, and are coordinated via the [ViewManager](#ViewManager).

## ViewDefinition Elements

A *View* is saved in an iModel via elements of the [ViewDefinition]($backend) class. `ViewDefinition`s hold the information necessary to show the same content across sessions.

Views are opened by loading a ViewDefinition into memory via the [ViewState](#the-viewstate-class) class. They begin showing the content as it was saved in the iModel, but users may modify what they're seeing using [Viewing tools](#viewing-tools). These changes are only temporary (in-memory) unless they are saved back to the iModel via [IModelDbElements.updateElement]($backend).
P#
### Types of ViewDefinitions

There are subclasses of ViewDefinition to show different types of `Models` in various ways. Here are several important subclasses:

* ViewDefinition
  * SpatialViewDefinition
  *

## Getting a list of Views from an iModel

## The ViewState Class

## Using Viewports

> Note: before creating a `Viewport`, be sure to call [IModelApp.startup]($frontend). See [IModelApp](./IModelApp.md).

## Viewing Tools

The iModelJs library supplies controls for allowing users to modify their

## ViewManager

## DisplayStyles

## ModelSelectors

## CategorySelectors

## Auxiliary Coordinate Systems

## Reality Data

## View Thumbnails
