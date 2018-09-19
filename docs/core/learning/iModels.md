# iModel Overview

An iModel is a distributed relational database, based on [SQLite](https://www.sqlite.org/index.html), with a schema defined by [BIS](../bis/index). An iModel holds information about a single infrastructure asset. iModels may contain physical and functional models, drawings, specifications, analytical models, etc.

Many copies of an iModel may be extant simultaneously, each held in a [*Briefcase*](../learning/backend/Briefcases) and synchronized via [*ChangeSets*](../learning/backend/ChangeSets) from [iModelHub](./iModelHub). For programmers, a helpful analogy is Git and GitHub. In the same manner that every programmer has a full copy of a source code repository, with iModels every user has a full copy of the database.

## Every iModel has a GUID

An iModel holds information about a single infrastructure asset. They are each uniquely identified with a Globally Unique Identifier, so they can be tracked and secured by iModelHub. Each Briefcase maintains the GUID of its iModel so
access to it can be controlled by its owner.

## An iModel occupies physical space on the earth

Every iModel has a single [spatial coordinate system](../learning/glossary#spatial-coordinate-system) that may be positioned and oriented somewhere on the earth. In this manner multiple iModels can be oriented relative to one
another, and relative to external reality models, cartographic and geographic information systems, etc.

iModels have a property called [Project Extents](../learning/glossary#project-extents) that describes the *volume of interest* they occupy. All geometry in the spatial coordinate system of an iModel must be contained inside this volume.

## The format of information in an iModel is defined by BIS

The [Base Infrastructure Schemas](../bis/index) are a family of [domain-specific](../bis/intro/schemas-domains) class definitions that define the properties and relationships of entities within an iModel. All information held in an iModel is an instance of some class defined in BIS, inserted using the iModel.js API.

## An iModel is comprised of many Models

Within an iModel, logical subdivisions of information are defined by [Models](../bis/intro/model-fundamentals).
There are many types of Models, corresponding to the type of information they hold (e.g. spatial, functional, drawing, etc.) There can be many instances of each type of Model in the same iModel.

## A Model is comprised of many Elements

[Elements](../bis/intro/element-fundamentals) are the smallest independently addressable building block in BIS.
Every Element is *owned by* (i.e. *contained in*) one and only one Model.

There are many types of Elements, corresponding to the type of information they contain. Only [GeometricElement]($backend)s, held in [GeometricModel]($backend)s, are visible in [Views](../learning/frontend/views).

## iModel.js makes iModels accessible anywhere

The purpose of the iModel.js library is to make iModels accessible to everyone, everywhere, for any purpose that is approved by the iModel's owner. It provides ways to create, modify, query, display, and analyze iModels. JavaScript was chosen as the language for iModel.js due to its ubiquitous nature and the vast body of open source tools and frameworks available for it.

## ECSQL is the query language of iModels

An iModel is an SQLite database. SQLite has extensive support for SQL, including indexing and comprehensive query planning. However, due to the mapping of BIS classes to database tables, direct use of SQL with iModels is not straightforward. Therefore, iModel.js includes [ECSQL](../learning/ecsql) to form qeuries of iModels in terms of classes and property names, rather than table and column names. Internally ECSQL is converted to SQL and passed to SQLite to achieve outstanding performance.