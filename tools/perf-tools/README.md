# @itwin/perf-tools

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Report

`Reporter.ts` provides a way to report performance test results. The following are fields for reports:

|    Name     | Description                                      |  Type   |
|:-----------:|--------------------------------------------------|:-------:|
| `testSuite` | Name of the test suite that is being run         | `string`|
| `testName`  | The particular test that is being reported       | `string`|
| `valueName` | The name/description of the value being recorded | `string`|
|  `value`    | The actual value of the test                     | `number`|
|   `info`    | A JSON object for additional details             |  `any`  |
