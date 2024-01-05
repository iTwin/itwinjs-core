# Calculated Properties

It is not uncommon for BIS schema designers to face the need to handle properties that can be derived from other data already captured by a BIS schema. In general, there are four approaches to consider while introducing calculated or derived properties, each being more appropropriate than the others depending upon workflow, application and performance requirements. These approaches are:

1. Calculated externally
1. Handled via Presentation Rules
1. Handled via Caches maintained by a Domain library or Application logic
1. Calculated on the fly, shown via Custom User-Interface

## Properties Calculated External to the BIS Repository

This approach is particularly applicable to Connectors, which synchronize derived data already calculated in the external data source. In that case, a Connector needs to make sure to include the calculated properties in its target BIS schema, deferring all the calculation responsibility to the external application that created the data in the first place.

With this approach, calculated property values are captured in the BIS repository, being available to both ECSQL querying as well as standard UX controls such as the Property Pane and Grid.

## Calculated Properties handled via Presentation Rules

iTwin.js contains a very powerful `Presentation` library, commonly referred to as `PresentationRules`. It provides means to declaratively get data from BIS Repositories in a format that is ready to be displayed to end users. Such library can be used to create calculated properties above the BIS schema layer. Please see [Calculated Properties Specification](https://www.itwinjs.org/presentation/content/calculatedpropertiesspecification/) for more information.

This approach is most appropriate for Calculated properties that meet the following criteria:

1. Calculation only involves properties persisted in the same Element
1. Calculation can be expressed as an [ECExpression](https://www.itwinjs.org/presentation/advanced/ecexpressions/) and it is expected to be lightweight to compute
1. Calculated property is expected to be displayed in Standard iTwin.js UX controls such as Property Pane and Grids.
1. No need to access the calculated property via ECSQL

## Cache mantained by a Domain library or Application logic

Another approach to handle a calculated property involves creating it in a BIS schema and storing its calculated values in the BIS repository. As a result, computed values - effectively cached values - can be queried via ECSQL and will be available via standard UX controls.

However, the process of the actual calculation of property values needs careful analysis in order to make sure that the cached values do not become out-of-date. Typically it involves capturing the calculation logic in a location that every data-writer that can target the schema uses to write to it. The calculation logic will typically be part of a domain library if the involved schema is at one of the Standardized layers in BIS, and thus, it is expected to be shared. Or it will be part of the Application's logic if the calculated property is part of an Application schema.

This approach is most appropriate for Calculated properties that meet the following criteria:

1. Calculation is expected to be more costly either because it requires joining data from separate Elements or due to the complexity of the computation itself
1. Calculated properties are expected to be displayed in Standard iTwin.js UX controls such as Property Pane and Grids
1. Calculated values need to be queried via ECSQL

## Calculated properties handled via a custom User-Interface

In some cases, a calculated property is very specialized to a particular domain workflow that it needs of a custom User Interface to present it correctly to users. If the calculation itself is inexpensive and its result does not need to be queried via ECSQL, doing it on the fly when needed may be the best solution. It avoids the storage overhead and caching complexities that the previous approaches bring with them.

In summary, this approach is most appropriate for Calculated properties that meet the following criteria:

1. Calculation is lightweight
1. Calculated values are _not_ expected to be displayed in Standard iTwin.js UX controls such as Property Pane and Grids.
1. No need to access the calculated property via ECSQL
