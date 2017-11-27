# ECObjects-JS

The purpose of this package is to provide all of the necessary Typescript classes to effectively work with ECObjects, specifically the metadata.

## Getting Started

## Contributing

WIP

### Tests

There are several different types of tests within this package:
*  Validation suite of test data against the different Json Schemas defining the specs. The purpose of these test being to make the test data we are using is valid (or invalid), as well as to make sure the spec is accurate and up-to-date. (These should probably be run in a separate CI build, or put in their own package. However, for now live here)
*  Unit tests

#### Test data format

Some types of test data has a specific format to allow dynamic tests.

```json
{
  "name": "Test ECEntityClass with no properties",
  "description": "Th",
  "data": {
    ...
  }
}
```
