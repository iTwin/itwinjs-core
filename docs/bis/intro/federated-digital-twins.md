
# Federated Digital Twins for Infrastructure Engineering

Bentley defines “Digital Twin” as a digital “replica” of a real physical thing and (optionally) related processes, including the functionality of systems and the roles of people and organizations. The Digital Twin may also include analysis and simulation models of the infrastructure and processes.

## Connected to physical reality

A key distinguishing characteristic of a Digital Twin is a connection to the real **physical world**. This “connection” can be established by IoT sensors (for fast-changing characteristics of physical reality), by periodic measurement such as laser scanning, photogrammetry, or other measurement systems (for characteristics of physical reality that change on timescales of days or weeks rather than seconds), or by design or surveying (for essentially “fixed” characteristics of physical reality, like the position and geometry of a road.)

## The Physical Backbone

Models of the physical reality (including physical attributes like geometry, material, etc.) of infrastructure assets form the “backbone” of a Digital Twin. They are the “context” for IoT measurements, for simulations of activities and processes, and for visual understanding of the twin and its connection to reality.

## Shared, not siloed

Another distinguishing characteristic of a Digital Twin is that it is not application-specific, but is intended to be shared by multiple apps and services, in contrast to traditional applications that each have their own siloed database.  This is especially true of the Physical Backbone. Nearly every app and service will either use it or relate their information to it. This affects how information is factored in the Digital Twin.

## Aligned

A Digital Twin should be a cohesive digital replica against which to write services and apps. BIS embodies standard taxonomy, data structure, and relationships for those services and apps. By migrating data from proprietary repositories into an iModel (using [iModel Connectors](../../learning/imodel-connectors.md)) we can bring “dark data” from proprietary, closed CAD, BIM, and GIS formats in an open and extensible format.

## Federated

iModels are central to Bentley’s Digital Twins, but not all information belongs in an iModel due to its Entity-Relationship modeling and transactional model. For example, iModels are not an appropriate place to store video. IoT data changes too quickly, and there are already well-established IoT systems and data historians.

There will always be existing “silos” of data which (for whatever reason) are not migrated into iModels, but which contain information that should be part of our Digital Twin.

To achieve a cohesive Digital Twin encompassing both iModels and other services, we create adapters that “align” data to BIS—allowing us to view the existing services as [BIS Repositories](./glossary.md#Bis-Repository). These adapters will support a federated data access layer (in development) to allow users to query the entire Federated Digital Twin as-a-whole for analytics and insights.

## Digital Twins for Lifecycle Phases

Digital Twins facilitate operating existing built infrastructure (an operations Digital Twin), but they are equally relevant in other infrastructure lifecycle phases.

During construction, it is useful to have a construction Digital Twin of the facility-to-be-built as well as of construction site infrastructure and equipment such as formwork, scaffolding, cranes, etc. The construction Digital Twin connects to IoT for construction equipment. It is updated periodically by measurement systems to track progress and inventory. It can be used to plan and simulate construction activities and schedules.

During design, the digital replica of the facility-to-be-built is created in the design Digital Twin, along with analysis and simulation models.

The [Physical Backbone](#the-physical-backbone) is the common core among the operations, construction, and design Twins. It is created in design and used and updated in construction and operations. When a new capital project to renovate the facility is started, the Physical Backbone of the operations Twin is the basis for the existing conditions in a new design Twin.

## Guiding Principles

There are two key ideas stemming from our sharing of the Physical Backbone across lifecycle-phase-specific Digital Twins:

- Begin with the end in mind.
- All projects are brownfield projects.

*Begin with the end in mind* reminds us that the Physical Backbone is shared across phases and should include the physical characteristics that operations requires (e.g. serial numbers on tracked items). As much as practical, operations data should naturally be developed during the design and construction phases, e.g. capture serial numbers as equipment is being installed.

*All projects are brownfield projects* reminds us that projects occur in an existing context, either a “brownfield” of existing infrastructure or a natural context. One should be able to use the Physical Backbone of an operations Digital Twin as the starting point for new design Digital Twin.

Conversely, data that is completely phase-specific should be segregated from the Physical Backbone, as described in other topics of this documentation.

---
| Next: [Modeling with BIS](./modeling-with-bis.md)
|:---
