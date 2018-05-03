# Accessing local Briefcases via the IModelDb class

A Briefcase is file that holds a local copy of an iModel. Briefcase files have a ".bim" (briefcase of iModel) extension.

The ($imodeljs-backend/IModelDb) class class provides methods for opening, closing, and accessing Briefcases. An instance of IModelDb in memory holds a Briefcase file open. Briefcases are obtained from iModelHub and are each assigned a unique Id called a `BriefcaseId`.

An IModelDb is used by a service or by the backend of an iModelJs app.

> Frontend code uses an ($imodeljs-backend/IModelConnection) to access an iModel indirectly, via a service or backend.

Use ($imodeljs-backend/IModelDb.open) to obtain and open an IModelDb from iModelHub.

An IModelDb provides access to the content of the iModel through the following members:

* ($imodeljs-backend/IModelDb.elements) for `Elements`
* ($imodeljs-backend/IModelDb.models) for `Models`

Use ($imodeljs-backend.ECSqlStatement) to write custom queries on the contents of an IModelDb.

As a local briefcase, an IModelDb represents a version of an iModel. Briefcases are synchronized via ChangeSets. Use ($imodeljs-backend/IModelDb.pullAndMergeChanges) to update a local IModelDb to incorporate recent changes made by other users.

An IModelDb also serves as a staging area where an app can change the content of an iModel and then submit the changes to iModelHub. Use ($imodeljs-backend/IModelDb.saveChanges) to commit changes locally. ($imodeljs-backend/IModelDb.txns) manages local transactions,  it supports local undo/redo.

Use ($imodeljs-backend/IModelDb.pushChanges) to push local changes to iModelHub as a changeset, so that others can see them. After a changeset is pushed to iModelHub, it becomes part of the iModel's permanent timeline.

An app that modifies models, elements, or codes must use ($imodeljs-backend/ConcurrencyControl) to coordinate with other users.