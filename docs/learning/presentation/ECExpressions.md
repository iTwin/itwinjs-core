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

## ECExpression Syntax

### Data types

`ECExpressions` contain values of primitive types or data type of `ECClass` or `ECArray`.

#### Primitive value types

Type            | Description                 | Example
----------------|-----------------------------|--------------
Boolean         | Boolean (true/false) value  | `True`, `False`
DateTime        | Date and time in ticks      | `@1549278124937`
Integer (Long)  | 32-bit (64-bit) number      | `1`
Double          | Floating point number       | `6.84`
String          | String of characters        | `""` ,`"Dog and Cat"`
Null            | Null value                  | `Null`

#### Other primitive types

Type            | Description
----------------|-----------------------------
Binary          | Array of bytes
Point2d         | 2D point containing X and Y components as double values
Point3d         | 3D point containing X, Y and Z components as double values
IGeometry       | A common geometry value of any type

#### ECClass data type

`ECClass` data types define `ECInstances`. `ECClasses` contain `ECProperties` and Methods which can be accessed via dot (`.`) operator.

#### ECArray data type

`ECArray` data types define arrays of values. Each value can be accessed via `[]` operator.

### Expression components

In addition to values of primitive types `ECExpressions` may contain symbols and operators

#### Symbols

Symbols are used to supply values to expression evaluator. Symbols can be supplied from `ECInstance` via an access string, from an application defined value or from application defined method.
Access string is a limited expression that holds no blanks, no operators, and no variable portions. It may contain array indexing and member selection using `[]` or dot `.` operators, but no part of the expression can be variable, and the access string cannot contain embedded blanks.

##### Property symbols

`ECInstance` Property symbols supply Property values of some `ECInstance` when the symbol is being evaluated.

```
this.PropertyName
this.StructPropertyName.PropertyName
this.StructArray[5].Struct.PropertyName
```

##### Value symbols

Value symbols supply some named predefined value in a context.

```
System.Math.PI
```

##### Method symbols

Method symbols supply a named method in a context.

```
System.Math.Sin(1.57)
this.IsOfClass("ClassName", "SchemaName")
```

##### Value Lists

Value lists in ECExpressions are iterable containers and can be handled with [lambdas](#lambda-operator). Currently presentation rules
engine supports only a single simple lambda for value lists, `AnyMatches`, which checks if any of the items in the value list passes given condition. Examples:

```
value_list.AnyMatches(x => x = this.PropertyValue)
value_list.AnyMatches(x => this.PropertyValue = x)
value_list.AnyMatches(x => this.IsOfClass(x.PropertyValue))
```

#### Operators

##### Parentheses `(`,`)`

```
(2 * (3 + 4))
```

##### Logical operators

Description           | Operator
----------------------|--------------
Conjunction           | `And`*, `AndAlso`
Disjunction           | `Or`*, `OrElse`
Exclusive disjunction | `Xor`
Negation              | `Not`

**Note:** *Checks right side of expression even if result value can be deducted from the left side.

```
False And True OrElse True
```

##### Comparison operators

Description               | Operator
--------------------------|--------------
Less than                 | `<`
Less than or equal to     | `<=`
Greater than              | `>`
Greater than or equal to  | `>=`
Equal to                  | `=`
Not equal to              | `<>`

```
20 < 10 ==> False
```

##### Arithmetic operators

Description       | Operator
------------------|--------------
Exponentation     | `^`
Multiplication    | `*`
Double division   | `/`
Integer division  | `\`
Modular division  | `Mod`
Addition          | `+`
Subtraction       | `-`

```
1 + "4"   ==> 5
2.2 * 3   ==> 6.6
12 / 5    ==> 2.4
12 \ 5    ==> 2
25 Mod 3  ==> 1
```

##### Bit Shift operators

Description         | Operator
--------------------|--------------
Signed shift left   | `<<`
Signed shift right  | `>>`
Unsigned shift right| `>>>`

```
5 << 1      ==>  10
24 >> 2     ==>  6
-105 >> 1   ==>  -53
-105 >>> 1  ==>  75
```

##### Conditional operator

```
IIf (condition, true-result, false-result)
```

Returns result based on given condition. If condition evaluates to true, returns `true-result`. Otherwise returns `false-result`.

```
IIf (500>200, "Math ok", "Math wrong") ==> "Math ok"
IIf (500<200, "Math ok", "Math wrong") ==> "Math wrong"
```

##### Concatenation operator

```
"Dog" & " and " & "Cat" ==> "Dog and Cat"
"1" & 4                 ==> "14"
1 & "4"                 ==> "14"
```

##### Lambda operator

Lambda operator `=>` creates a callback expression for a given symbol.

```
MyArray.Find(item => item.IntProperty = 5)
```

### Combined expressions

```
System.Math.Cos (System.Math.PI * 45.0 / 180.0) ==> 0.707
System.String.Length ("Dog" & " and " & "Cat") ==> 11
```

### Evaluating if property is `Null`

Method `IsNull (value)` evaluates if given value is `Null`.

Method `IfNull (value, value-if-null)` evaluates to `value` if it is not null, otherwise evaluates to  `value-if-null`.

In case `this.MiddleName` is null:

```
IfNull (this.MiddleName, "") ==> ""
IIf (Not IsNull(this.MiddleName), " " & this.MiddleName & " ", "") ==> ""
```

In case `this.MiddleName` is set to `"Harvey"`

```
IfNull (this.MiddleName, "") ==> "Harvey"
IIf (Not IsNull (this.MiddleName), " " & this.MiddleName & " ", "") ==> " Harvey "
```

Checking to see if a `this.MiddleName` is `Null` or empty

```
IIf (IsNull (this.MiddleName) or this.MiddleName = "", "Is null or empty", "Has a value")
```

## ECExpression Contexts

### NavNode

Symbol                    | Type    | Value
--------------------------|---------|----------
`IsNull`                  | bool    | Is this context null
`Type`                    | string  | Type of the node
`Label`                   | string  | Node label
`Description`             | string  | Node description
`ClassName`               | string  | ECClass name if its an EC-related node
`ClassLabel`              | string  | ECClass display label if its an EC-related node
`SchemaName`              | string  | ECSchema name if its an EC-related node
`SchemaLabel`             | string  | ECSchema display label if its an EC-related node
`SchemaMajorVersion`      | number  | ECSchema major version if its an EC-related node
`SchemaMinorVersion`      | number  | ECSchema minor version if its an EC-related node
`InstanceId`              | number  | ECInstance ID if its an ECInstance node
`IsInstanceNode`          | bool    | Is this an ECInstance node
`IsClassGroupingNode`     | bool    | Is this an ECClass grouping node
`IsPropertyGroupingNode`  | bool    | Is this an ECProperty grouping node
`GroupedInstancesCount`   | number  | Count of grouped ECInstances (only available for ECClass and ECProperty grouping nodes)
`ECInstance`              | [ECInstance context](#ecinstance) | ECInstance symbol context if its an ECInstance node
`HasChildren`             | bool    | Does this node have any children
`ChildrenArtifacts`       | object[] | A [value list](#value-lists) of objects generated using the [NodeArtifacts](./Hierarchies/NodeArtifactsRule.md) customization rule on child nodes. Child nodes in this case are immediate child nodes that are not necessarily visible.

### ECInstance

ECInstance expression context provides access to ECInstance property values.
Example:

```
this.PropertyName
this.StructPropertyName.PropertyName
this.StructArray[1].Struct.PropertyName
```

Additionally, when evaluating ECInstance contexts, the below symbols are available:

Symbol                              | Type    | Value
------------------------------------|---------|----------
<code>GetRelatedInstancesCount("RelationshipSchemaName:RelationshipName", "Forward&#124;Backward", "RelatedClassSchemaName:RelatedClassName")</code> | number | Number of related instances following the specified relationship
<code>GetRelatedInstancesCount("RelatedClassSchemaName:RelatedClassName", lambda_for_filtering_related_instances)</code> | number | Number of related instances that match criteria described by given [lambda](#lambda-operator)
<code>HasRelatedInstance("RelationshipSchemaName:RelationshipName", "Forward&#124;Backward", "RelatedClassSchemaName:RelatedClassName")</code> | bool | Does this instance has a related instance following the specified relationship
<code>HasRelatedInstance("RelatedClassSchemaName:RelatedClassName", lambda_for_filtering_related_instances)</code> | bool | Does this instance has a related instance that matches criteria described by given [lambda](#lambda-operator)
<code>GetRelatedValue("RelationshipSchemaName:RelationshipName", "Forward&#124;Backward", "RelatedClassSchemaName:RelatedClassName", "PropertyName")</code> | any | Returns property value of the related instance
<code>GetRelatedValue("RelatedClassSchemaName:RelatedClassName", lambda_for_filtering_related_instances, "PropertyName")</code> | any | Returns property value of related instance that matches criteria described by given [lambda](#lambda-operator)
<code>IsOfClass("SchemaName", "ClassName"))</code> | bool | Returns <code>true</code> if the instance is of a class with given schema and class names
<code>IsOfClass(SomeECClassId))</code> | bool | Returns <code>true</code> if the instance is of a class with specified ECClass ID

Deprecated symbols:

Symbol                              | Type    | Value
------------------------------------|---------|----------
<code>GetRelatedInstance("RelationshipName:0&#124;1:RelatedClassName")</code> | [ECInstance context](#ecinstance) | Returns related instance context. **Not available when evaluating instance filters.**

### ECInstance Key

ECInstance key expression context provides access to class and instance IDs. The context has the following symbols:

Symbol         | Type    | Value
---------------|---------|----------
`ECClassId`    | number  | ID of ECInstance's ECClass
`ECInstanceId` | number  | ID of ECInstance

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
`GetFormattedValue(this.MyProp, "Metric\|UsCustomary\|UsSurvey\|BritishImperial")` | any | Returns property value formatted using specified unit system. If unit system is not specified default presentation units are used to format value

## Formatted property values

Comparison of formatted property values in ECExpressions can be done using
`GetFormattedValue` function. Specific unit system can be passed as a second argument
to function or omitted to use default presentation format:

```
GetFormattedValue(this.Length, "Metric") = "10.0 m"
GetFormattedValue(this.Length) = "10.0 m"
```
