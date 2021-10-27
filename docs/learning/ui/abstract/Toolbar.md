# Toolbar

The [Toolbar]($appui-abstract:Toolbar) classes and interfaces are used for creating and managing items in a Toolbar.

## Toolbar Item Utilities

The [ToolbarItemUtilities]($appui-abstract) class provides two methods for creating toolbar buttons. Below are a couple examples.

Example of creating an action button definition and will run the specified function when pressed.

```ts
const simpleActionSpec = ToolbarItemUtilities.createActionButton("simple-action-tool", 100, "icon-app-1", "Test tool label",
  (): void => {
    console.log("Got Here!");
  });

const simpleAction2Spec = ToolbarItemUtilities.createActionButton("simple-action2-tool", 110, "icon-app-2", "Second tool label",
  (): void => {
    console.log("Got Here!");
  });
```

Example of creating a group button definition and will allow access to multiple action buttons. In this example we place the two buttons defined above into a single group button. The last object passed in below contain any override values for any available property of a [GroupButton]($appui-abstract).

```ts
const groupSpec = ToolbarItemUtilities.createGroupButton("test-tool-group", 100, "icon-developer", "test group", [simpleActionSpec, simpleAction2Spec], { badgeType: BadgeType.TechnicalPreview });
```

In both examples, the first parameter is a unique key for the tool button and the second is the item priority that defines the order of buttons within the toolbar. This method of defining item priority allows other packages and extensions to insert buttons at specific positions within the toolbar. It is recommended that the host application increment button definitions by 10 to provide sufficient gaps for additional groups and action buttons. The ordering is done from lowest to highest priority values.

See additional information under [ToolbarHelper]($appui-react) to see functions that create buttons from ItemDefs.

## API Reference

- [Toolbar]($appui-abstract:Toolbar)
