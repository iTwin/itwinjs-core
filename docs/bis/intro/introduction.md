# Introduction

The Base Infrastructure Schemas are a family of conceptual schemas covering all lifecycle phases and all disciplines relevant to built infrastructure. It defines the semantics and data-structures for business concepts exposed by Bentley cloud service REST APIs and for iModels.

BIS is the schema family for all iModel-based products and services.

## “Digital World”

BIS is the conceptual schema for a “Digital World” to make cohesive sense of all digital information relevant to a real-world large-scale infrastructure asset or project or enterprise. BIS covers:

- Physical infrastructure in physical space (including reality data)

- Non-physical (but spatial) entities relating to physical infrastructure (boundary lines, gridlines, etc.)

- Business concepts and processes involved in Advancing Infrastructure (projects, enterprises, phases, inspections, handover, etc.)

- Information artifacts related to infrastructure and business processes (documents, drawings, contracts, specifications, reports, RFIs, Issues, Deliverables, Versions etc.)

## Breaking Down Silos

To fulfill the vision of a cohesive Digital World, we must break down existing product/discipline/phase data silos. Historically, we have each optimized data repositories and structures for our particular use cases, without much regard for other portions of the infrastructure workflows. To move forward, we need to break down the silos and agree on the semantics and structure of our data. If three products and two services need to define Widgets, they will need to collaborate to define a Widget only once (although each may have other non-overlapping Widget-related data).

BIS is not just for “interoperability” like our previous “consensus schemas”. BIS is the native (“editing”) schema family for new applications and services.

## Evolution of Data Over Time

BIS supports the full lifecyle of infrastructure. Two phrases to keep in mind are:

- *“Begin with the end in mind.”*

- *“All projects are brownfield projects.”*

*Begin with the end in mind* tells us that for most of the infrastructure’s lifetime, BIS will be used to represent a structure that is being operated and maintained. The data that is required for efficient operation and maintenance must be represented in BIS, and – as much as practical - that data must naturally be developed during the previous phases (design and construction). Developers working on on “upstream” design and construction workflows must be cognizant of how the data they capture will flow downstream.

*All projects are brownfield projects* tells us that projects occur in an existing context, either a brownfield of existing infrastructure or a natural context that must be taken into account. One should be able to use existing BIS data (for operations) as the starting point for new design/construction modeling!

The BIS philosophy for modeling the full infrastructure lifecycle is to continually *enhance* the data over time, *not* transform or recreate it for each separate application or lifecycle phase.

## Not your father’s EC

BIS is defined using EC v3. EC v3 is a more clearly defined and rigorous version of the EC that has been used widely in Bentley over the past 10+ years.

BIS is modularized into a set of interrelated "domains" (each expressed in a separate ECSchema) that are consistent, coordinated and constrained to maximize the functionality of the entire BIS-based ecosystem. Some flexibility that is available in "raw" EC is not available in BIS. For example, all ECClasses defined in domain ECSchemas (other than BisCore itself) are required to sub-class from some ECClass in BisCore. Other BIS rules are documented at [BIS Schema Validation](bis-schema-validation).

Unless noted otherwise, all references to “schema”, “class” and “property” in this document refer to ECSchema, ECClass and ECProperty.

<!-- TODO: Move to Glossary?
## Some Terminology

Discipline – **_XXXX NEED DEFINITION XXXX_**

Domain – A synonym for BIS ECSchema. Domains are intended to define the data types for a naturally coherent and limited subject matter.
-->

<!-- TODO: Remove?
## How to use this document

This document is intended for developers. Others should see(**_XXXXX 10 page doc somewhere XXXX_**) for non-developer introduction. This document can be read linearly from start to finish, or can be used as a reference. In general, later chapters build upon the concepts discussed in earlier chapters. A supplemental document with greater detail will be created for schema designers.
-->
