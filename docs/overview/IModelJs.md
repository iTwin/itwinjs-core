# The iModelJs Library

The iModelJs library is a JavaScript api for creating, querying, displaying, and modifying iModels.

## Using iModelJs

The iModelJs library is a comprehensive set of services that are designed to be used anywhere an iModel may be relevant. From the same codebase, it is possible to create:

* [Backend](./Agents) agents and services that process iModels and respond to events from iModelHub
* [Web](./WebApps) applications that run in web browsers and communication with Backends
* [Desktop](./DesktopApps) applications that run on personal computers
* [Mobile](./MobileApps) application that run on tablets and phones

## iModelJs Organization

The iModelJs library is divided into these sub-packages:

|Package Name|Description|
|--|--
|**@bentley/bentleyjs-core**|Utility classes and functions that can be run in either the frontend or the backend.
|**@bentley/geometry-core**|A library of classes and functions for operations on 2d and 3d geometry.
|**@bentley/imodeljs-backend** |The part of the iModelJs library that runs in Node.js The backend code communicates with the frontend via a Gateway. Often the backend code runs on a server, but it may also run on a desktop (see [Electron](https://electronjs.org)) or on a mobile device.
|**@bentley/imodeljs-frontend**|The part of the iModelJs library that runs in a web browser. The frontend utilizes the HTML document paradigm.
|**@bentley/imodeljs-native**|The part of the iModelJs library that performs low-level I/O to an iModel. @bentley/imodeljs-backend depends on this library.

## iModel Overview

An iModel is a distributed relational database, based on [SQLite](https://www.sqlite.org/index.html), that holds  information about an infrastructure asset defined in BIS. iModels may contain physical and functional models, drawings, specifications, analytical models, etc.

Many copies of an iModel may be extant simultaneously, each held in a Briefcase and synchronized via ChangeSets from iModelHub


iModelHub is a cloud service that stores the iModel as a timeline of changes. Services and applications can obtain
a copy of the iModel from iModelHub and subscribe to notifications of changes added to the iModel’s timeline.

Upon notification, they can receive the changes and apply them to their copy of the iModel, thereby synchronizing it. Existing file-based workflows are “bridged” with iModelHub through the ProjectWise iModel Bridge Service.

For more information on iModels and the iModelHub, see these [videos](https://www.bentley.com/en/yii/video-gallery#iModelHUB) or download the [white paper](https://www.bentley.com/en/perspectives-and-viewpoints/topics/viewpoint/wp-imodel-2-platform).

## iModelHub Overview

## iModel Bridges Overview

## JavaScript vs. TypeScript

iModelJs is written in [TypeScript](https://www.typescriptlang.org/). Even though it can be consumed in a pure JavaScript application, it is highly recommended that iModelJs application developers use TypeScript too.
