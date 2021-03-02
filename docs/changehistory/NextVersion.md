---
publish: false
---
# NextVersion

## New Settings UI Features

The @bentley/ui-core package has added the [SettingsManager]($ui-core) class that allow any number of [SettingsProvider]($ui-core) classes to be registered. These providers provide [SettingsTabEntry]($ui-core) definitions used to populate the [SettingsContainer]($ui-core) UI component with setting pages used to managed application settings. These new classes are marked as beta in this release and are subject to minor modifications in future releases.

## Breaking Api Changes

### @bentley/ui-abstract package

Property `onClick` in [LinkElementsInfo]($ui-abstract) was changed to be mandatory. Also, the first [PropertyRecord]($ui-abstract) argument was removed from the method. Suggested ways to resolve:

- If you have a function `myFunction(record: PropertyRecord, text: string)` and use the first argument, the issue can be resolved with a lambda:

  ```ts
  record.links = {
    onClick: (text) => myFunction(record, text),
  };
  ```

- If you were omitting the `onClick` method to get the default behavior, it can still be achieved by not setting `PropertyRecord.links` at all. It's only valid to expect default click behavior when default matcher is used, but if a custom matcher is used, then the click handled can be as simple as this:

  ```ts
  record.links = {
    onClick: (text) => { window.open(text, "_blank"); },
  };
  ```
