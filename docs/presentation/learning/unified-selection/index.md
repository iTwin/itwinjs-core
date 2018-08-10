# Unified Selection

The purpose of unified selection is to act as a single source of truth of what is selected in iModelJs application.

![selection storage](./selection-storage.png "Selection storage")

The storage may contain:
- ECInstance keys which represent elements and models
- Node keys which represent tree nodes

Different UI components may want to represent current selection
differently - some may only want to show content for current selection while others may want act differently based on
[selection level](./Terminology.md#selection-levels) used for the
last selection change event.

See also:
- [Content Components](./ContentComponents.md)
- [Terminology](./Terminology.md)
