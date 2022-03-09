# Change Log - @itwin/core-transformer

This log was last generated on Thu, 24 Feb 2022 15:26:55 GMT and should not be manually modified.

## 3.0.1
Thu, 24 Feb 2022 15:26:55 GMT

### Updates

- add ignoreDeadPredecessors option to transformer, deprecate direct importer options access
- Upgrade target to ES2019
- rename contextId -> iTwinId
- rename to @itwin/core-transformer
- remove ClientRequestContext and its subclasses
- removed deprecated API surface
- remove ClientRequestContext.current
- Renamed all occurrences of the term revision0 to version0.
- remove requestContext argument from importSchemas
- create new imodel-transformer package separate from backend package
- fix bug where element aspect export could be mishandled when the element was deferred
- add preserveElementIdsForFiltering option for transformations

## 3.0.0
Fri, 20 Aug 2021 20:34:29 GMT

### Updates

- Initial release

