# Localization

Most of the strings specified in presentation rules and visible to the
end user can be localized.

The library uses a simplified [i18next JSON
format](https://www.i18next.com/misc/json-format#i-18-next-json-v3) - it
only supports simple key-value pairs (including nesting) without plurals or
interpolation.

Localization happens on the **frontend**.
In the case of only using the backend, you must provide a localization function when initializing the presentation backend.

## Localization in presentation rulesets

The strings in presentation rule sets can be localized by using the following
format: `@LocalizationNamespace:StringId@`. Additionally, you can use multiple
localized pieces in one string, e.g. `Concat_@Namespace:String1@_and_@Namespace:String2@`.
