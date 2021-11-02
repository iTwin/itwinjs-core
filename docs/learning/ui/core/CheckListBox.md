# CheckListBox

The [CheckListBox]($core-react) React component shows a list of Checkbox items.
The [CheckListBoxItem]($core-react) component is the item with a Checkbox added to a CheckListBox.
The [CheckListBoxSeparator]($core-react) component is the separator item for the CheckListBox.

## Properties

The [CheckListBoxItemProps]($core-react) interface contains the properties for the CheckListBoxItem component.
The `label` prop is mandatory and is the label shown for the Checkbox.
The `checked` props indicates whether the item is checked.
The `disabled` prop indicates whether the item is disabled.
The `onClick` prop is the function called when the item is clicked.

## Examples

CheckListBoxItem components are the children of the CheckListBox component.
The CheckListBoxSeparator component is used for a separator item.

```tsx
<CheckListBox>
  <CheckListBoxItem label="Item 1" />
  <CheckListBoxItem label="Item 2" />
  <CheckListBoxSeparator />
  <CheckListBoxItem label="Item 3" />
  <CheckListBoxItem label="Item 4" />
</CheckListBox>)
```

![checklistbox](./images/CheckListBox.png "CheckListBox")

![checklistbox dark](./images/CheckListBoxDark.png "CheckListBox in Dark Theme")

## API Reference

- [CheckListBox]($core-react:CheckListBox)
