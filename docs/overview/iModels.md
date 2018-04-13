# What is an iModel?

## iModel Overview

An iModel is a distributed relational database, based on [SQLite](https://www.sqlite.org/index.html), that holds information about an infrastructure asset defined in BIS. iModels may contain physical and functional models, drawings, specifications, analytical models, etc.

Many copies of an iModel may be extant simultaneously, each held in a *Briefcase* and synchronized via *ChangeSets* from iModelHub. For programmers, a helpful analogy is Git and GitHub. In the same manner that every programmer has a full copy of a source code repository, with iModels every user has a full copy of the database.

## Every iModel has a Guid