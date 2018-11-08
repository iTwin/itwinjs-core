# 0.164.0 Change Notes

## Breaking changes to DisplayStyles

The JSON representation of [DisplayStyle]($backend) and [DisplayStyleState]($frontend) expressed by the [DisplayStyleProps]($common) interface did not match the actual persistent JSON representation. Additionally, `DisplayStyle` provided no API for querying or modifying most of its settings.

To address these problems the following changes were made:

- [DisplayStyleSettingsProps]($common) and [DisplayStyle3dSettingsProps]($common) were added to document the persistent JSON representation of a `DisplayStyle`'s settings.
- Various JSON types used by `DisplayStyleSettingsProps` were moved from imodeljs-frontend to imodeljs-common; and new ones were added.
- `DisplayStyleProps` and `DisplayStyle3dProps` were modified to reflect the persistent JSON representation: specifically, the presence of a `jsonProperties.styles` object to store the settings.
- [DisplayStyleSettings]($common) and [DisplayStyle3dSettings]($common) classes were added to provide access to all of the settings and to keep the JSON properties in sync with modifications to those settings.
- A `DisplayStyleSettings` member was added to `DisplayStyle` and `DisplayStyleState`.
