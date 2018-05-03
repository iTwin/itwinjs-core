# The Backend Library

The Backend refers to the layers of the iModelJs library that run on a computer with a copy of an iModel. The backend always runs in-process (i.e. in the same address space) with the native layers.

The backend:

* has direct access to the native library, and hence its methods are generally synchronous.
* has access to the local file system
* determines the JavaScript engine (vs. the frontend where the JavaScript engine comes from the user's browser). Usually that is V8 from Node.js
* may load third-party native code

When the backend is used by a frontend, that will usually be from another process - potentially on another computer. The only exception is mobile devices; in that case the backend and the frontend run in the same (only) process.

The backend library is delivered in the **npm package** `@bentley/imodeljs-backend`.

## IModelHost

## The Class Registry

## IModelDb

## Loading and Creating Elements

## ECSQL

* [What is ECSQL?](../learning/ECSQL)
* [Executing ECSQL statements](./ExecutingECSQL)
* [Code Examples](./ExecutingECSQL#code-examples)

## Dealing with Codes

## Change Summary

* [Change Summary Overview](../learning/ChangeSummaries)

## BriefcaseManager
