# Localization

Most of the strings specified in presentation rules and visible to the
end user can be localized.

The library uses a simplified [i18next JSON
format](https://www.i18next.com/misc/json-format#i-18-next-json-v3) - it
only supports simple key-value pairs (including nesting) without plurals or
interpolation.

## On the frontend

All responses to requests made through the frontend's [PresentationManager]($presentation-frontend) are automatically localized, assuming all required assets are properly set up.
`@itwin/presentation-frontend` relies on [IModelApp.localization]($frontend) to do the translations. All Presentation localized strings are defined in locale files located at
the `public` folder from `@itwin/presentation-common` - consumers must ensure these locale files are placed at a location known to [IModelApp.localization]($frontend). See
[Localization in iTwin.js](..\..\learning\frontend\Localization.md) page for more details.

## On the backend

In the case of only using the backend, consumers must provide a localization function [PresentationManagerProps.getLocalizedString]($presentation-backend) when initializing the presentation backend.

The localization function should translate the following strings:

<details>

<summary>List of translatable strings</summary>

* @Presentation:label.notSpecified@
* @Presentation:label.other@
* @Presentation:label.varies@
* @Presentation:label.multipleInstances@
* @Presentation:field.label@
* @Presentation:selectedItems.categoryLabel@
* @Presentation:selectedItems.categoryDescription@

</details>

Example for providing the localization function:

```typescript
function getLocalizedStringExample(key: string) {
  // implementation...
}

const presentationBackendProps: PresentationProps = {
  getLocalizedString: (key) => getLocalizedStringExample(key),
};

Presentation.initialize(presentationBackendProps);
```

## Localization in presentation rulesets

The strings in presentation rule sets can be localized by using the following format: `@LocalizationNamespace:StringId@`. Additionally, you can use
multiple localized pieces in one string, e.g. `Concat_@Namespace:String1@_and_@Namespace:String2@`. Such strings are then localized using [IModelApp.localization]($frontend)
API using identifier specified between the `@` characters, e.g. `LocalizationNamespace:StringId` for `@LocalizationNamespace:StringId@`.
