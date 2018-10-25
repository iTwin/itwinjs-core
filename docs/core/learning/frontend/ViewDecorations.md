# View Decorations

A View Decoration shows application-generated graphics in a [ScreenViewport]($frontend) *in addition to* the persistent (i.e. *scene*) geometry displayed by the Viewport itself. In contrast to the graphics from the persistent geometry (e.g. the Model), View Decorations must be re-evaluated *every time* a frame is rendered. In this sense, they *decorate* the frame with graphics that are only valid for a single frame.

## View Decorators

The process of creating View Decorations starts by adding an object that implements the [Decorator]($frontend) interface to the `ViewManager` via the [ViewManager.addDecorator]($frontend) method. The most important part of the `Decorate` interface is the [Decorator.decorate]($frontend) method, which is called every time iModel.js renders a frame *for any ScreenViewport*. The argument to the `decorate` method is a [DecorateContext]($frontend) that supplies information about the ScreenViewport being rendered, as well as methods to create and save decoration graphics. The [DecorateContext.viewport]($frontend) member holds the target viewport. If you wish to decorate only a single viewport, you must test this member against your intended viewport.

The job of the `decorate` method is to supply the graphics (the *Decorations*) for a single frame of a single ScreenViewport.

A `Decorator` remains active until you call [ViewManager.dropDecorator]($frontend) (Note: ViewManager.addDecorator returns a method that calls this for you if you wish to use it.)

A [InteractiveTool]($frontend) can also show decorations and does *not* need to call the [ViewManager.addDecorator]($frontend) method to add itself. [InteractiveTool.decorate]($frontend) is called for the *active* tool to add it's decorations, [InteractiveTool.decorate]($frontend) is not called when the tool is paused by another tool such as a [ViewTool]($frontend). To show decorations while paused, a tool can implement [InteractiveTool.decorateSuspended]($frontend).

## Categories of View Decorations

Sometimes decorations are meant to *intersperse* with the scene geometry, and sometimes they are meant to display atop of it. For this reason, there are 3 broad categories of View Decorations:

- View Graphic Decorations - are drawn using iModel.js render primitives into the WebGL context.
- Canvas Decoration - are drawn onto the 2d canvas using [CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D). Canvas decorations are always on top of View Graphic Decorations
- HTML Decorations - are HTMLElements that are added to the DOM. HTML decorations are always on top of Canvas Decorations.

> Note that a single [Decorator]($frontend) can create multiple Decorations, from any or all of the categories above.

### View Graphic Decorations

View Graphic Decorations are drawn using the iModel.js rendering system through WebGL. There are 5 types of View Graphic Decorations, defined by the [GraphicType]($frontend) enum.

- [GraphicType.ViewBackground]($frontend) - displayed behind all scene geometry
- [GraphicType.Scene]($frontend) - interspersed with scene geometry, rendered using view's render mode and lighting
- [GraphicType.WorldDecoration]($frontend) - interspersed with scene geometry, rendered with smooth shading and default lighting
- [GraphicType.WorldOverlay]($frontend) - displayed atop scene geometry
- [GraphicType.ViewOverlay]($frontend) - displayed atop scene geometry, drawn in view coordinates.

> Note that `GraphicType.ViewOverlay` performs the same function as Canvas Decorators and are generally less flexible and less efficient. Prefer Canvas Decorations instead.

You create View Graphic Decorations by calling [DecorateContext.createGraphicBuilder]($frontend) on the context supplied to `decorate`, supplying the appropriate `GraphicType`.
You then add one or more graphics to the [GraphicBuilder]($frontend) using its methods. Finally, you add the completed graphics to the frame by calling [DecorateContext.addDecorationFromBuilder]($frontend).

The following example illustrates creating a view graphic decoration to show the [IModel.projectExtents]($common) in spatial views:

```ts
[[include:View_Graphic_Decoration]]
```

#### Pickable View Graphic Decorations

View Graphic Decorations are drawn into or atop the scene. To make your View Graphic Decorations *pickable* (i.e. allow the user to click on them to perform an action, or to give feedback when the cursor hovers over them), you must:

- Obtain a `TransientId` by calling [IModelConnection.transientIds]($frontend).next
- Supply that TransientId as the 3rd argument to [DecorateContext.createGraphicBuilder]($frontend)
- Implement [Decorator.testDecorationHit]($frontend) to return `true` when the supplied Id matches your decoration's Id.
- Implement [Decorator.getDecorationToolTip]($frontend) and/or   [Decorator.onDecorationButtonEvent]($frontend) to supply a tooltip and perform an action when your decoration is clicked.

The following example illustrates creating a pickable view graphic decoration in order to supply a tooltip message when under the cursor:

```ts
[[include:Pickable_View_Graphic_Decoration]]
```

### Canvas Decorations

A [CanvasDecoration]($frontend) is drawn atop the scene using [CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D).
To add a CanvasDecoration, call [DecorateContext.addCanvasDecoration]($frontend) from your [Decorator.decorate]($frontend) method.

CanvasDecorators must implement [CanvasDecoration.drawDecoration]($frontend) to supply visible graphics, by calling methods on CanvasRenderingContext2D.

CanvasDecorators may optionally include the member [CanvasDecoration.position]($frontend), that becomes the 0,0 point for your CanvasRenderingContext2D calls.

The following example illustrates creating a canvas decoration to show a plus symbol at the center of the view:

```ts
[[include:Canvas_Decoration]]
```

> [Markers](./Markers) are a type of Canvas Decoration

#### Pickable Canvas Decorations

To make your CanvasDecorations pickable, implement [CanvasDecoration.pick]($frontend) and return `true` if the supplied point lies within your decoration's region.

If you return true from your `CanvasDecoration.pick` method, you can implement:

- [CanvasDecoration.onMouseEnter]($frontend) - the mouse has entered your decoration
- [CanvasDecoration.onMouseLeave]($frontend) -  the mouse has left your decoration
- [CanvasDecoration.onMouseMove]($frontend) - the mouse has moved inside your decoration
- [CanvasDecoration.onMouseButton]($frontend) - a mouse button went up or down inside your decoration
- [CanvasDecoration.onWheel]($frontend) - the wheel was rolled over your decoration
- [CanvasDecoration.decorationCursor]($frontend) - the cursor to be displayed while the pointer is in your decoration

### HTML Decorations

HTML Decorations are simply [HTMLElements](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement) that you add to the DOM on top of your views. In your [Decorator.decorate]($frontend) method, use [DecorateContext.addHtmlDecoration]($frontend) to add HTML Decorations.

HTML Decorators are appended to an [HTMLDivElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDivElement) called "overlay-decorators" that is created by [ScreenViewport.create]($frontend).
All children of that Div are removed every frame, so you must re-add your HTML Decorator each time your [Decorator.decorate]($frontend) method is called.

The "overlay-decorators" Div is stacked on top of the canvas, but behind the "overlay-tooltip" Div (where tooltips are displayed.)

### Decoration Precedence

The order of precedence for Decorations is:

1. GraphicType.ViewBackground decorations are drawn behind the scene
1. GraphicType.Scene and GraphicType.WorldDecoration decorations are drawn in the scene
1. GraphicType.WorldOverlay and GraphicType.ViewOverlay decorations are drawn on top of the scene
1. Canvas Decorations are drawn on top of all View Graphic decorations
1. HTML Decorations are drawn on top of all Canvas decorations
1. The ToolTip is on top of all HTML decorations

Within a decoration type, the last decoration drawn is on top of earlier decorations.
