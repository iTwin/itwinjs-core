## Handling of schemas with unknown/wrong elements

All schemas using the current or older ECXml versions will fail to deserialize if they encounter incorrect or unknown property tags.
When this occurs, an error will be logged, clearly stating the cause of failure and explaining that deserialization process cannot proceed
due to the unrecognized properties.

### Behavior of wrong property tags across different versions during deserialization

| Version | Behavior during deserialization |
| - | - |
| Versions older than latest (known to ECDb runtime) | Throws an error |
| Latest Version | Throws an error |
