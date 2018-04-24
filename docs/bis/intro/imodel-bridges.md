# iModel Bridges

Often, information modeled in an iModel is created by an application that stores its data in another format.
iModel Bridges exist for the purpose of transforming data from these other applications into iModels in iModelHub. Many iModel Bridges can be associated with a single iModel and hence the resulting iModel becomes an aggregator of many sources of data.

iModel Bridges need to carefully transform the source data to BIS-based data in the iModel, and hence each Bridge is written for a specific data source. 

Examples of iModel Bridges include:

- AECOSim Building Designer
- DGN
- DWG
- RVT
- ISM
- OpenPlant
- OpenRail Designer
- OpenRoads Designer
- ProStructures
- SmartPlant
- Substation
- etc.

Some key characteristics of iModel Bridges are:

- Transformations of data are *from* source *into* an iModel.
- If necessary, bridges store enough information about source data to detect the differences in it between runs. In this manner bridges generate *ChangeSets* that are sent to iModelHub. This is the key difference between a Bridge and a one-time converter.
- Bridges may run on a pre-determined schedule, or on an event that the source data has changed.
- Bridges store a mapping of source Ids to Ids in iModels. to create a "back-link" from data in iModels to its source application.
- Multiple bridges (called *jobs*) may target the iModel.
- Each "job generates data that is isolated from all other jobs' data. The resulting combined iModel is partitioned at the Subject level of the iModel; each Bridge job has its own Subject.
- Bridges jobs *hold the locks* for all of their data, so it may not be modified by other iModel applications.

## Data Alignment

For each iModel bridge author, there will always be two conflicting goals:

1. To transform the data in such a way that it appears logical and "correct" to the users of the authoring application.
2. To transform the data in such a way that data from disparate authoring applications appear consistent.

The appropriate balancing of these two conflicting goals is not an easy task. However, where clear BIS schema types exist, they should always be used.

## Dynamic Schemas

Sometimes BIS domain schemas are not adequate to capture all the data in the authoring application. To avoid losing data, iModel Bridges may dynamically create application-specific schemas whose classes descend from the most appropriate BIS domain classes.

As iModel Bridges always run multiple times to keep an iModel synchronized, the schemas created by previous executions limit the schemas that can be used by subsequent executions. To provide consistency and enable concise change sets, the Bridges add to the previously-defined schemas (creating new schema versions). This follows the general schema update strategy defined in [Schema Versioning and Generations](schema-versioning-and-generations)

Apply the `DynamicSchema` custom attribute to the schema.  This custom attribute can be found in the standard schema `CoreCustomAttributes` and it enables us to programmatically detect dynamic schemas in the future.

## Display Labels

Wherever practical, the Elements generated from iModel Bridges should be identifiable through an optimal "Display Label".

As discussed in [Element Fundamentals](element-fundamentals), the Display Labels are created through the following logic:

1. If the UserLabel property is set, it is taken as the Display Label.
2. If the CodeValue is set (and the UserLabel is not set), the CodeValue becomes the Display Label.
3. If neither UserLabel nor CodeValue is set, then a default Display Label is generated from the following data:
   - Class Name
   - Associated Type's Name (if any)

iModel Bridge data transformations should be written considering the Display Label logic; UserLabel is the appropriate property for a Bridge to set to control the Display Label (CodeValue should never be set for anything other than coding purposes).

*But what value should an iModel Bridge set UserLabel to?* There are three goals to consider in the generation of UserLabels. Those goals, in priority order, are:

1. Consistency with source application label usage.
2. Consistency with BIS domain default labeling strategy.

If the source application data has a property that conceptually matches the BIS UserLabel property, that value should always be transformed to UserLabel.

Each BIS domain author should provide a default Display Label strategy for each of its classes. This strategy should be be determined by the optimal *user* experience and typically will represent the consensus of Product Management for applications and services that are associated with the domain. Information that is typically considered in the domain's Display Label logic is:

- Class Name

- Associated Type instance

- Key Property (e.g. pipe diameter) or Key Relationship (e.g. material name)
