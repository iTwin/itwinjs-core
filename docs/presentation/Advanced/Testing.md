# Testing

Although the presentation framework itself is thoroughly tested, consumers
should still verify they get expected results for their iModel + ruleset
combinations. The **@itwin/presentation-testing** package is delivered
purely for that reason.

The package delivers an API that allows creating hierarchies for supplied
iModels and rulesets. Consumers can then verify the result using tools of
their liking. Our recommendation is to use snapshot testing for 2 reasons:

1. resulting hierarchies get rather large - testing the them in
code might be difficult
2. snapshots protect against regressions

## Example

An example of setting up snapshot tests with the **@itwin/presentation-testing** package:

``` ts
[[include:Presentation.Testing.Rulesets]]
```

## Things to keep in mind

- Run initialize() before and terminate() after the tests
- Don't forget to close the iModel connection
- Ruleset can be provided either as an ID of already registered ruleset or
  as a `Ruleset` object. The object can even be imported from a JSON file:

  ```ts
  await builder.createHierarchy(require("rulesets/YourRuleset"))
  ```
