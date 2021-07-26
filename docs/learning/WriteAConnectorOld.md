# Write an iModel Connector

## Writing a connector

A connector would import the following packages:

``` ts
[[include:Bridge.imports.example-code]]
```

When the connector runs for the very first time, it would look like the following. This example revolves around the fictitious "RobotWorld" schema. RobotWorld consists of Robots and Barriers. The details of RobotWorld and its schema are not important. The steps, such as importing a schema, reserving codes, pushing changesets, creating definition models, etc., are the important points to see in the example code.

``` ts
[[include:Bridge.firstTime.example-code]]
```

Here is a simple example of a fictitious source data format and the logic to convert and write it to an iModel:

``` ts
[[include:Bridge.source-data.example-code]]
```
