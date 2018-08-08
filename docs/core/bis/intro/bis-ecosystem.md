# The BIS Ecosystem

BIS is the Base Infrastructure Schema for iModels. This chapter discusses some of the key technology in the BIS ecosystem.

## The iModel Technology Stack

The iModel technology stack is a cross-platform (e.g. Windows, MacOs, Linux, iOS, Android, etc.) set of libraries for developing applications and services for iModels.

## The iModel File Format

The iModel format is a relational database built on [SQLite](https://www.sqlite.org). iModel-specific db schema that is designed to hold information that conforms to BIS The db schema is actually fixed, and all of the information conforming to BIS is mapped into those somewhat generic tables.

## iModel Briefcases

## iModelHub

iModelHub is a cloud service that .... It manages iModels, push/pull of Revisions, management of Briefcases.

- *Lock Services*: Locks can help a group of users, each with their own Briefcase, avoid making changes to the same information.

- *Code Management Services*: Generating, validating, and registering Codes

- *Change Event Services*: Notifies subscribers of any relevant events of interest.

- *Etc*.

Conceptually, it may be helpful to think of iModelHub as playing the same role for iModels as [GitHub](https://github.com/) plays for Git repositories.

Clients of iModelHub can download a Briefcase (".bim" File) of any iModel that iModelHub is managing, and then pull and push ChangeSets in the form of Revisions (see below).

iModelHub allows clients to subscribe to events like “A new Revision has been pushed” and then pull the  Revision into their own Briefcase. The clients may be desktop or mobile apps or other cloud services. For example, a mobile app can keep large Briefcases up-to-date without requiring repeated large file downloads.

## Revisions

A Revision is a collection of changes required to *revise* a BIS Repository from a pre-revision state to a post-revision state. A Revision is

A Revision file is a binary file used to hold all of changes made to a Briefcase. The Revision includes a SQLite ChangeSet, which records changes to a Briefcase in a compact format.

When you *pull from* and *push to* iModelHub, you are pushing and pulling Revisions. iModelHub requires that before it will accept a Revision the

## BIS Generations

A BIS Generation is a series of BIS releases in which only "minor changes" to schemas are allowed, where “minor change” is defined as any change that does not break compatibility with software written against any version of BIS within that Generation. Minor changes can include very *significant* additions (but no deletions) – including adding new domains - so a Generation is not as constricting as might initially be assumed.

For the iModel technology stack, the BIS Generation approach gives one huge benefit:

*Software written for any version of BIS within a Generation can work with .bim files written by software written for any version of BIS within the same Generation.*

This flexibility largely removes the need for synchronized product releases and has the potential to vastly simplify the user’s product upgrade complexities. If the user stays within a BIS Generation, all the products and services should work together.

See _**xxxxxxxx**_ for a detailed description of BIS Generations and the motivation for them.

## BIS Outside of iModels

BIS is not only intended for the iModel stack; BIS is intended to be schema for applications and services. The use of the same conceptual schema will allow all the facets of the BIS (and Bentley) ecosystem to work together. The expectation is that all new REST APIs exposing user-domain concepts like “user”, “asset”, “project”, “enterprise”, “major infrastructure”, “document”, “transmittal”, “issue”, “deliverable”, “rendition”, “work package” etc. will need to conform to BIS (meaning that there will need to be BIS ECClasses describing the resources exposed by those services and the JSON should use the semantics defined by BIS and a JSON format that is compatible with the overall BIM ecosystem.

> Next: [Fabric of the Universe](./fabric-of-the-universe.md)