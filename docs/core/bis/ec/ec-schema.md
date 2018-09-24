# ECSchema

An ECSchema is the root container of all other ECObject items and provides the namespace for every item it contains. A schema may be referenced by another schema but may not be embedded within another schema. Therefore, namespaces in ECObjects do not have a hierarchy.

## Attributes

**schemaName** the name of the schema and the namespace for the items within the schema. Must be unique within a given system and a valid [ECName](./ec-name.md). Should be human readable and avoid abbreviations where possible.

**alias** A short form of the schema name used when length is an issue.

- The alias follows the same naming rules as the schema name.
- Just like schema names, an alias must be unique within a given system. Unlike schema name if the alias conflicts with another alias, a number will be appended to ensure uniqueness in the current context.
- A schema name is always consistent, but an alias may change in some contexts.

**version** A three number version in the format `RR.WW.mm`, that is `Read.Write.Minor`.

- Incrementing the Read version number indicates that data in the new format can no longer be read using the old schema.
- Incrementing the Write version indicates that the data can still be read using the old schema but it cannot be written.
- Incrementing the minor version indicates a change to the schema that is entirely non-breaking.

**description** An optional and localized plain text description of the schema.

**displayLabel** An optional and localized label for the schema to be shown in the UI

## Sub-Elements

[ECSchemaReference](#ecschemareference) _(0..*)_

[ECCustomAttributes](./ec-custom-attributes.md) _(0..1)_

[ECEntityClass](./ec-entity-class.md) _(0..*)_

[ECMixinClass](./ec-mixin-class.md) _(0..*)_

[ECStructClass](./ec-struct-class.md) _(0..*)_

[ECCustomAttributeClass](./ec-custom-attribute-class.md) _(0..*)_

[ECRelationshipClass](./ec-relationship-class.md) _(0..*)_

[ECEnumeration](./ec-enumeration.md) _(0..*)_

[KindOfQuantity](./kindofquantity.md) _(0..*)_

[PropertyCategory](./property-category.md) _(0..*)_

# ECSchemaReference

Contains all the information to identify a referenced schema.

Circular references are not supported and will result in a failure to load the schemas with cyclic references.

## Attributes

**name** the name of the ECSchema being referenced. Must match the Schema Name of the referenced schema.

**version** The version of the ECSchema being referenced.
- Referenced schemas are located using a 'Latest compatible match' where the read and write versions must match and the minor version of the located schema must be equal to or greater than the version listed in the schema reference

**alias** The alias to use when referring to an item from the referenced schema. This alias generally matches the alias defined in the referenced schema, but may be different. If different, it is only valid within the context of the schema which contains the ECSchemaReference.