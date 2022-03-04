# ECSchema upgrade support

iModel allow existing schema to be upgraded to new version. The the new version of schema is limited to certain type of changes in schema. Not all schema changes are supported. Though as we go we support more type of schema changes during schema upgrade and this document will be updated to show which kind of schema changes are supported in different version of itwinjs-core.

>NOTE: As rule of thumb all additive changes to schema. For example adding new class, a property to existing class or adding custom attributes etc.
>There are limitation on destructive changes where something is deleted or updated.

## Incremental schema upgrade

Following table document rules for schema upgrade by type of object and the operation on that object.

> NOTE: All destructive changes like deleting a schema, class or property that can cause change to persistence layer require that schema **Read version number** to be incremented. All none destructive changes require that you should increment **Write version number** or **Minor version number** as required.

* :heavy_check_mark: indicates operation is supported
* :heavy_check_mark::grey_exclamation: indicates operation is supported with some limitation.
* :x: indicates operation is not currently supported.
<!-- markdownlint-disable-file MD033 -->
| Change        |Operation |Supported          | Description  |
|---------------|----------|-------------------|--------------|
| Schema        | Add      |:heavy_check_mark:                     | .|
| Schema        | Delete   |:x:                                    | Its not supported via import schema.|
| Schema        | Update   |:heavy_check_mark::grey_exclamation:   | Supported with limitations.<table><tbody><tr><td>name</td><td>:x:</td></tr><tr><td>displayLabel</td><td>:heavy_check_mark:</td></tr><tr><td>description</td><td>:heavy_check_mark:</td></tr><tr><td>[custom attributes](#update_ca)</td><td>:heavy_check_mark::grey_exclamation:</td></tr></tbody></table>|
| EntityClass   | Add     | :heavy_check_mark:| |
| EntityClass   | Delete     | :x:| |
| EntityClass   | Update     | :heavy_check_mark::grey_exclamation:|<table><tbody><tr><td>name</td><td>:x:</td></tr><tr><td>displayLabel</td><td>:heavy_check_mark:</td></tr><tr><td>description</td><td>:heavy_check_mark:</td></tr><tr><td>[custom attributes](#update_ca)</td><td>:heavy_check_mark::grey_exclamation:</td></tr><tr><td>[base classes/mixins](#update_mixins)</td><td>:heavy_check_mark::grey_exclamation:</td></tr></tbody></table>
| Property   | Add     | :heavy_check_mark:| |
| Property   | Delete     | :x:| |
| Property   | Update     | :heavy_check_mark::grey_exclamation:|<table><tbody><tr><td>name</td><td>:x:</td></tr><tr><td>displayLabel</td><td>:heavy_check_mark:</td></tr><tr><td>description</td><td>:heavy_check_mark:</td></tr><tr><td>[custom attributes](#update_ca)</td><td>:heavy_check_mark::grey_exclamation:</td></tr><tr><td>type</td><td>:x:</td></tr><tr><td>kind of quantity</td><td>:heavy_check_mark:</td></tr><tr><td>category</td><td>:heavy_check_mark:</td></tr><tr></tbody></table>
| StructClass   | Add     | :heavy_check_mark:| |
| StructClass   | Delete     | :x:| |
| CustomAttributeClass   | Add     | :heavy_check_mark:| |
| CustomAttributeClass   | Delete     | :x:| |

### Updating BaseClasses for EntityClass Rules<a id='update_mixins'></a>

A EntityClass can have only one *BaseClass* of type EntityClass. It can also have zero or more Mixins. A Mixin is define similar to entity class but have addition custom attribute called <code>IsMixIn</code>. Mixin are not directly mapped. Its properties if any is merge into EntityClass that implement (inherits) from it. In some cases Mixins can be added or delete from base class list of a EntityClass but in other it cannot.

| Type of BaseClass | Operation | Supported| Description|
|---------------|----------|------------------|------
|EntityClass | Update, Delete | :x: | Base class cannot be changed|
|Mixin without properties | Add, Delete | :heavy_check_mark: | |
|Mixin with properties | Add. Delete | :warning: | *Mix with properties is add only*<table><tbody><tr><td>add new mixin </td><td>:heavy_check_mark:</td><tr><td>delete existing mixin </td><td>:x:</td></tbody></table>|

### Updating CustomAttributes Rules<a id='update_ca'></a>

Following mapping custom attributes are not allowed to update with exception to <code>DbIndexList</code>.
| Schema        | CustomAttribute Class | Operation  | Supported  | Description|
|---------------|----------|------------------|--------------|--------------|
| ECDbMap | SchemaMap| Update, Delete|:x:| No change allowed.
| ECDbMap | ClassMap| Update, Delete|:x:| No change allowed.
| ECDbMap | JoinedTablePerDirectSubclass| Update, Delete|:x:| No change allowed.
| ECDbMap | ShareColumns| Update, Delete|:x:| No change allowed.
| ECDbMap | PropertyMap| Update, Delete|:x:| No change allowed.
| ECDbMap | ForeignKeyConstraint| Update, Delete|:x:| No change allowed.
| ECDbMap | LinkTableRelationshipMap| Update, Delete|:x:| No change allowed.
| ECDbMap | DbIndexList| Update, Delete|:heavy_check_mark::grey_exclamation:| Only non-unique indexes are allowed to be added or deleted.
