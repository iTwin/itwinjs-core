# Base Infrastructure Schemas (BIS)

The acronym “BIS” stands for “Base Infrastructure Schema*s*” but is commonly used as a singular noun. It is pronounced “biz”. BIS is a family of modular schemas for modeling [Federated Digital Twins for Infrastructure Engineering](./federated-digital-twins.md).

BIS is a “conceptual schema” that expresses taxonomy, data structure, and relationships for modeling real-world Entities. It is written using Bentley’s open [“EC” language](../../ec/index.md) for Entity-Relationship modeling.

## Open and Extensible

BIS is an “open” and extensible family of schemas. It is modularized into [Domains](../references/glossary.md#Domain). The “BIS Core” Domain expresses the fundamental modeling concepts. Each Domain is expressed as a separate [ECSchema](../../ec/ec-schema.md). Anyone can author a new Domain schema by following the rules and guidelines in this documentation. Users can also extend Domain schemas by adding custom classes, properties, and relationships.

## BIS Repository

BIS is the conceptual schema of iModels, which are a key part of Federated Digital Twins. [iModels](../../../learning/iModels.md) map BIS into a lower-level database schema and support the ECSQL query language that gets translated into low-level SQL queries for execution.

BIS can also be used as the conceptual schema of a data abstraction layer over other repositories in a Federated Digital Twin. These have repository-specific mechanisms for mapping portions of BIS to the technology and information content of the specific repository.

"BIS Repository" refers to both iModels and other repositories that are exposed to Federated Digital Twins using the BIS conceptual schema.

Any given BIS Repository will always include the “BIS Core” Domain and one or more additional Domains that directly or indirectly depend on “BIS Core”. No single “BIS Repository” is likely to use ***all*** of the Domain schemas in the BIS family.

## Scope

To support [Federated Digital Twins for Infrastructure Engineering](./federated-digital-twins.md), BIS is used to model:

- Physical infrastructure in physical space
- Functional systems implemented by the physical infrastructure (process plants)
- Non-physical (but spatial) entities relating to physical infrastructure (boundary lines, gridlines, etc.)
- Mathematical analysis and simulation models of physical infrastructure
- Business concepts and processes involved in Infrastructure workflows (projects, enterprises, phases, inspections, handover, etc.)
- Information related to infrastructure and business workflows (documents, drawings, contracts, specifications, reports, RFIs, Issues, Deliverables, Versions etc.)

> Next: [Federated Digital Twins](./federated-digital-twins.md)
