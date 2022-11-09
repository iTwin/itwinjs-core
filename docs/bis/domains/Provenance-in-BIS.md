# Provenence in iModels

## What is meant by "Provenence in iModels"

Provenence in iModels concerns the ability to trace an element in an iModel back to it's native, external source. Several classes are available in the BisCore schema version (> version 01.00.13) for modeling the sources-of-data of an iModel, to provide provenance information for Elements in the iModel. A RepositoryLink is a URL and it roughly maps to an external source file such as MicroStation _.dgn file or an IFC_.ifc file. The [ExternalSource](../bis/domains/BisCore.ecschema.md#externalsource) is used for external source files which are divided into smaller models. Models within a MicroStation \*.dgn are the primary use case for ExternalSource.
