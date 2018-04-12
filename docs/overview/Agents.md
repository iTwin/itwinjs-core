# Creating Backends with iModelJs

In iModelJs terminology, a *backend* refers to a JavaScript program that runs inside a process (in the same address space)
that loads an iModel Briefcase via the **@bentley/imodeljs-native** package.

The imodeljs-native package is written in C++ (hence the term *native*) and can therefore never run inside a
web browser. It is usually loaded from [Node.js](https://nodejs.org), but is sometimes loaded by other
JavaScript engines (e.g. on mobile devices.)

The most important point to understand about the role of the backend is that it *must* have access to the Briefcase (.bim) as a local file.
The JavaScript class IModelDb provides methods for opening, closing, and accessing the Briefcase.

The imodeljs-backend page contains classes for connecting to iModelHub to check out Briefcases and to synchronize them via ChangeSets.

## Backends are synchronous

## Backend Agents

## Backend Services

Sometimes backend services can be written to support more than one frontend client simultaneously.

## Backends for Desktop applications

Desktop applications can be created with iModelJs using [Electron](https://electronjs.org/). In this case there are still two processes,
one for the backend and one for the frontend, but they physically reside on the same computer. The backend is still responsible for
accessing Briefcases, but obviously there will always be only one frontend connected to it. The programming paradigm for desktop
backends is unchanged from Agents and Services, but the connection to the frontend is through *pipes* that have both
