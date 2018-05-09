# Analysis Models and Elements

## Introduction

Analysis Models are models used to facilitate analyses of  infrastructure. Analyses that require an Analysis Model typically cannot be performed directly on Physical Models as the physical world is too complex; these analyses require simplified geometry and other data.  Analysis Models are similar in purpose to Functional Models, but have one significant difference: they are models in true world coordinates.

Not all analyses require an Analysis Model. Examples of analyses that would not require Analysis Models are clash, cost and schedule analyses.

Typically each Analysis Model is relevant to only one type of analysis. A particular Physical Model (e.g. a building) may have multiple associated Analysis Models. Examples of the analyses facilitated by Analysis Models are hydraulic analysis, building energy analysis, roadway analysis and structural analysis.

<!-- WIP: References to classes that do not exist
*Analysis Model* and *Analysis Element* do not directly correspond to BIS classes; they are concepts that can be applied to and be implemented by multiple classes. Currently *AnalysisModel3d* and *AnalysisElement3d* are the only classes that implement these concepts.
-->

## Analysis Elements

As discussed in [Element Fundamentals](./element-fundamentals.md), Analysis Elements are simplified representations of real physical infrastructure. An example of an Analysis Element is a Pipe Segment (not a physical pipe) in a hydraulic analysis model. This Pipe Segment might have a simple 2D line segment location, together with a set of hydraulic analysis properties; it would also likely have relationships to other hydraulic Analysis Elements in the network being analyzed.

Analysis Elements must always be contained in Analysis Models. Analysis Elements will frequently have relationships to the Physical Elements that model the same real world infrastructure. This relationship, however, is not always 1:1.

<!-- WIP: References to classes that do not exist
Currently, only AnalysisElement3d is defined. This class is for Analysis Elements that are placed in real-world 3D space. Every AnalysisElement3d must exist in an AnalysisModel3d.
-->

## Analysis Models

As discussed in [Model Fundamentals](./model-fundamentals.md), Analysis Models exist to facilitate the analyses of infrastructure. Analysis Models contain – directly or indirectly - all of the information necessary for one or more analysis of single type. For some analysis domains, it may be appropriate to have more than one AnalysisModel for a PhysicalModel.

<!-- WIP: References to classes that do not exist
Currently, only AnalysisModel3d is defined. This class is for Analysis Models that relate to real-world 3D space.
-->

### Contents of Analysis Models

Analysis Models contain Analysis Elements, but they may also contain other types of Elements. Analysis Models will frequently contain InformationElements., AnalysisModel3ds may contains SpatialElement3ds. Analysis Models never contain PhysicalElements.

### Analysis Models in Model Hierarchy

As Analysis Models are used to assist in the design or understanding of physical infrastructure, Analysis Models are often linked to PhysicalModels.

<!--
TODO: Finish this section. Likely reference [Information Hierarchy](./information-hierarchy.md).
-->

## Typical Analysis Model Workflows

Analysis Models are expected to be used in three basic scenarios:

1. Analysis Model is derived from a PhysicalModel
2. PhysicalModel is derived from an Analysis Model
3. Analysis Model is used without relationship to a PhysicalModel.

Deriving an Analysis Model from a PhysicalModel is expected to be a common workflow. Existing or planned infrastructure will frequently be modeled and need to be analyzed. The derivation of the Analysis Model may be automated, partially automated or manual. The derivation will typically create relationships between the PhysicalElements and the Analysis Elements. These relationships can be used later to assist with updating the Analysis Model when the PhysicalModel changes, or in creating a two-way syncing of information between the two models.

Deriving a PhysicalModel from an Analysis Model may be a common workflow for new infrastructure when the analytical design of the infrastructure occurs before the physical design. The derivation of the PhysicalModel from the Analysis Model is often a simple automated operation, but typically does not produces a fully-detailed PhysicalModel. As with the Physical-to-Analysis derivation, relationships between PhysicalElements and Analysis Elements will typically be created. These relationships can be used for updating and two-way syncing.

A standalone Analysis Model that is not related to a PhysicalModel is a valid configuration. This configuration might be used when the organization using the iModel is only involved in the analytical investigation.

<!-- WIP: References to classes that do not exist
## Example - Building Thermal Analysis

Building thermal analysis is one likely use of AnalysisModel3d.

The exterior envelope and interior partitions of the building might be modelled with an EnvelopePanel subclass of AnalysisElement3d which would contain information on the panel shape, with relevant infrared radiation transmittance, thermal mass and thermal insulation properties. These EnvelopePanel elements would be related back to whatever items in the PhysicalModel that they were representing.

Similarly, AnalysisElement3ds subclasses would be created to represent the key components of the HVAC system. These would also be related back to their associated PhysicalElements.

InformationElement subclasses would be used to record other parameters for the analysis, such as weather scenarios and building operating assumptions.

The complete results of the thermal analysis would likely be large and would not be stored directly in the iModel. However, key or summary results would likely be stored in Elements (InformationElements or AnalysisElement3ds) in the AnalysisModel3d.
-->
