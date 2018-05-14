# ECExpressions

ECExpressions is a very basic language that allows customizing presentation
rules' behavior.

Symbols that can be used depend on current context. Example:
```
this.GetContextB().ContextC.DoSomething()
```
Here, symbol `this` returns a context which has a function symbol
`GetContextB()`. This function returns a context which has a property
symbol `ContextC`. And the property value is a context that contains a
function symbol `DoSomething()`. The latter function might return some value
or return nothing, but instead do some action - it all depends on the symbol.

## ECExpression Contexts

### NavNode

Symbol                    | Type    | Value
--------------------------|---------|----------
`IsNull`                  | bool    | Is this context null
`Type`                    | string  | Type of the node
`Label`                   | string  | Node label
`Description`             | string  | Node description
`ClassName`               | string  | ECClass name if its an EC-related node
`SchemaName`              | string  | ECSchema name if its an EC-related node
`SchemaMajorVersion`      | number  | ECSchema major version if its an EC-related node
`SchemaMinorVersion`      | number  | ECSchema minor version if its an EC-related node
`InstanceId`              | number  | ECInstance ID if its an ECInstance node
`IsInstanceNode`          | bool    | Is this an ECInstance node
`IsClassGroupingNode`     | bool    | Is this an ECClass grouping node
`IsPropertyGroupingNode`  | bool    | Is this an ECProperty grouping node
`GroupedInstancesCount`   | number  | Count of grouped ECInstances (only available for ECClass and ECProperty grouping nodes)
`ECInstance`              | [ECInstance context](#ecinstance) | ECInstance symbol context if its an ECInstance node

### ECInstance

ECInstance expression context provides access to ECInstance property values.
Example:
```
this.PropertyName
this.StructPropertyName.PropertyName
this.StructArray[1].Struct.PropertyName
```

Additionally, when evaluating ECInstance contexts, the below symbols are
available:

Symbol                              | Type    | Value
------------------------------------|---------|----------
<code>GetRelatedInstance("RelationshipName:0&#124;1:RelatedClassName")</code> | [ECInstance context](#ecinstance) | Returns related instance context
<code>HasRelatedInstance("RelationshipSchemaName:RelationshipName", "Forward&#124;Backward", "RelatedClassSchemaName:RelatedClassName")</code> | bool | Does this instance has a related instance following the specified relationship
<code>GetRelatedValue("RelationshipSchemaName:RelationshipName", "Forward&#124;Backward", "RelatedClassSchemaName:RelatedClassName", "PropertyName")</code> | any | Returns property value of the related instance

## Symbols in Global Context

### User Settings

User settings symbols allow accessing user setting values through
ECExpressions.

Symbol                              | Type    | Value
------------------------------------|---------|----------
`GetSettingValue("setting_id")`     | string  | Get value of a setting with the specified ID
`GetSettingIntValue("setting_id")`  | number  | Get value of a setting with the specified ID
`GetSettingIntValues("setting_id")` | number[]| Get value of a setting with the specified ID
`GetSettingBoolValue("setting_id")` | bool    | Get value of a setting with the specified ID
`HasSetting("setting_id")`          | bool    | Does setting with the specified ID exist

Value lists in ECExpressions can be handled with lambdas. Currently the
presentation rules engine supports only a single simple lambda for
`GetSettingIntValues` function:
```
GetSettingIntValues("setting_id").AnyMatch(x => x = this.PropertyValue)
```
The above expression returns `true` if `GetSettingIntValues("setting_id")`
contains the value of `this.PropertyValue`.
