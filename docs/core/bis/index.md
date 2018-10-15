# Base Infrastructure Schemas (BIS)

The **Base Infrastructure Schemas** (BIS) are a family of schemas covering all lifecycle phases and all disciplines relevant to physical infrastructure. BIS defines the semantics, data structures, and business concepts used by software for modeling infrastructure. Importantly, BIS is used in [iModels](../learning/iModels.md), but can also be used to define the semantics and structure for infrastructure data in REST APIs, messages, and various serialized data formats.

BIS covers:

- Physical infrastructure in physical space

- Functional systems implemented by the physical infrastructure (process plants)

- Non-physical (but spatial) entities relating to physical infrastructure (boundary lines, gridlines, etc.)

- Mathematical analysis models used to predict the performance of physical infrastructure

- Business concepts and processes involved in Infrastructure (projects, enterprises, phases, inspections, handover, etc.)

- Information artifacts related to infrastructure and business processes (documents, drawings, contracts, specifications, reports, RFIs, Issues, Deliverables, Versions etc.)

## Aligning Dark Data

To create a cohesive Digital World, we must store relevant information in a format that can be understood without the software that created it. Historically, software developers have each optimized data repositories and structures for their particular use cases, without regard for other disciplines or portions of the infrastructure workflows. Since this valuable data cannot be used conveniently for other purposes, it is sometimes referred to as *dark*. To move forward, we must find the concepts-in-common where possible and agree on the units, semantics and structure of data. We refer to this process as *aligning* the data. That is the purpose of BIS.

For example, if three products and two services need to define Widgets, they will need to collaborate to define a Widget only once, though each may have other non-overlapping Widget-related data.

## Evolution of Data Across Phases

BIS supports the full lifecycle of infrastructure. Two phrases to keep in mind are:

- *Begin with the end in mind.*

- *All projects are brownfield projects.*

*Begin with the end in mind* tells us that for most of the infrastructure’s lifetime, BIS will be used to represent a structure that is being operated and maintained. The data that is required for efficient operation and maintenance must be represented in BIS, and – as much as practical - that data must naturally be developed during the previous phases (design and construction). Developers working on “upstream” design and construction workflows must be cognizant of how the data they capture will flow downstream.

*All projects are brownfield projects* tells us that projects occur in an existing context, either a brownfield of existing infrastructure or a natural context that must be taken into account. One should be able to use existing BIS data (for operations) as the starting point for new design/construction modeling.

The BIS philosophy for modeling the full infrastructure lifecycle is to continually *enhance* the data over time, *not* transform or recreate it for each separate application or lifecycle phase.

> Next: [Modeling with BIS](./intro/modeling-with-bis.md)
