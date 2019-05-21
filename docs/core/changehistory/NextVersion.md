---
ignore: true
---
# NextVersion

## Changes to [SelectionSet]($frontend) events and HiliteSet

HilitedSet has been renamed to HiliteSet and marked `alpha`. It now supports hiliting models and subcategories in addition to elements. By default it continues to be synchronized with the SelectionSet, but this can be overridden (Grigas' presentation viewport component does so, enabling him to control the hilite set independently from the selection set).

SelectEventType enum has been renamed to [SelectionSetEventType]($frontend).

The argument to [SelectionSet.onChanged]($frontend) has changed to [SelectionSetEvent]($frontend). You can switch on the `type` field to access the sets of added and/or removed Ids; or access the current contents directly via the `set` field.

SelectionSet methods accepting an optional `sendEvent` argument have been marked private - it is not appropriate for external callers to suppress event dispatch.
