# Schema Production Status

<!-- Responsible for this page: Allan Bommer -->

[!alert text="<img src="./media/clean-01.svg" style="width:2%;height:2%;">  Please be aware that as of May 2019 not all features described by this documentation have been implemented." kind="danger"]

## Schema Evolution

Schemas that have been released for production use in end-user workflows evolve over time as new capabilities are added and other improvements are made. To manage and track this schema evolution, schema versioning is used. See [Schema Versioning and Generations](schema-versioning-and-generations.md) for details on BIS's schema versioning strategy.

A single version of a schema that has not yet been released for production also evolves. A pre-production schema is expanded and modified as it goes through periods of development and field testing before being released for production. Also, after a schema is released into production workflows, it may become deprecated. This page describes the management and tracking of this non-version axis of schema evolution.

## Motivation

The primary motivation for formally tracking the production status of schemas is to ensure they are not used contrary to the way the schema author intended. The mechanisms described on this page:

1. Enable the schema author to clearly define the intended usage of the schema.
2. Enable the iModel creator to clearly define the intended usage of an iModel.
3. Provide a mechanism to ensure that the schemas in an iModel have an intended usage that is compatible with the iModel's intended usage.

## ProductionStatus Custom Attribute

The intended use of a schema is tracked through the `ProductionStatus` `CustomAttribute`. The `ProductionStatus` `CustomAttribute` may be placed on any BIS schema. That `CustomAttribute` has a `SupportedUse` property that can have one of these values:

| Value | Meaning |
|-------|---------|
| `Production` | This schema is suitable for use in production workflows. Data created using this schema  will be supported long-term (possibly through transformation). |
| `FieldTesting` | This schema is suitable for field testing of production workflows. Data created using this schema may not be supported long-term and may not be upgradable. |
| `NotForProduction` | This schema is under development and should never be used for production workflows. Data created with this schema is not supported and may not be upgradable. |
| `Deprecated` | This schema is no longer recommended for production workflows. Better alternatives exist and should be used instead. |

## iModel Support for ProductionStatus

The iModel ecosystem uses the `ProductionStatus` of schemas to determine if a schema can be loaded into an iModel.

### iModel `ProductionStatus` Setting

To determine whether a schema with a `ProductionStatus` other than `Production` can be loaded into an iModel, the iModel technology stack needs to understand the intended use of the iModel. For this reason, every iModel contains a `ProductionStatus` setting that declares the suitability of the iModel for production use. The possible values for this setting correspond to those in the `ProductionStatus` custom attribute, although their definitions are slightly different:

| Value | Meaning |
|-------|---------|
| `Production` | This iModel is suitable for use in production workflows. |
| `FieldTesting` | This iModel is suitable for field testing of production workflows. Data contained in it may not be supported long-term. |
| `NotForProduction` | This iModel is suitable for developer testing only and should never be used for production workflows. Data contained in it will not be supported long-term. |
| `Deprecated` | (this value should not be used for iModels) |

The iModel's `ProductionStatus` setting is stored in the be_prop table as follows:

| Column | Value |
|--------|-------|
| NameSpace |  "dgn_Db" |
| Name | "ProductionStatus" |
| StrData | "Production", "FieldTesting" or "NotForProduction" |

The `ProductionStatus` value of the iModel is set when the iModel is created.

### Compatibility of Schemas for iModels

At schema load time, the iModel technology confirms that the schema's `ProductionStatus` is compatible with the iModel's `ProductionStatus`. The compatibility of these settings is shown below:

| iModel `ProductionStatus` | Compatible Schema `ProductionStatus` |
|---------------------------|--------------------------------------|
| `Production` | `Production`, `Deprecated` |
| `FieldTesting` | `Production`, `FieldTesting`, `Deprecated` |
| `NotForProduction` | `Production`, `FieldTesting`, `NotForProduction`, `Deprecated` |

The attempted loading of a schema that is not compatible will result in a schema load failure.

### Changing of iModel `ProductionStatus`

An iModel's `ProductionStatus` can conceptually be "downgraded" as follows:

| iModel `ProductionStatus` | Compatible Downgraded `ProductionStatus` |
|-------------------------|----------------------------------------|
| `Production` | `FieldTesting`, `NotForProduction` |
| `FieldTesting` | `NotForProduction` |
| `NotForProduction` | (no further downgrade is possible) |

In the future, the ability for a user to downgrade the `ProductionStatus` of an iModel will be provided.

An iModel's `ProductionStatus` can conceptually be upgraded as follows:

| Upgraded iModel `ProductionStatus` | Condition |
|------------------------------------|-----------|
| `Production` | No schemas of `ProductionStatus` `FieldTesting` or `NotForProduction` |
| `FieldTesting` | No schemas of `ProductionStatus` `NotForProduction` |
| `NotForProduction` | (not possible as upgrade) |

In the future, the ability for a user to upgrade the `ProductionStatus` of an iModel will be provided.

---
| Next: [BIS Schema Units](./units.md)
|:---
