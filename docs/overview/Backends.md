# Creating Backends with iModelJs

In iModelJs terminology, a *backend* refers to a JavaScript program that runs inside a process (in the same address space)
that loads a Briefcase via the `@bentley/imodeljs-native` package.

The imodeljs-native package is written in C++ (hence the term *native*) and can therefore never run inside a
web browser. It is usually loaded from [Node.js](https://nodejs.org), but is sometimes loaded by other JavaScript engines (e.g. on mobile devices.)

> The term *backend* may be confusing, because backends can run "anywhere" - on servers, desktops, and even mobile devices. However, the term
*frontend* specifically refers to a program that runs inside a browser. For purposes of this discussion,
it may be helpful to think of backends as meaning *not in a browser*. For more on the meaning and purpose of these terms, see [this article](https://en.wikipedia.org/wiki/Front_and_back_ends).

An important point to understand about the role of the backend is that it *must* have access to a Briefcase (a ".bim" file) **as a local file**.
The [IModelDb]($imodeljs-backend.IModelDb) class provides methods for opening, closing, and accessing Briefcases. An instance of IModelDb in memory holds a Briefcase file open.

The imodeljs-backend package also contains classes for connecting to [iModelHub](./IModelHub) to check out Briefcases and to synchronize them via ChangeSets.

## Backends have synchronous access to iModels

## iModel Agents

An iModelJs backend program that performs an *unattended action*, upon being invoked by an event is called an `iModel Agent`. Agents do
not have any user interaction, so from an iModelJs perspective they are implemented as a backend program with no frontend. iModel Agents
are usually deployed using containers (e.g. Docker) and managed using a cloud orchestration framework (e.g. Kubernetes.)

As an example, consider an iModelJs Agent that receives notifications from iModelHub for every ChangeSet to a specific iModel.
The Agent could inspect every changeset using the [ChangeSummary]($imodeljs-backend.ChangeSummaryManager) api to ensure all
changes to its iModel are in compliance with company standards. A separate instance of the Agent would be deployed for each iModel of interest.

## iModel Services

An iModelJs backend program that responds to interactive requests from an [Web App](./WebApps) is called an `iModel Service`.
Sometimes iModel Services can be written to support more than one frontend client simultaneously.
The is often the case where frontends only perform read operations on an iModel.

iModel Services are usually connected to frontends via HTTP over an Internet connection. In that case obviously both
bandwidth and latency can vary widely, so care must be taken to limit number and size of round-trips between backend and frontends.

## Backends for Desktop applications

[Desktop applications](./DesktopApps) can be created with iModelJs using [Electron](https://electronjs.org/). In this case there are still two processes,
one for the backend and one for the frontend, but they physically reside on the same computer. The backend is still responsible for
accessing Briefcases, but there will obviously only be one frontend connected to it. The programming paradigm for desktop
backends is unchanged from Agents and Services, but the connection to the frontend is through *pipes* that have high bandwidth and low latency.
Whether running on desktops, mobile devices, or servers, the code for backend processing is identical.

## Backends for Mobile applications
