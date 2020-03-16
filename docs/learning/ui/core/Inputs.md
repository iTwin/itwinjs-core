# Inputs

The [Inputs]($ui-core:Inputs) category in the `@bentley/ui-core` package includes
components for working with input controls, such as Input, Checkbox, Radio, Select, TextArea, Slider and Toggle.
It also includes the IconInput, NumericInput and AutoSuggest specialized input controls.

## Input

The [Input]($ui-core) React component is a wrapper for the `<input type="text">` HTML element.
It is meant to receive text input from the user. You can display hint text within the field itself. This hint text is replaced by the actual text input by the user.

The hint text is specified using the `placeholder` prop.

```tsx
<Input placeholder="Basic Input" />
```

![input](./images/Input.png "Input")

### Disabled

```tsx
<Input placeholder="Disabled Input" disabled />
```

![input disabled](./images/InputDisabled.png "Disabled Input")

## Checkbox

The [Checkbox]($ui-core) React component is a wrapper for the `<input type="checkbox">` HTML element.
Checkboxes are generally accompanied with a label to communicate what happens when they are checked. They can be used either for selecting one or more options in a list, or to enable, disable, show, or hide a feature in the UI. It should, however, not be confused with a Toggle switch, which can fulfill the same role but is more appropriate in certain settings.

```tsx
<Checkbox label="Basic Check Box" />
```

![checkbox](./images/Checkbox.png "Checkbox")

### Disabled

```tsx
<Checkbox label="Disabled Check Box" disabled />
```

![checkbox disabled](./images/CheckboxDisabled.png "Disabled Checkbox")

## Radio

The [Radio]($ui-core) React component is a wrapper for the `<input type="radio">` HTML element.
A Radio button allows the selection of a single option amongst a predefined set of choices.

```tsx
<Radio label="Basic Radio Button" name="demo1" />
```

![radio](./images/RadioButton.png "Radio Button")

### Disabled

```tsx
<Radio label="Disabled Radio Button" name="demo1" disabled />
```

![radio disabled](./images/RadioButtonDisabled.png "Disabled Radio Button")

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

## Inputs in Dark Mode

![inputs dark](./images/InputsDark.png "Input Components in Dark Mark")

## Textarea

The [Textarea]($ui-core) React component is a wrapper for the `<textarea>` HTML element.
It is an input field that supports multiple rows.

```tsx
<Textarea placeholder="Basic Textarea" />
```

![textarea](./images/Textarea.png "Textarea")

## IconInput

The [IconInput]($ui-core) React component is an Input component
with icon displayed to the left of the input field.

```tsx
<IconInput placeholder="Icon Input" icon={<Icon iconSpec="icon-placeholder" />} />
```

![icon input](./images/IconInput.png "Icon Input")

## NumericInput

The [NumericInput]($ui-core) React component is an input component that accepts numeric input.
It contains up and down arrows to the right that increment and decrement the value.

**Note**: The NumericInput component uses various components from the
[react-numeric-input](https://www.npmjs.com/package/react-numeric-input) package internally.

```tsx
<NumericInput placeholder="Icon Input" min={1} max={100} />
```

![numeric input](./images/NumericInput.png "Numeric Input")

## Labeled Components

The Input, Textarea and Select components have a labeled version.

### LabeledInput

```tsx
<LabeledInput label="Labeled Input" placeholder="Labeled Input" />
```

![labeled input](./images/LabeledInput.png "Labeled Input")

### LabeledTextarea

```tsx
<LabeledTextarea label="Labeled Textarea" placeholder="Labeled Textarea" />
```

![labeled textarea](./images/LabeledTextarea.png "Labeled Textarea")

### LabeledSelect

```tsx
<LabeledSelect label="Labeled Select" options={["Option 1", "Option 2", "Option 3", "Option 4"]} />
```

![labeled select](./images/LabeledSelect.png "Labeled Select")

## Additional Inputs in Dark Mode

![inputs2 dark](./images/Inputs2Dark.png "Additional Input Components in Dark Mark")

## Toggle

The [Toggle]($ui-core) React component is used to toggle an option on and off with a single click or tap.
It should be used instead of a Checkbox for settings when the new value will be used immediately.

### Properties

There are a number of properties that determine the value, color, size and shape of the Toggle.

The `isOn` prop indicates whether the Toggle is "on" or "off". The default is false.

The `buttonType` prop specifies either a Blue button or Primary (green) button. The default is Blue.

The `large` prop indicates whether the Toggle should be larger.

The `rounded` prop indicates whether the Toggle should be rounded (default) or square.

The `showCheckmark` prop indicates whether to show a check mark icon when the toggle is "on".

The [LabeledToggle]($ui-core) React component displays a label to the right of the Toggle.

### Examples

```tsx
<Toggle isOn={true} />
<Toggle isOn={true} buttonType={ToggleButtonType.Primary} />
<Toggle isOn={true} large={true} />
<Toggle isOn={true} rounded={false} />
<Toggle isOn={true} showCheckmark={true} />
<LabeledToggle isOn={true} label="Toggle label" />
```

![toggles](./images/Toggles.png "Toggles")

### Dark Mode

![toggles dark](./images/TogglesDark.png "Toggles in Dark Theme")

## Slider

The [Slider]($ui-core) component displays a range slider.
For more information, see the [Slider learning page](./Slider.md).

## API Reference

* [Inputs]($ui-core:Inputs)
