# iTwin.js Code Service

## Codes Overview

[iTwin.js](https://www.itwinjs.org) is a platform for infrastructure digital twins that provides techniques for creating digital models of real world assets such that the physical world and the digital world are *connected*. In iTwin.js, digital models are persisted in [iModels](https://www.itwinjs.org/learning/glossary/#imodel), according to the rules of [BIS](https://www.itwinjs.org/bis/). [Codes](https://www.itwinjs.org/bis/guide/fundamentals/codes/) play an integral role in forming the connection between the physical world and the digital world.

A fundamental concept is that real-world entities often have a human-understandable "name" that uniquely identifies it. Just as there are many and varied naming conventions for things in the real world, there are also many and varied "coding conventions" used by companies, projects, organizations, governments, etc. for naming assets. iTwin.js does not attempt to prescribe or proscribe any coding convention, but merely provide a software system to record and enforce those conventions.

### Code Basics

In iTwin.js, a [Code]($common) contains 3 parts:

 1. **Value**. A code's value is just a human-readable string, e.g. "Conference Room 10", "PMP-233", or "KPN-2343-1223a4", etc. In conversation, people will generally refer to a code's value as "the code" of an asset.
 2. **Scope**. Since code values are meant to be human readable, there must be some way to disambiguate the value by "context". "Conference Room 10" cannot be used in a meaningful conversation unless the context of its building or floor is somehow supplied or implied. The scope of a code supplies the *context* for its value. Unlike code values, the identifiers for scope are *not* meant to be human readable, and instead are in the form of [GUIDs](https://en.wikipedia.org/wiki/Universally_unique_identifier). Scope guids themselves identify real-world entities (a building, an floor within a building, a pipe run, etc.). In this manner we say that code values are implicitly "qualified by their scope".
 3. **Spec**. A *code specification* is merely a string that identifies the *type* of a code. In iTwin.js, every [Code]($common) includes a [CodeSpec]($common) for a few reasons:

- it provides information about how to *interpret* the code (i.e. the "coding convention")
- it can used to determine the "next available value" within a scope for codes that are arranged in sequences.
- it further qualifies the value/scope pairs by type, so that it is possible for a single scope to have multiple codes with the same value, but used for different purposes.

### External vs. Internal Codes

`CodeSpecs` that identify an entity external to the iModel (i.e. "in the real world") are stored on elements identified with a [FederationGuid](https://www.itwinjs.org/bis/guide/fundamentals/element-fundamentals#federationguid) that matches the GUID of the external entity. However, some `CodeSpecs` define names for entities that exist and are unique *only within an iModel* (e.g. the names of Models, Drawings, Categories, Styles, etc.). In that case they are are stored on elements that may be identified by their `ElementId`, and their `FederationGuid` does not represent any real-world entity. The former are referred to as *External Codes* (as indicated by `CodeSpec.isExternal === true`) and the latter as *Internal Codes*.

### Code Uniqueness Within an IModel

Within a single copy of an IModel, the database layer enforces that no two elements may have the same non-null Code (that is, elements do not need to have a Code, but if they have one it must be unique within the IModel.)

However, the uniqueness constraint at the IModel database level is necessary but not sufficient to enforce iTwin Code uniqueness because:

- there can be more than one `Briefcase` of an IModel being modified at the same time. Each Briefcase may hold a set of new elements whose Codes, while each unique within its Briefcase, would not be unique when combined.
- there can be *branches* of an IModel that when eventually merged could violate the uniqueness constraints
- Codes may be "decommissioned" such that they once were but are no longer associated with an element. They are ineligible for reuse even though they appear to be available in the iModel.
- organizations may wish to enforce Code uniqueness across one or more external non-iModel based coding systems.

`CodesService` provides an cloud-based index to determine whether a Code is unique within these constraints.

## CodeService in iTwin.js

The CodeService api provides separate indexes for external and internal Codes.

### External Codes

External `Code`s *uniquely identify* some real thing. That is, no two "things" in the real world (hereinafter "entities") may have the exact same Code. Likewise, in the digital world no two objects (hereinafter "elements") may have the exact same Code. An obvious question becomes "how does one enforce uniqueness," or more specifically "how can one determine the set of extant values" for a given scope and CodeSpec? Since the identity of a scope entity is *globally unique* by definition (it is a GUID), the problem does not need any form of "global registry", but merely a registry of codes used by entities *within a limited scope*.

Since iTwin.js is concerned only with digital twins of infrastructure assets, the definition of "limited scope" for iTwin.js is an iTwin. The `CodeService` api provides a *registry of known codes within an iTwin*.

The following rules may be helpful:

- Every iTwin may have an external `CodeService` index.
- A `CodeService` holds the set of known Codes, and properties of the Codes, for entities in its iTwin.
- Every entity with a Code must have a federation Guid. That is its identity in the `CodeService`.
- The rules for acquiring/reserving/validating new Codes are *not* the responsibility of the `CodeService`. It is generally expected that some other "master code service" (e.g. an enterprise ERP system) will create new Codes. The `CodeService` merely records them and enforces that Codes within it are unique.
- In the absence of some other master code service, a `CodeService` can be used as an *index* for creating new unique codes.
- The Codes in a `CodeService` may originate from external coding systems or from iModels. Therefore a Code in a `CodeService` may or may not relate to an element in an iModel.
- Every iModel may have only one `CodeService`. It must be for its iTwin, or one of its iTwin's parent iTwins.
- An iTwin may be comprised of one or more iModels, so Code uniqueness may also span iModels (that is, a Code may not be available in one iModel because it is already used in another iModel in the same iTwin.)
- If in element in an iModel with a `CodeService` has a Code, its `FederationGuid` must match the Guid in the `CodeService`.
- Elements in different iModels of an iTwin *may* have the same Code. The `CodeService` does *not* record where/if Codes are used, and cannot be used to "find" elements. However, the `CodeService` does record the "origin" of a Code. If the origin was an iModel, there's a good chance that there is (or was) an element in that iModel with that Code.

Reserving codes is distinct from inserting elements with codes into the iModel. An application or user may reserve codes (e.g. a range of sequential codes) ahead of time and then use them as needed.

### Internal Codes

Internal CodeSpecs identify elements within an iModel that must have unique names. The internal CodeService index holds the set of extant values across all briefcase and (potentially) branches of an iModel to avoid conflicts. Before a new element that uses an Internal CodeSpec may be added, the Code value must first be *reserved* in the Internal Code index of the `CodeService`.

## CodeService's Role in the "Code Ecosystem"

The purpose of the CodeService is to enforce uniqueness of Codes within an iTwin and to enforce that everywhere a Code is used, the correct `FederationGuid` is stored on its element. It does not provide any way of telling whether or where Codes are actually *used* on a project (though the `origin` property can give a clue where it *may* be.)

Many organizations will have an [ERP](https://en.wikipedia.org/wiki/Enterprise_resource_planning) system or some other "authority" used for managing their assets and identifiers. The usual workflow is to obtain "codes" from that system, and then enter their properties (CodeValue, CodeId) in the CodeService so they are tracked at the iTwin level. `CodeService` is not a replacement for an ERP, asset management, or inventory system. It merely stores values obtained from those systems.

However, there are some CodeSpecs that exist solely for concepts within the iTwin itself (e.g. Category names, Model Names, etc.) In that case the CodeService may be used to find new unique values for those Codes.

## CodeService API

The `CodeService` interface in iTwin.js provides an api to manage both external and internal Codes in an iModel. The `CodeService` can:

- be queried to find the properties of existing codes
- reserve one or more codes*
- update properties of one or more codes*
- delete one or more codes*

*all write operations must be performed with the write lock held.

### IModel Codes vs. CodeService

The [Code]($common) api in iTwin.js deals with `Codes` on [Element]($backend)s. For efficiency, the [Code.spec]($common) member holds a local Id into the [CodeSpecs]($backend) table in the iModel. Likewise, the [Code.scope]($common) member contains the element Id of the code scope element. Both of these values are *iModel local* identifiers, and are not appropriate for the iTwin `CodeService` api. The `CodeService` api deals with code specs by their name, and code scopes by [Guid]($bentley).

The helper function `CodeService.makeScopeAndSpec` converts an iModel-specific [CodeProps]($common) object into a `CodeService.ScopeAndSpec` object. To do this, it:

- converts the `FederationGuid` of the code scope element into the `scope` member
- converts the code spec Id into the name of the code spec as the `spec` member

### CodesDb

The `CodeService` api has a members called `externalCodes` and `internalCodes` that each implement the `CodesDb` api. A `CodesDb` is a local cache of the set of Codes as of some point of time in the past. It has fast and efficient methods to query the set of Codes in the `CodesDb`. Since it is a local cache, each user's use of their `CodesDb` has no impact on other users, nor does reading from a `CodesDb` block others from writing to it.

`CodesDb` has methods to get the properties of Codes and code specs, as well as to iterate over them, optionally applying a filter:

- `isCodePresent` to check if a Code exists
- `getCode` to get the properties of a code, given its Guid
- `findCode` to look up a code by value/scope
- `forAllCodes` to iterate over a set of Codes
- `getCodeSpec` to get the properties of a code spec
- `forAllCodeSpecs` to iterate over a set of code specs

The method `synchronizeWithCloud` brings the `CodesDb` up to date with the current version in the cloud.

### Reserving Codes via the CodeService API

Elements in an iModel may only be changed by adding, deleting, or modifying them in a Briefcase. When a Briefcase of an iModel with a `CodeService` is opened for write, it is *connected* to the `CodeService`. The CodeService enforces that new elements with a Code (or an update to the Code of an existing element):

1. Must have a entry in the CodeService for the new value/scope.
2. If the `FederationGuid` of the Code for the element provided, it must match the Guid of the Code in the CodeService. If it is undefined, the value in the CodeService is assigned.

The checks above may both be performed against the `CodeIndex`, even though it may be out-of-date with the server. If the check is successful, we can safely know that the Code is valid and unique for the iTwin. If the check fails, the addition or update of the element is rejected with an exception. In that case additional action is require to either reserve the Code, or refresh the local cache to reflect the fact that it was reserved by someone else on the user's behalf.

The expectation is that Codes are *reserved* by applications up-front, before creating new elements. Reserving new Codes requires a network connection and:

- the user must be authenticated and authorized by to access the `CodeService`
- only one user at a time may reserve Codes for an iTwin

Generally it is a good idea to reserve a group of codes together rather than one-at-a-time, if possible. To reserve codes, use:

- `reserveCode` to reserve a single code
- `reserveCodes` to reserve a set of codes

Here are the steps to follow.

The identity of the code service and information about how to connect are stored in the iModel persistently. When an app opens a briefcase for editing, the briefcase will connect to the code service using the connection information stored in the iModel and the user's credentials. The briefcase `.codeService` property will refer to the connected CodeService client, and apps must use that to reserve, update, and query codes and CodeSpecs.

Here is an example of using codeService to reserve a new internal code.

``` ts
const props = await BriefcaseManager.downloadBriefcase({ accessToken, iTwinId, iModelId, asOf: { afterChangeSetId }, briefcaseId: 0, fileName });
const iModel = await BriefcaseDb.open({ fileName: props.fileName });
```

``` ts
[[include:CodeService.reserveInternalCodeForNewElement]]
```

The logic to reserve an external code is similar - just use the `externalCodes` property instead.

Note that reserveCode is asynchronous and must be `await`ed. It updates the code index in the cloud.

Note the use of the `CodeService.makeProposedCode` helper function.

The `reserveCode` function will throw if the code is already reserved. If that happens when you are trying to insert a new element, it means that someone else has already reserved that code and you should choose a different one.

Don't call reserveCode when updating an existing element. If the element's code is changing, call `updateCode` before updating it.

In general, to find out if a code has been reserved, call findCode.

```ts
[[include:CodeService.findCode]]
```

There are also `CodeService` apis for updating properties of and deleting codes. They have the same rules for authentication and serialization as reserving Codes. They are:

- `updateCode` to modify the properties of a code
- `updateCodes` to modify the properties of a set of codes
- `deleteCodes` to delete a set of codes

For example,

``` ts
[[include:CodeService.updateInternalCodeForExistinglement]]
```

Note that the element's `federationGuid` is the Code's Guid.

### Managing and Creating CodeSpecs via the CodeService API

CodeService has an API for managing and creating CodeSpecs.

- `getCodeSpec`
- `addCodeSpec`

Here is an example of creating an internal CodeSpec that is scoped to a model.

```ts
[[include:CodeService.addInternalCodeSpec]]
```

### Code Sequences

Some types of Codes follow a *sequential* pattern wherein the value of a new Code is to be determined by applying a sequencing algorithm to the previous value.

Applications may supply their own code sequencing algorithm by implementing the interface `CodeService.CodeSequence`, supplying methods to get the first and last valid values, and a method to get the next value given another valid value. `CodeSequences` have a name, and can be registered with the `CodeService.registerSequence` and found via `CodeService.getSequence`.

A `CodeSequence` determines a pattern for code values within a "scope and spec". To reserve a code from a code sequence, use:

- `reserveNextAvailableCode`
- `reserveNextAvailableCodes`

and supply a `CodeService.SequenceScope` containing:

- the `CodeSequence`
- code scope Guid
- code spec name

along with one or more `CodeService.ProposedCodeProps`. The code value(s) will be returned in the `value` member.

Sometimes the sequence can be *full* for specific scope/spec and generate errors. See the documentation for details.

#### Reusing Holes in a Sequence

The combination of `CodeSequence`s and deleting codes causes some ambiguities. Sometimes applications wish to *reuse* deleted values (aka *holes*), and sometimes they do not. To control that, you can use:

- `CodeIndex.findNextAvailable`
- `CodeIndex.findHighestUsed`

in combination with `CodeService.SequenceScope.start`
