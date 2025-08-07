# PropertyCategory

PropertyCategories provide a way to group like properties across the boundary of the ECClasses where the properties are defined. The extra classification allows the designer of the properties to give extra information about the importance and how it relates to other properties within, and outside, of its ECClass.

## Attributes

**typeName** defines the name of this PropertyCategory. Must be a valid [ECName](./ec-name.md) and be unique among all other items in a schema.

**description** is a user facing description of the PropertyCategory. Localized and may be shown in an UI.

**displayLabel** is a localized display label that will be used instead of the name in an UI.

**priority** is used to identify the importance of the category. May be used when showing properties from the category in an UI.

```xml
<PropertyCategory typeName="ProfileProperties" priority="1" displayLabel="Profile Properties" description="Properties of a Structural Profile." />

<ECEntityClass typeName="Profile" modifier="Abstract" description="A resource defining one or more 2D areas that may have voids.">
    <BaseClass>bis:DefinitionElement</BaseClass>
    <ECProperty propertyName="Name" typeName="string" category="ProfileProperties" />
</ECEntityClass>
```

```json
"ProfileProperties": {
  "schemaItemType": "PropertyCategory",
  "label": "Profile Properties",
  "description": "Properties of a Structural Profile.",
  "priority": 1
},
"Profile": {
  "schemaItemType": "EntityClass",
  "description": "A resource defining one or more 2D areas that may have voids.",
  "modifier": "Abstract",
  "baseClass": "BisCore.DefinitionElement",
  "properties": [
    {
      "name": "Name",
      "type": "PrimitiveProperty",
      "category": "Profiles.ProfileProperties",
      "typeName": "string"
    }
  ]
},
```
