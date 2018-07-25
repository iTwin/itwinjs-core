# Localization

Most of the strings specified in presentation rules and visible to the
end user can be localized.

The library uses a simplified [i18next JSON
format](https://www.i18next.com/misc/json-format#i-18-next-json-v3) - it
only supports simple key-value pairs (including nesting) without plurals or
interpolation.

It's important to note that **ECPresentation localization happens on
the backend**, so localization JSON file must be delivered with the backend.

## Localization in Presentation Rule Sets

The strings in presentation rule sets can be localized by using the following
format: `@LocalizationNamespace:StringId@`. Additionally, you can use multiple
localized pieces in one string, e.g. `Concat_@Namespace:String1@_and_@Namespace:String2@`.
