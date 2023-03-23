# FederationGuids

Every BIS `Element` has an optional 128 bit [Globally Unique Identifier](https://en.wikipedia.org/wiki/Universally_unique_identifier) called `FederationGuid`. It is really identifying the real-world Entity that the Element represents, not the Element itself. Generally it is intended that FederationGuids are assigned by external systems to *federate* Elements to their external meaning.

## Scope of Uniqueness

Assigned FederationGuids are enforced to be unique on a single BIS Repository. However, multiple BIS Repositories can use the same FederationGuid in order to refer to the same real-world Entity.

Therefore, the [Code](./codes.md) of Elements with the same FederationGuid across multiple BIS Repositories is typically the same, unless such Code is enforced to be unique across all BIS Repositories in an iTwin.

## Modeling Perspectives and Granularities

Note that a FederationGuid is implicitly representing a real-world Entity at a particular granularity and modeling-perspective. Thus, Elements that represent the same real-world Entity across different modeling perspectives are expected to get assigned different FederationGuids. That is, if a real-world Entity is modeled Physically, Functionally and Analytically, Elements that represent it on each one of those modeling perspectives are expected to get assigned a different FederationGuid.

The same expectation applies for the modeling of a real-world Entity at different granularities. That is, if the same real-world Entity is modeled as an aggregation of finer-granularity Elements, via any technique described in [Information Hierarchy](../data-organization/information-hierarchy.md#hierarchy-constructs), each one of those Elements is expected to get assigned a different FederationGuid than the one of the Entity as a whole.

## Element External Identification

When stored in an iModel, an Element receives a unique `FederationGuid` if it is not assigned one by its data-writer. This behavior enables the FederationGuid of an Element to be used as a stable identifier that systems external to its iModel can utilize to reference it.

This way an Element can be deleted and recreated in a BIS Repository, which will likely change its [ElementId](./element-fundamentals.md#elementids-in-imodels) in the iModel, but it will not impact any external systems that reference it, as long as its FederationGuid is preserved.

---
| Next: [ElementAspect Fundamentals](./elementaspect-fundamentals.md)
|:---
