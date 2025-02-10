## Handling of schemas with unknown/wrong elements

A schema with a newer ECXml version might contain elements not recognized by the older ECDb runtime. Additionally, a schema might include incorrect elements, such as an ECProperty tag used to denote a struct inside an entity class. A read-compatible but write-incompatible schema (with only an ECXml minor version increment) cannot be imported into the iModel. However, any schema, except for version 3.2 of the ECXml schema, can be deserialized and loaded into memory. This schema version is also restricted from being serialized to a file or a string.

### Behavior of wrong property types across different versions during deserialization

| Version | Behavior during deserialization |
| - | - |
| Versions older than latest (known to ECDb runtime) | Throws an error |
| Latest Version | Throws an error |
| Versions newer than latest | Defaults to `string` |

### Behavior during deserialization

| Schema Element or Attribute | Behavior during deserialization |
| - | - |
| Unknown class modifier | Defaults to `none` |
| Unknown schema item type | Schema Item gets ignored |
| Unknown attribute in a schema item | The attribute gets ignored |
| Unknown primitive type | Defaults to `string` |
| Unknown property kind | Schema element gets ignored |
| Unknown backing type in ECEnumeration | Defaults to `string` |
| Unknown relationship class strength | Defaults to `referencing` |

### Reading a newer schema already present in a newer iModel

A newer iModel may be containing schemas that are write incompatible due to elements unknown to the ECDb runtime being used.
When reading such a schema with an older ECDb runtime, a reduced form of the schema will be loaded where only the elements the ECDb runtime understands are read.

| Schema Element or Attribute | Behavior when reading from iModel |
| - | - |
| Unknown class modifier | The class and any sub-classes will not be loaded |
| Unknown schema item type | The schema item will not be loaded |
| Unknown attribute in a schema item | The schema item will not be loaded  |
| Unknown primitive type | The property will not be loaded |
| Unknown property kind | The property will not be loaded |
| Unknown backing type in ECEnumeration | The enumeration will not be loaded |
| Unknown relationship class strength | The relationship class and it's corresponding navigation properties will not be loaded |
| Unknown relationship class direction | The relationship class and it's corresponding navigation properties will not be loaded |
| Unknown navigation property direction | The navigation property will not be loaded |
