---
publish: false
---
# NextVersion

## Build tools changes

Removed TSLint support from `@bentley/build-tools`. If you're still using it, please switch to ESLint.
Also removed legacy `.eslintrc.js` file from the same package. Instead, use `@bentley/eslint-plugin` and the `imodeljs-recommended` config included in it.

## User Interface Package Changes

Several changes were made in the @bentley/ui-* packages.
Some components in @bentley/ui-core were deprecated in favor of components in @itwinui-react.
A few constructs were deprecated in @bentley/ui-core package with alternatives elsewhere.
Some older deprecated components, enums and interfaces were removed. These also have alternatives.

### Deprecated Several ui-core Components in Favor of iTwinUI-react Components

Several UI components in the @bentley/ui-core package have been deprecated.
Developers should use equivalent components in @itwin/itwinui-react instead.

|Deprecated in @bentley/ui-core|Use from @itwin/itwinui-react instead
|-----|-----
|Button | Button
|ButtonSize | `size` prop for itwinui-react Button
|ButtonType | `styleType` prop for itwinui-react Button
|Checkbox | Checkbox
|ExpandableBlock | ExpandableBlock
|Headline| Headline
|HorizontalTabs | HorizontalTabs
|Input | Input
|LabeledInput | LabeledInput
|LabeledSelect | LabeledSelect
|LabeledTextarea | LabeledTextarea
|LabeledToggle | ToggleSwitch with `labelPosition="right"` prop
|LeadingText | Leading
|ProgressBar | ProgressLinear
|ProgressSpinner | ProgressRadial
|Radio | Radio
|Select | Select
|SelectOption | SelectOption
|SmallText | Small
|Spinner | ProgressRadial with `indeterminate` prop
|SpinnerSize | `size` prop in ProgressRadialProps
|SplitButton | SplitButton
|Subheading | Subheading
|Textarea | Textarea
|Tile | Tile
|Title | Title
|Toggle | ToggleSwitch
|Tooltip | Tooltip
|TooltipPlacement | Placement

### Deprecated with alternatives elsewhere

A few constructs were deprecated in @bentley/ui-core package.
Some were copied to the @bentley/ui-abstract package.
Some have replacements within the @bentley/ui-core package.

|Deprecated|Use instead
|-----|-----
|DialogButtonDef in @bentley/ui-core | DialogButtonDef in @bentley/ui-abstract
|DialogButtonStyle in @bentley/ui-core | DialogButtonStyle in @bentley/ui-abstract
|DialogButtonType in @bentley/ui-core | DialogButtonType in @bentley/ui-abstract
|LocalUiSettings in @bentley/ui-core | LocalSettingsStorage in @bentley/ui-core
|SessionUiSettings in @bentley/ui-core | SessionSettingsStorage in @bentley/ui-core

### Older Deprecated items removed

Some older deprecated components, enums and interfaces were removed.
Some of these have alternatives in the same package, while others have alternatives in a different package.

|Removed from @bentley/ui-core |Use instead
|-----|-----
|LoadingPromptProps.isDeterministic | LoadingPromptProps.isDeterminate in @bentley/ui-core
|NumericInput component | NumberInput component in @bentley/ui-core
|TabsProps.onClickLabel | TabsProps.onActivateTab in @bentley/ui-core

|Removed from @bentley/ui-components |Use instead
|-----|-----
|hasFlag function | hasSelectionModeFlag function in @bentley/ui-components
|StandardEditorNames | StandardEditorNames in @bentley/ui-abstract
|StandardTypeNames | StandardTypeNames in @bentley/ui-abstract
|StandardTypeConverterTypeNames | StandardTypeNames in @bentley/ui-abstract

|Removed from @bentley/ui-framework |Use instead
|-----|-----
|COLOR_THEME_DEFAULT | SYSTEM_PREFERRED_COLOR_THEME in @bentley/ui-framework is used as default color theme
|FunctionKey | FunctionKey in @bentley/ui-abstract
|IModelAppUiSettings | UserSettingsStorage in @bentley/ui-framework
|reactElement in ContentControl | ContentControl.reactNode
|reactElement in NavigationAidControl | NavigationAidControl.reactNode
|reactElement in NavigationWidgetDef | NavigationWidgetDef.reactNode
|reactElement in ToolWidgetDef | ToolWidgetDef.reactNode
|reactElement in WidgetControl | WidgetControl.reactNode
|reactElement in WidgetDef | WidgetDef.reactNode
|ReactMessage | ReactMessage in @bentley/ui-core
|SpecialKey | SpecialKey in @bentley/ui-abstract
|WidgetState | WidgetState in @bentley/ui-abstract
