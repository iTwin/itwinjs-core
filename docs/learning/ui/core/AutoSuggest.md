# AutoSuggest

The [AutoSuggest]($core-react) React component displays an input field with an auto-suggest dropdown.
The AutoSuggest component has support for the Light and Dark themes.

**Note**: The AutoSuggest component uses the [react-autosuggest](https://www.npmjs.com/package/react-autosuggest) package internally.

## Properties

The AutoSuggest properties, as defined in [AutoSuggestProps]($core-react), control what is displayed in the dropdown for any given input value.

The `options` prop specifies either an array of all the suggestions ([AutoSuggestData]($core-react)) or a function that provides the suggestions matching the given input. If `options` is an array, any value or label that includes the current input value will be displayed in the dropdown.

The `getSuggestions` prop specifies a function that asynchronously calculates suggestions for any given input value.

The `getLabel` prop specifies a function that gets a label associated with a given value. If not specified and `options` is an array, the label from the first option with a value matching the current input value will be returned.

The `value` prop specifies an optional input value override.

There are props for several handlers:
`onSuggestionSelected` (required),
`onPressEnter`,
`onPressEscape`,
`onPressTab`,
`onInputFocus` and
`onSuggestionsClearRequested`,

## API Reference

- [AutoSuggest]($core-react:AutoSuggest)
