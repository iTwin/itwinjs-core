# Mixins

Mixins play a key role in supporting cross-discipline coordination in BIS.

A Mixin is an abstract EC class that follows a strict set of requirements that are intended to provide the desired functionality while minimizing confusion and implementation costs. The requirements may be relaxed in the future if use cases supporting relaxation are found. The requirements for a Mixin class are as follows:

1. Mixins are abstract EC Entity classes.
2. Mixins may have 0 or 1 base classes. If there is a base class, it must be another Mixin.
3. Mixins must have the IsMixin custom attribute defined.
4. Mixins may not override an inherited property.

The Mixin custom attribute is defined as follows:

```xml
<ECCustomAttributeClass typeName="IsMixin" description="Applied to abstract ECEntityClasses which serve as secondary base classes for normal ECEntityClasses." displayLabel="Is Mixin" appliesTo="EntityClass" modifier="Sealed" >
    <ECProperty propertyName="AppliesToEntityClass" typeName="string" description="This mixin may only be applied to entity classes which derive from is class.  Class Name should be fully specified as 'alias:ClassName'" />
</ECCustomAttributeClass>
```

A class incorporates a Mixin by declaring the Mixin class as a base class. A Mixin is never the first base class listed (that position is reserved for the “real” base class). A class may implement multiple Mixins, but may only have one “real” base class. Classes that incorporate Mixins must also follow strict rules:

1. The incorporating class must descend from the AppliesToEntityClass defined in the IsMixin custom attribute.
2. The implementing class must not have an inherited property that has the same name as a Mixin property.

In general, prefer propertyless Mixins for relationship endpoints and cross-hierarchy classification. Property-bearing Mixins are supported, but querying their properties can introduce additional preparation and execution costs. Evaluate the expected queries and implementing classes before introducing properties in a Mixin.

By convention, interface-like Mixin classes have class names with an “I” prefix. Interface-like Mixins satisfy one or more of the following criteria:

1. The Mixin is expected to be used as a relationship endpoint.
2. The Mixin is expected to be used by code or logic that will not know which class has incorporated the Mixin.
3. The Mixin has no properties and is used as a *marker* class.

## Query performance

A Mixin defines a common interface, not a common physical table or a guarantee that its properties occupy the same columns in every implementing class. In particular, the same Mixin property can occupy different shared columns in different classes.

When translating a polymorphic Mixin query, ECDb groups implementing classes whose generated physical SELECTs are identical. It combines distinct groups with `UNION ALL`:

- **Best case:** the required properties map identically in the same table. Classes can share one SELECT, with no UNION.
- **Worst case for branch count:** every implementing class requires a distinct SELECT. N classes produce N branches joined by N-1 `UNION ALL` operators.

The number of implementing classes alone does not determine the number of branches. Physical mapping and the properties needed by the query matter. Selecting only instance identities may produce fewer branches than selecting Mixin properties. Propertyless Mixins avoid the differing-property-column issue, but do not guarantee a single SELECT across different tables or mappings.

### Preparation, filtering and ordering

More branches mean more SQL to generate and prepare. Execution also depends on the access paths and result size:

- `WHERE` predicates can require work in many branches, even when few rows are returned.
- `ORDER BY` can introduce branch-local sorts and merge operations to produce a globally ordered result.
- Appropriate existing indexes can reduce scanning, but do not eliminate SQL generation, preparation or all sorting costs.
- `UNION ALL` does not remove duplicates; duplicate elimination is not the cause of this overhead.

Preparation and full-result consumption should be measured separately. A query that returns many rows can spend much of its end-to-end time transferring and reading results, making the relative UNION overhead less visible. Conversely, preparation can be significant for frequently prepared queries that return few rows. Reading only the first row does not measure complete execution.

### Compound-SELECT limit

Generated UNIONs are subject to the SQLite compound-SELECT limit in the deployed native runtime. With a limit of **500 SELECT terms**, 500 branches use 499 UNION operators; a query requiring 501 branches fails during preparation with `too many terms in compound SELECT`.

This is a limit on the generated compound SELECT, **not a limit of 500 classes implementing a Mixin**. A Mixin with more implementing classes can still be queried when their mappings collapse into fewer branches. Do not assume that adding a selective `WHERE` clause or a `LIMIT` avoids a preparation-time limit.

### Measuring an application workload

Use representative schemas, class counts, property distributions and result sizes. Inspect the generated SQL and query plan to verify branch counts and index use rather than inferring them from the schema alone. Include plain reads, property filters, sorting, and combined filtering and sorting. Measure both preparation and complete result consumption under the application's expected statement-reuse behavior.

The repository's `MixinQueryPerf.test.ts` benchmark compares same-table BIS mappings with matching table and index definitions. Run `rushx build` followed by `rushx perftest:mixinQuery` from `full-stack-tests/backend`. Its output includes timings, generated schemas, SQL, query plans and runtime information.

For illustration, two runs with 100,000 instances and 500 implementing classes on native addon 5.16.1 showed roughly four times the preparation cost for differing mappings. Full-result filtering plus sorting was about 13-15% slower, while unfiltered reads differed little. These are warm-connection, JavaScript-inclusive measurements, not a general performance guarantee. The synthetic values correlate with implementing classes, and populated column positions differ between mappings; use application-specific measurements before extrapolating those ratios.

## Choosing a Mixin or an alternative

Choose based on the meaning and ownership of the data first, then validate the query workload. A different modeling construct is not automatically faster.

| Use case | Guidance |
| --- | --- |
| A relationship must accept several otherwise unrelated Element classes | Use a propertyless Mixin as the relationship endpoint when it expresses their shared role. Keep the relationship's data on the relationship when it describes the association. |
| Consumers need to discover a capability across primary class hierarchies | Use a propertyless marker Mixin. This lets consumers work without enumerating all implementing classes. |
| A cross-hierarchy interface genuinely requires common properties | A property-bearing Mixin can be appropriate when the query costs and growth in implementing classes have been measured and are acceptable. Do not add properties solely to avoid repeating declarations. |
| Essential properties belong to a natural common entity concept | Define them on the appropriate Element class or semantically valid primary base class. Inherited properties may permit simpler mapping, but a base-class query can still span tables. Do not invent an artificial primary hierarchy solely for performance. |
| Optional property sets apply to individual Elements across unrelated classes | Consider an [ElementAspect](./elementaspect-fundamentals.md). Query the relevant Aspect class and relate it to its owning Element when needed. Aspects have their own mapping and join costs, and are not interchangeable with Mixin relationship endpoints. |
| A performance-sensitive query needs only a known subset of implementing classes | Query the relevant concrete class or meaningful primary base class instead of the broad Mixin. This deliberately narrows the result set; it is not a replacement when all present and future implementers must be included. |

An inspection capability is an example of the distinction: a propertyless Mixin can identify Elements that participate in an inspection relationship, while an ElementAspect can hold an optional inspection-status property set owned by an individual Element. If the data instead describes a particular association, follow the [relationship-property guidelines](./properties-guidelines.md#properties-in-link-table-relationships).

Avoid using a property-bearing Mixin as the default storage abstraction for frequently filtered or sorted attributes across a large, growing collection of unrelated classes. Consider a propertyless interface plus appropriately owned properties or Aspects instead. See [Properties: Guidelines](./properties-guidelines.md) for essential, optional, association and ad hoc data.

Do not treat JSON properties, an ECView wrapping the same query, or manually splitting the query as automatic performance fixes. They change querying capabilities or retain underlying work; split queries also require correct global ordering and pagination. Likewise, `ONLY` on a Mixin returns no instances because the Mixin is abstract. Use `ONLY` on a concrete class only when excluding its subclasses is intended.

For existing schemas, moving Mixin properties to an Element class or Aspect is a schema and data migration, not a transparent optimization. Preserve consumer contracts or provide a compatibility and migration plan before changing stored data and queries.

---
| Next: [Model Fundamentals](./model-fundamentals.md)
|:---
