# iModel Connectors

Often, information modeled in an iModel is created by an application that stores its data in another format.
iModel Connectors exist for the purpose of transforming data from these other applications into iModels in the iModelHub. Many iModel Connectors can be associated with a single iModel and hence the resulting iModel becomes an aggregator of many sources of data.

iModel Connectors need to carefully transform the source data to BIS-based data in the iModel, and hence each Connector is written for a specific data source.

Examples of iModel Connectors include:

- MicroStation (.dgn)
- AutoCAD (.dwg)
- Revit (.rvt)
- OpenBridge Designer
- OpenBuilding Designer
- OpenRail Designer
- OpenRoads Designer
- OpenSite Designer
- SmartPlant PID
- Smart 3D
- AVEVA PDMS/E3D
- etc.

## Connector execution

Connectors are invoked by the *Bentley Orchestration Framework(OF)* product. The *Orchestration Framework* is installed on an *Automation server* machine. The *Automation Server* has access to a ProjectWise managed data source that contains the application native files. Any desired connector can be installed on the *Automation Server*. All this data is specified in the connected project web-UI under *connection*.
The application source file and destination iModel are identified in *mapping*.
A *connector-job* is the combination of *connection* and *mapping* and may be run on a pre-determined schedule.

## Key characteristics of iModel Connectors

- Mappings of data are *from* the source *into* an iModel.
- If necessary, connectors store enough information about source data to detect the differences in it between job-runs. In this manner connectors generate *ChangeSets* that are sent to iModelHub. This is the key difference between a Connector and a one-time converter.
- Connectors locally store a mapping of native source Ids to iModel global Ids. This creates a "back-link" from data in iModels to its source application.
- Each job generates data in the iModel that is isolated from all other jobs' data. The resulting combined iModel is partitioned at the Subject level of the iModel; each connectors job has its own Subject.
- Connector jobs *hold the locks* for all of their data, so it may not be modified by other iModel applications.

## Data Alignment

For each iModel connector author, there will always be two conflicting goals:

1. To transform the data in such a way that it appears logical and "correct" to the users of the authoring application.
2. To transform the data in such a way that data from disparate authoring applications appear consistent.

The appropriate balancing of these two conflicting goals is not an easy task. However, where clear BIS schema types exist, they should always be used.

## Dynamic Schemas

Sometimes BIS domain schemas are not adequate to capture all the data in the authoring application. To avoid losing data, iModel Connectors may dynamically create application-specific schemas whose classes descend from the most appropriate BIS domain classes.

As iModel Connectors always run multiple times to keep an iModel synchronized, the schemas created by previous executions limit the schemas that can be used by subsequent executions. To provide consistency and enable concise change sets, the Connectors add to the previously-defined schemas (creating new schema versions). This follows the general schema update strategy defined in [Schema Versioning and Generations](../bis/intro/schema-versioning-and-generations.md)

The `DynamicSchema` custom attribute should be set on customer specific application schemas. This custom attribute can be found in the standard schema `CoreCustomAttributes` and it enables iModelHub to programmatically detect dynamic schemas. Dynamic schemas require special handling since their name and version are typically duplicated between iModels from different work sets.

## Display Labels

Wherever practical, the Elements generated from iModel Connectors should be identifiable through an optimal "Display Label".

As discussed in [Element Fundamentals](../bis/intro/element-fundamentals.md), the Display Labels are created through the following logic:

1. If the UserLabel property is set, it is taken as the Display Label.
2. If the CodeValue is set (and the UserLabel is not set), the CodeValue becomes the Display Label.
3. If neither UserLabel nor CodeValue is set, then a default Display Label is generated from the following data:
   - Class Name
   - Associated Type's Name (if any)

iModel Connector data transformations should be written considering the Display Label logic; UserLabel is the appropriate property for a Connector to set to control the Display Label (CodeValue should never be set for anything other than coding purposes).

*But what value should an iModel Connector set UserLabel to?* There are two goals to consider in the generation of UserLabels. Those goals, in priority order, are:

1. Consistency with source application label usage.
2. Consistency with BIS domain default labeling strategy.

If the source application data has a property that conceptually matches the BIS UserLabel property, that value should always be transformed to UserLabel.

Each BIS domain author should provide a default Display Label strategy for each of its classes. This strategy should be determined by the optimal *user* experience and typically will represent the consensus of Product Management for applications and services that are associated with the domain. Information that is typically considered in the domain's Display Label logic is:

- Class Name

- Associated Type instance

- Key Property (e.g. pipe diameter) or Key Relationship (e.g. material name)
