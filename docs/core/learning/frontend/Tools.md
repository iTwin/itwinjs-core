# iModel.js Tools

A [Tool]($frontend) is a JavaScript class that performs an action on behalf of a user. There are two principal Tool categories, [immediate](#immediate-tools) and [interactive](#interactive-tools).

## Immediate Tools

Immediate tools execute their assigned tasks *immediately* without further input. They do not become the *active* tool, and are implemented as direct subclasses of [Tool]($frontend).

It is important to make user actions that result in changes to your application state happen through Tool invocation, which can be recorded for testing, or for playback through macros; immediate tools are very handy for this.

## Interactive Tools

There are three interactive Tool classifications, each of which is implemented by subclassing [InteractiveTool]($frontend) to best serve a specific purpose.

* [ViewTool]($frontend) is used to implement viewing operations such as pan, zoom, and rotate.
  * Pauses the active tool while executing and resumes the active tool when finished.
  * The frontend package provides a comprehensive set of View tools; most iModel.js applications do not need to implement their own.
* [InputCollector]($frontend) is used to gather input for the current Primitive tool by snapping or locating elements in the iModel.
  * Pauses an active Primitive tool, can be paused by a View tool.
  * Should not modify the iModel contents without being able to coordinate with the current Primitive tool.
  * The frontend package includes several [AccuDrawShortcuts]($frontend) implementations.
* [PrimitiveTool]($frontend) is used for graphical interactions with an iModel.
  * When invoked, they become the active tool, reacting to user input such as data points, mouse movements, touch, keystrokes, and resets.
  * Primitive tools are the most common type of tool implemented by iModel.js applications.
  * The frontend package includes a [Select Tool](#select-tool) to fill the role of a *default* Primitive tool.

iModel.js provides some specializations of [InteractiveTool]($frontend) to make it easier to implement certain types of interactions, ex. creating new elements vs. modifying existing elements.

## Tool Invocation

Users generally invoke tools by clicking on their associated icons, or occasionally by using the Command Parser. Tools can be invoked programmatically using the [ToolRegistry.run]($frontend) method, which takes the toolId as its first argument and then allows optional arguments that are passed both to the tool's constructor and to its run method.

## ToolAdmin

The [ToolAdmin]($frontend) class supervises the collection of low-level input from the view windows (button events, motion events, touch events, timer events, keystrokes, etc.); interprets those inputs into high-level events that tools can readily process (data points, motion events, etc., in iModel.js coordinates, with the appropriate locks and [AccuDraw]($frontend) corrections applied); and routes those inputs to the appropriate tool.

Routing of the interpreted, high-level events is as follows:

* If there is an active tool, the events are directed to it. The active tool can either handle a particular event or ignore it.
* If the active tool does not handle a particular event, it *may* be directed to the [Idle Tool](#idle-tool).

As mentioned above a View tool or Input Collector can temporarily interrupt a Primitive tool. The ToolAdmin handles that sequence transparently such that the Primitive tool does not have to be aware of the interruption.

A Primitive tool ends when another Primitive tool is run. The ToolAdmin establishes [Select Tool](#select-tool) as the *default* Primitive tool. When a default tool is provided, it becomes the active tool when the iModel.js application starts or a Primitive tool wishes to exit. Having a default tool is optional, an application can instead choose to have the [Idle Tool](#idle-tool) handle input that would normally only be directed to the active tool, like data points and resets.

## Idle Tool

The standard iModel.js [IdleTool]($frontend) is a subclass of [InteractiveTool]($frontend) that looks for inputs that initiate View tools.

For desktop computers, viewing operations are associated with the middle button, which is not typically handled by the active tool. Additionally, if the application chooses to not have a default tool, when no tool is active, data and reset events will also be directed to the Idle tool. Default mouse event handling is as follows:

* Press and hold middle button to pan the view
* Press and hold shift-middle button to rotate the view (uses geometry under cursor as pivot point)
* Double click of middle button to fit the view
* Roll the wheel to zoom the view in and out
* Press and hold data button to rotate the view (only when no active tool)
* Press and hold reset button to pan the view (only when no active tool)

For touch devices, the Idle tool associates the following touch events with viewing operations:

* Single finger drag to rotate the view
* Two-finger drag to pan the view
* Double tap to fit the view
* Pinch to zoom the view in and out

## Selection Tool

iModel.js also provides [SelectionTool]($frontend). SelectionTool is a subclass of [PrimitiveTool]($frontend) for creating and managing a [SelectionSet]($frontend) from existing elements. A SelectionSet identifies elements of particular interest for examining properties and other interactions.

