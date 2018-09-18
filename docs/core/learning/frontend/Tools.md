# iModelJs Tools

A [Tool]($frontend) is a JavaScript class that performs an action on behalf of a user. There are several Tool types, all of which are implemented by subclassing various classes in the Tool class hierarchy.

* Immediate Tools execute their assigned tasks immediately without further input. They do not become the *active tool*, and are implemented as subclasses of Tool.
* [ViewTool]($frontend)s (such as zoom, pan, and view rotation) pause the active tool while they are executing and resume the active tool when finished. They are implemented as subclasses of ViewTool.
* [PrimitiveTool]($frontend)s are used for graphical interactions with an iModel. When invoked, they become the active tool, reacting to user input such as data points, mouse movements, gestures, keystrokes, and resets. Interactive Tools are the most flexible Tool type, but they are also the most challenging to implement. iModelJs provides some specializations of Interactive Tool that are easier to implement.

The frontend package provides a comprehensive set of Viewing Tools, so most iModelJs applications do not need to implement their own.

iModelJs also provides a Select Tool, which allows users to select existing elements and interact with them through EditorManipulators that are provided by the element handlers. Providing a capable EditorManipulator for an element often eliminates the need for  modification tools specific to that element type.

It is important to make user actions that result in changes to your application state happen through Tool invocation (Immediate tools are very handy for this), because Tool invocations can be recorded for testing, or for playback through macros.

## Tool Invocation

Users generally invoke Tools by clicking on their associated icons, or occasionally by using the Command Parser. Tools can be invoked programmatically using the ToolRegistry.run method, which takes the toolId as its first argument and then allows optional arguments that are passed both to the Tools constructor and to its run method.

## ToolAdmin

The [ToolAdmin]($frontend) class supervises the collection of low-level input from the view windows (button events, motion events, gestures, timer events, keystrokes, etc.); interprets those inputs into high-level events that Tools can readily process (data points, motion events, etc., in iModelJs coordinates, with the appropriate locks and Accudraw corrections applied); and routes those inputs to the appropriate Tool.

Routing of the interpreted, high-level events is as follows:

* If there is an active tool, the events are directed to it. The active tool can either handle a particular event or ignore it.
* If the active tool does not handle a particular event, it is directed to the IdleTool. The standard iModelJs IdleTool looks for inputs that initiate viewing tools. For desktop computers, pressing the middle button starts the pan operation, rolling the wheel starts a zoom in or out, shift-middle button starts the rotate command, and a double click on the middle button fits the current view. On touch devices, pinch is used to zoom, a two-finger drag pans the view, a single finger drag rotates the view, and a double tap fits the current view.

As mentioned above a ViewTool can temporarily interrupt a PrimitiveTool. The ToolAdmin handles that sequence transparently such that the PrimitiveTool does not have to be aware of the interruption.
