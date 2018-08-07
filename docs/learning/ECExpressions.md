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

### Ruleset Variables (User Settings)

**Note:** *User Settings* is a deprecated name of *Ruleset Variables* concept.

Ruleset variable access symbols allow accessing variable values through ECExpressions.

Symbol                            | Deprecated Symbol               | Type    | Value
----------------------------------| --------------------------------|---------|----------
`GetVariableStringValue("var_id")`| `GetSettingValue("var_id")`     | string  | Get string value of a variable with the specified ID
`GetVariableBoolValue("var_id")`  | `GetSettingBoolValue("var_id")` | bool    | Get boolean value of a variable with the specified ID
`GetVariableIntValue("var_id")`   | `GetSettingIntValue("var_id")`  | number  | Get int value of a variable with the specified ID
`GetVariableIntValues("var_id")`  | `GetSettingIntValues("var_id")` | number[]| Get int [value list](#value-lists) of a variable with the specified ID
`HasVariable("var_id")`           | `HasSetting("var_id")`          | bool    | Does variable with the specified ID exist

### Other symbols

Symbol                                | Type     | Value
--------------------------------------|----------|----------
`Set(number1, number2, ..., numberN)` | number[] | Create a [value list](#value-lists) of the supplied numbers.

## Value Lists

Value lists in ECExpressions can be handled with lambdas. Currently the
presentation rules engine supports only a single simple lambda for
value lists:
```
value_list.AnyMatch(x => x = this.PropertyValue)
```
The above expression returns `true` if `value_list` contains the value
of `this.PropertyValue`.
