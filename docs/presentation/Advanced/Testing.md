# Testing

Although the presentation framework itself is thoroughly tested, consumers should still verify they get expected results for their iModel + ruleset combinations. The **@itwin/presentation-testing** package is delivered
purely for that reason.

The package delivers an API that allows creating hierarchies for supplied iModels and rulesets. Consumers can then verify the result using tools of their liking. Our recommendation is to use snapshot testing for 2 reasons:

1. Resulting hierarchies get rather large — testing them in code might be difficult.
2. Snapshots protect against regressions.

## Example

An example of setting up snapshot tests with the **@itwin/presentation-testing** package:

1. Initialize testing library and open iModel

    ```ts
    [[include:Presentation.Testing.Rulesets.Setup]]
    ```

2. Generate and verify results:

    2.1. Hierarchies:

      ```ts
      [[include:Presentation.Testing.Rulesets.Hierarchies]]
      ```

    2.2. Content:

      ```ts
      [[include:Presentation.Testing.Rulesets.Content]]
      ```

3. Close iModel and terminate testing library:

    ```ts
    [[include:Presentation.Testing.Rulesets.Terminate]]
    ```

**Note:** The above example uses [mocha](https://www.npmjs.com/package/mocha) and [chai-jest-snapshot](https://www.npmjs.com/package/chai-jest-snapshot) packages to perform snapshot testing. `createSnapshotPath` function retrieves a path to the snapshot for the current test.

## Things to keep in mind

- Run initialize() before and terminate() after the tests.
- Don't forget to close the iModel connection.
- Ruleset can be provided either as an ID of already registered ruleset or as a `Ruleset` object. The object can even be imported from a JSON file:

  ```ts
  await builder.createHierarchy(require("rulesets/YourRuleset.json"))
  ```
