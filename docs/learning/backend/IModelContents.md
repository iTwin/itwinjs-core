# iModel Contents

## Background

A critical part of designing an iModel-based application is determining what data belongs in the iModel and what data should be stored separately and then federated with the iModel.
The first step is to understand the goals and original requirements for the iModel as a repository.
The iModel has been optimized to persist and track changes to many data types including:

- 3D models
  - Physical objects
  - Spatial locations
- 2D drawings
  - Drawing graphics
  - Annotations
- System breakdowns
  - Functional
  - Spatial
- Analytical models
- Standard definitions
  - Categories
  - Styles
  - Materials
- Relationships between all of the above
- Information records that are tightly coupled with the above

The following data types are purposely not persisted in the iModel.
However, the iTwin.js library has been optimized to display them as context for the data in the iModel:

- Background maps and satellite imagery
- Reality data (see below)

When the data type does not fall neatly into any of the above categories, the next questions to ask are:

- Is the data type modeled or captured?
- How is the data normally transacted?
- Is it important to track changes at a component level over time?

> Note: Whether the data originates from an iModel or not, the iTwin.js library is the ideal way to form connections between the iModel and other federated data sources.

## Special Considerations

This section discusses data types that warrant special consideration before deciding what data or subset belongs in the iModel.

### Components from Catalogs

An infrastructure model contains many components.
Some of those components are standard and come from catalogs.
Once the component is *placed*, its type definition (that correspond to its catalog entry) clearly belongs in the iModel.
The general guidance is to also persist type definitions for those component that are likely to be placed in the iModel over the course of the project.

This has the following benefits:

- Changes to definitions are change tracked along with the infrastructure model
- Relationships can be formed to these definitions
- Less ambiguity regarding the component's type
- Supports offline workflows
- Component handling is more consistent regardless of whether it originated from a catalog or not.

The special consideration arises for large catalogs where only a small portion of its contents may be relevant to the iModel.
In those cases, only a subset of the catalog's type definitions should be imported.

> Note: These component type definitions should have a provenance link to the original catalog to enable checking for catalog updates.

### Standard Definitions

An organization may define standard definitions (categories, rendering materials, etc.) that it expects to be used across projects (and therefore across iModels).
The guidance here is similar to the "Components from Catalogs" guidance above.
If the set of standard definitions is large, then only import those that are used or likely to be used.
Otherwise, the entire set could be imported.
Either way, the benefits are the same as described in the above section.

### Analysis and Simulation Data

There are 3 main parts to an analysis or simulation:

1. Input parameters
2. The model to run the analysis or simulation against
3. The output results

If the input parameters (#1 above) would benefit from change tracking, then it may be beneficial to store them as information Elements within the iModel.
If each analysis or simulation run requires custom input from the user or that input changes too frequently (causing churn and negating the benefits of change tracking), then that configuration should probably be managed outside of the iModel.

Persisting and representing the *physical perspective* of an infrastructure asset is a strength of iModel.
It is also possible to store an additional *idealized* model where the physical perspective is simplified and optimized for a specific analysis purpose.
Therefore, it is recommended that the analysis / simulation *source* model (#2 above) be stored in the iModel.

The output results (#3 above) of an analysis or simulation are generally not stored in the iModel.
Often, the results are in a different form such as a video / animation or report.
The results may also have more detail than would be practical to persist and change track at an object-by-object level.

## Data types that typically do not belong in an iModel

This section discusses data types that are not intended to be persisted in an iModel.
When deciding what data types do not belong in the iModel, the analogy between iModelHub and GitHub can often be helpful. As a reminder, here is the comparison:

| Comparison       |                         | |
|------------------|-------------------------|-|
| Service          | iModelHub               | Manages the change ledger for many infrastructure models
|                  | GitHub                  | Manages the change ledger for many source code projects
| Repository       | iModel                  | The change ledger for a single infrastructure project or asset
|                  | Git Repository          | The change ledger for a single source code project
| Distributed Copy | iModel Briefcase        | A *materialized* copy of the iModel as of a specific version (synchronized from iModelHub)
|                  | Local working directory | A *materialized* copy of the source code project as of a specific version (pulled from GitHub)
|                  |                         | |

### Issues

With software, issues and bug reports are typically filed by or on behalf of the end users of an application.
This is well *after* the source code changes have been checked in by the software developer.
Sometimes the bug report is valid and then the issue follows a workflow where the status changes from `accepted -> fixed -> ready to test -> closed`.
Other times, the issue was a misunderstanding by the end user and the issue is closed without any other workflow or software changes.

Hopefully, this example demonstrates that the *issue transaction pattern* is not compatible with the *source code project transaction pattern*.
Therefore, the best practice is to store issues separately.
For example, [Issues](https://help.github.com/en/github/managing-your-work-on-github/about-issues) for a GitHub project are stored in a separate repository.

Likewise, issue data types do not normally belong in the iModel.
However, issues stored externally are often linked to Elements in the iModel using one of the following techniques:

- iModel Guid + ElementId
- iModel Guid + Code
- FederationGuid

Please see [Element Fundamentals](../../bis/intro/element-fundamentals.md) for more details.

> Note: It is important to also persist the iModel changeset GUID to record the version of the iModel that the issue was first logged against.

### Markup / Design Review

Many design review workflows include a process where issues (mentioned above) and markups are collected against a fixed / approved version.
Those reviewing the design are often outside of the core engineering team and do not have the permission nor ability to actually change the underlying data.
Many products include a digital workflow that mimics drawing notes with a red marker on a construction drawing. Here is one [example](https://www.bentley.com/en/products/product-line/digital-twins/itwin-design-review).

This type of review process depends on the underlying data (the iModel in this case) not changing. Therefore, the markups and comments must be stored externally.
Thus, even though the iModel repository is optimized for storing graphical markup and annotations, it is really the workflow and permissions that cause these markups to be stored externally.
Again, there are frontend ways of *mashing up* the markup with the infrastructure model so that the comments can be seen in context and addressed.

### Reality Data

*Reality Data* is an overarching term for information in the form of point clouds, laser scans, and images.
Because reality data is *captured* rather than *modeled*, the workflows and transaction patterns are different.
The sheer size of reality data requires other special considerations.
This leads to the guidance that reality data should be stored separate from the iModel and then *mashed up* at display time on the frontend.

Sticking with the GitHub analogy, it is not common for training videos (also large and captured) to be stored in the same repository as source code.
However, it would be common for a website to link to both the training video and the source code.

There are services that specialize in the capture, management, and preparation of reality data. Here is an [example](https://www.bentley.com/en/products/product-line/reality-modeling-software).

The iTwin.js library has capabilities that make it easy to display and work with reality data.

> Note: For cases where an AI/ML algorithm recognizes objects from reality data, the resulting objects output from that algorithm likely belong in the iModel.

### Time Series Data

[Time series](https://en.wikipedia.org/wiki/Time_series) data is also *captured* rather than *modeled*.
One common source of time series data is with IoT sensor devices.
As an example, an IoT sensor device could capture the temperature over time.
The continuous and potentially real-time nature of the temperature reading represents a different transaction pattern.
Therefore, the observations from such a device would not belong in a GitHub repository nor in an iModel.

However, the type of sensor and its physical location are often modeled and would be appropriate to be stored in the iModel.
In many cases, frontend *mash ups* are created that correlate the Id of the physical device in the iModel with the Id of the real-time data stream or historical time series data.

## Summary

It is not possible to cover all potential cases, so the general guidance is:

| Inside iModel | Data Type Characteristics |
|---------------|---------------------------|
| Yes           | The data type is modeled |
| Yes           | Component-level change tracking is important |
| Yes           | A strong correlation to the *physical perspective* |
| Yes           | Compatible transaction pattern |
| No            | The data type is captured |
| No            | Time series data |
| No            | Analysis results |
| No            | Objects with frequently changing status |

> Note: The iTwin.js library has been designed with federation in mind and is the ideal way to form connections with the iModel.
