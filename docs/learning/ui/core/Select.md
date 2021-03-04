# Select

The [Select]($ui-core:Select) category in the `@bentley/ui-core` package includes the
[Select]($ui-core), [LabeledSelect]($ui-core) and [ThemedSelect]($ui-core) components.

## Select

The [Select]($ui-core) React component is a wrapper for the `<select>` HTML element.
The Select component is meant to allow the user to select an option from a list.
The list of options popup below the component, or above if there isn't enough room below.

```tsx
<Select options={["Option 1", "Option 2", "Option 3", "Option 4"]} />
```

![select](./images/Select.png "Select")

### Disabled

```tsx
<Select options={["Option 1", "Option 2", "Option 3", "Option 4"]} disabled />
```

![select disabled](./images/SelectDisabled.png "Disabled Select")

### Placeholder

```tsx
<Select options={["Option 1", "Option 2", "Option 3", "Option 4"]} placeholder="Pick an option" />
```

![select disabled](./images/SelectPlaceholder.png "Select with placeholder")

## LabeledSelect

```tsx
<LabeledSelect label="Labeled Select" options={["Option 1", "Option 2", "Option 3", "Option 4"]} />
```

![labeled select](./images/LabeledSelect.png "Labeled Select")

## ThemedSelect

ThemedSelect is a wrapper for [react-select](https://www.npmjs.com/package/react-select) with iTwin.js UI theming applied.

## API Reference

- [Select]($ui-core:Select)
