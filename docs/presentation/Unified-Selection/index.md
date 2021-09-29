# Unified Selection

The purpose of unified selection is to act as a single source of truth of what is selected in an iTwin.js application.

> **Contents**
>
> - [Selection Levels](#selection-levels)
> - [Selection Handling](#selection-handling)
>   - [Tree](#tree)
>   - [Table](#table)
>   - [Property Grid](#property-grid)
>   - [Viewport](#viewport)
> - [Reference](#reference)
> - [Examples](#examples)

## Selection Levels

By default, whenever a component changes unified selection, that happens at 0th (top) selection level. And similarly, whenever a component requests current selection from the storage, by default the top selection level is used. However, there are cases when we want to have multiple levels of selection.

For example, let's say there're 3 components: *A*, *B* and *C*:

- *Component A* shows a list of elements and allows selecting them.
- *Component B* shows a list of elements selected in *Component A* and allows selecting them individually. Selecting an individual element should not change selection in *Component A* or content in *Component B* itself.
- *Component C* shows properties of elements selected either in *Component A* or *Component B*.

The behavior described above can't be achieved using just one level of selection, because as soon as selection is made in *Component B*, that selection would get represented in *Component A* and *Component B* would change what it's displaying to the individual element.

That can be fixed by introducing another selection level, but before the components can be configured, here are a few key facts about selection levels:

- Higher level selection has lower index. So top level selection is 0, lower level is 1, and so on.
- Changing higher level selection clears all lower level selections.
- Lower level selection doesn't have to be a sub-set of higher level selection.

With that in mind, the above components *A*, *B* and *C* can be configured as follows:

- *Component A* only cares about top level selection. Whenever something is selected in the component, unified selection is updated at the top level. Similarly, whenever unified selection changes, the component only reacts if that happened at the top level.
- *Component B* reloads its content if the selection changes at the top level. Row selection is handled using lower level, so selecting a row doesn't affect *Component A's* selection or *Component B's* content.
- *Component C* reloads its content no matter the selection level.

## Selection Handling

The `@itwin/presentation-components` package delivers helper APIs for hooking four primary components into unified selection: [ControlledTree]($components-react), [Table]($components-react), [Property Grid]($components-react:PropertyGrid) and [ViewportComponent]($imodel-components-react). Each of those components handle unified selection differently and that behavior is explained in the below sections.

### Tree

Tree components show a hierarchy of nodes. In case of unified selection-enabled tree, the nodes are expected to represent some kind of *ECInstance* (a *Model*, *Element* or basically anything from the [EC world](../../bis/ec/index.md)).

The rules for interacting with unified selection are very simple in this case:

- when unified selection changes, we mark nodes as selected if *ECInstances* they represent are in the unified selection storage
- when a node is selected, we add *ECInstance* represented by the node to unified selection storage

In short, this is similar to how *Component A* works in the [selection levels example](#selection-levels).

### Table

Table is a component that displays data in a table layout. In the context of [EC](../../bis/ec/index.md) it's used to display *ECInstance* properties - one column per property, one row per ECInstance.

The rules for interacting with unified selection are:

- when unified selection changes at the 0th level, we load properties for selected *ECInstances*.
- when unified selection changes at the 1st level, we highlight rows that represent selected *ECInstances*.
- when a row is selected, we add the *ECInstance* it represents to unified selection at the 1st level.

In short, this is similar to how *Component B* works in the [selection levels example](#selection-levels).

### Property Grid

Property grid is a component that can show multiple categorized property label - value pairs. In the context of [EC](../../bis/ec/index.md), it shows properties of one *ECInstance*. It can also show properties of multiple *ECInstances* by merging them into one before displaying.

The property grid has no way to change the selection and reacts to unified selection changes by simply displaying properties of *ECInstances* that got selected during the last selection change (no matter the selection level).

In short, this is similar to how *Component C* works in the [selection levels example](#selection-levels).

### Viewport

The Viewport component is used to display graphical `BisCore.Element` *ECInstances* simply called *Elements*. The component handles a container called the highlight (or often just hilite) set to represent selected elements.

The rules for interacting with unified selection are:

- when unified selection changes at the 0th level, we create a [hilite set](#hilite-set) for the current selection and ask the viewport to hilite it.
- when an element is selected in the viewport, we compute the selection based on [selection scope](#selection-scopes) and add that to our unified selection storage at the top level.

The two key concepts - hilite set and selection scope are explained next.

#### Hilite Set

This is a set of IDs that we want hilited for a given selection. The IDs are separated by type (model, sub-category and element) which is determined based on the types of *ECInstances* in selection and presentation rules to create the hilite set.

The rules are as follows:

- for `BisCore.Subject` return IDs of all models that are recursively under that Subject
- for `BisCore.Model` just return its ID
- for `BisCore.PhysicalPartition` just return ID of a model that models it
- for `BisCore.Category` return IDs of all its *SubCategories*
- for `BisCore.SubCategory` just return its ID
- for `BisCore.GeometricElement` return ID of its own and all its child elements recursively

So for example when unified selection contains a subject, the hilite set for it will contain all models under that subject, it's child subjects, their child subjects, etc. Given such hilite set, the viewport component will hilite all elements in those models.

#### Selection Scopes

Selection scopes allow decoupling of what gets picked and what gets selected. Without selection scopes, whenever a user picks an element in the viewport, its ID goes straight into unified selection storage. With selection scopes we can modify that and add something different. The input to selection scopes' processor is element IDs and scope to apply, and the output is element keys (class name + element ID). We get the input when user picks some elements in the viewport, run that through selection scope processor and put the output into unified selection storage.

Here are the scopes we support at the moment:

- `element` - return key of selected element
- `assembly` - return key of selected element's parent element (or just the element if it has no parent)
- `top-assembly` - return key of selected element's topmost parent element (or just the element if it has no parents)
- `category` - return key of element's category
- `model` - return key of element's model

## Reference

The key unified selection APIs are defined in [@itwin/presentation-frontend]($presentation-frontend:UnifiedSelection) package:

- [SelectionManager]($presentation-frontend) is where the selection is stored, it allows retrieving current selection, modifying it and listening to its changes. Accessed globally on the frontend through `Presentation.selection` accessor.
- [SelectionScopesManager]($presentation-frontend) helps with [selection scopes](#selection-scopes), it may be used to get available selection scopes and compute selection given input element IDs and desired selection scope. Accessed globally through `Presentation.selection.scopes` accessor.
- [HiliteSetProvider]($presentation-frontend) helps with computing [hilite sets](#hilite-set) for the given selection. The provider may be created on demand whenever a hilite set for custom input needs to be computed. For the *current* selection stored in [SelectionManager]($presentation-frontend), it's recommended to use the [SelectionManager.getHiliteSet]($presentation-frontend) method.

For each type of component described in [selection handling section](#selection-handling), the `@itwin/presentation-component` package delivers a set of React-based helper APIs:

- Tree
  - [useUnifiedSelectionTreeEventHandler]($presentation-components) hook returns a [TreeEventHandler]($components-react) that can be passed straight to [ControlledTree]($components-react) component as an [ControlledTreeProps.eventsHandler]($components-react) prop and takes care of syncing selection between the tree and unified selection storage.

- Table
  - [tableWithUnifiedSelection]($presentation-components) HOC takes a [Table]($components-react) component as input and returns a component with injected handling for unified selection as described in [this section](#table).

- Property Grid
  - [usePropertyDataProviderWithUnifiedSelection]($presentation-components) hook takes an [IPresentationPropertyDataProvider]($presentation-components) as an input and ensures the provider is updated with current selection as soon as there are changes in unified selection storage. It also returns some cues about the selection that help the component with various edge cases, like nothing being selected or overly large number of selected elements.

- Viewport
  - [viewWithUnifiedSelection]($presentation-components) HOC takes a [ViewportComponent]($imodel-components-react) as input and returns a component with injected handling for unified selection as described in [this section](#viewport).

## Caveats

There are two selection-related APIs named very similarly: [SelectionSet]($core-frontend) (accessed through `IModelConnection.selectionSet`) and [SelectionManager]($presentation-frontend) (accessed through `Presentation.selection`). Not only they're named similarly, but also work very similarly as well. And to make matters worse, they're somewhat synchronized.

The [SelectionManager]($presentation-frontend), is a single global storage of what's currently selected in the application. It allows selecting any ECInstance (model, category, graphical element or even an ECClass!) and can be used without a viewport.

The [SelectionSet]($core-frontend), on the other hand, is what the tools (the ones used in the viewport) think is selected. It's like a viewport-specific selection which doesn't necessarily have to match the global selection, similar how the tree component maintains it's list of selected nodes. It only maintains graphical elements and only makes sense in a context of a viewport (or multiple of them, since [SelectionSets]($core-frontend:SelectionSet) are shared across all viewports associated with the same [IModelConnection]($core-frontend)).

When unified selection is enabled on a viewport component, we start synchronizing the two sets so picking an element in the viewport puts it into global selection (after going through all the [selection scopes](#selection-scopes) processing) and putting something into unified selection gets selected in the [SelectionSet]($core-frontend) so it can be used by tools in the viewport.

Generally, if an application uses unified selection, it should be interacting with [SelectionManager]($presentation-frontend) API. Here're a few example issues that may arise due to interacting with [SelectionSet]($core-frontend):

- selection works fine with a viewport, but stops working if a viewport is not created
- adding a (non-graphical) element to selection doesn't select it in other components
- etc.

## External Resources

- [Hooking a tree into unified selection](https://www.itwinjs.org/sandboxes/grigas/Unified%20Selection%20Tree)
- [Hooking a table into unified selection](https://www.itwinjs.org/sandboxes/grigas/Unified%20Selection%20Table)
- [Hooking a property grid into unified selection](https://www.itwinjs.org/sandboxes/grigas/Unified%20Selection%20PropertyGrid)
- Hooking 3rd party components into unified selection
  - [Blog post](https://medium.com/itwinjs/hooking-3rd-party-component-into-unified-selection-c4daec69789d)
  - [Sandbox of custom property grid implementation](https://www.itwinjs.org/sandboxes/grigas/Element%20Properties%20Loader)
- [Using unified selection APIs directly](https://www.itwinjs.org/sandboxes/grigas/Unified%20Selection%20Directly)
