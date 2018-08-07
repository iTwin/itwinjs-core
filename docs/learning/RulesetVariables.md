# Ruleset Variables

**Note:** *User Settings* is a deprecated name of the *Ruleset Variables* concept.

Presentation rulesets have a concept called *ruleset variables* whose purpose is
to allow modifying ruleset behavior during the session without having to change
the ruleset itself. The values of ruleset variables can be accessed using
[ECExpressions](./ECExpressions.md#ruleset-variables-user-settings).

## User-Controllable Variables

**Note:** this feature is not fully supported yet - there is no UI component for
editing user-defined ruleset variables.

There can be either internal variables or user-controllable ones. Internal
variables are not visible to end users and can only be changed using API calls.
User-controllable variables are defined in the ruleset with pre-defined default
values and may be modified by end users through some UI component.

## Examples

Specifying user-controllable ruleset variable in a ruleset:
```JSON
{
  "id": "ruleset_id",
  "rules": [],
  "vars": [{
    "label": "Variables group label",
    "vars": [{
      "id": "boolean_var_id",
      "type": "ShowHide",
      "label": "Show someything?"
    }, {
      "id": "string_var_id",
      "type": "StringValue",
      "label": "Filtering value"
    }, {
      "id": "int_var_id",
      "type": "IntValue",
      "label": "Minimum value"
    }],
  }]
}
```

Using ruleset variable in a rule condition:
```JSON
{
  "id": "ruleset_id",
  "rules": [{
    "ruleType": "LabelOverride",
    "condition": "GetVariableBoolValue(\"should_prefix_hidden_items\") ANDALSO this.IsHidden",
    "label": "\"Hidden: \" & this.MyLabel",
  }]
}
```

Using ruleset variable in a customization rule value:
```JSON
{
  "id": "ruleset_id",
  "rules": [{
    "ruleType": "LabelOverride",
    "label": "GetVariableStringValue(\"custom_prefix\") & this.MyLabel",
  }]
}
```

Using ruleset variable in specification instance filter
```JSON
{
  "id": "ruleset_id",
  "rules": [{
    "ruleType": "Content",
    "specifications": [{
      "specType": "ContentInstancesOfSpecificClasses",
      "classes": { "schemaName": "MySchema", "classNames": ["MyClass"] },
      "instanceFilter": "this.MyValue >= GetVariableIntValue(\"minimum_value\")"
    }]
  }]
}
```
