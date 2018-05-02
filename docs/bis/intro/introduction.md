# Introduction to BIS

The Base Infrastructure Schemas (BIS) are a family of schemas covering all lifecycle phases and all disciplines relevant to built infrastructure. BIS defines the semantics and data structures of business concepts for iModels and for Bentley cloud service APIs.

## Digital World

BIS is the schema for a *Digital World* to make cohesive sense of all digital information relevant to a real world large scale infrastructure asset or project or enterprise.

BIS covers:

- Physical infrastructure in physical space (including reality data)

- Non-physical (but spatial) entities relating to physical infrastructure (boundary lines, gridlines, etc.)

- Business concepts and processes involved in Infrastructure (projects, enterprises, phases, inspections, handover, etc.)

- Information artifacts related to infrastructure and business processes (documents, drawings, contracts, specifications, reports, RFIs, Issues, Deliverables, Versions etc.)

## Aligning Dark Data

To fulfill the vision of a cohesive Digital World, we must break down existing product/discipline/phase data silos. Historically, developers have each optimized data repositories and structures for their particular use cases, without regard for other portions of the infrastructure workflows. To move forward, we must break down the silos and agree on the semantics and structure of infrastructure data. If three products and two services need to define Widgets, they will need to collaborate to define a Widget only once (although each may have other non-overlapping Widget-related data).

## Evolution of Data Across Phases

BIS supports the full lifecycle of infrastructure. Two phrases to keep in mind are:

- *Begin with the end in mind.*

- *All projects are brownfield projects.*

*Begin with the end in mind* tells us that for most of the infrastructure’s lifetime, BIS will be used to represent a structure that is being operated and maintained. The data that is required for efficient operation and maintenance must be represented in BIS, and – as much as practical - that data must naturally be developed during the previous phases (design and construction). Developers working on on “upstream” design and construction workflows must be cognizant of how the data they capture will flow downstream.

*All projects are brownfield projects* tells us that projects occur in an existing context, either a brownfield of existing infrastructure or a natural context that must be taken into account. One should be able to use existing BIS data (for operations) as the starting point for new design/construction modeling!

The BIS philosophy for modeling the full infrastructure lifecycle is to continually *enhance* the data over time, *not* transform or recreate it for each separate application or lifecycle phase.
