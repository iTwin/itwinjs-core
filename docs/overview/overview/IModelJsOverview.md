# The iModelJs Library

The iModelJs library provides a JavaScript api for creating, querying, displaying, and modifying iModels.

## iModel Overview

## iModelJs Organization

The iModelJs library is divided into these sub-packages

|Package Name|Description|
|--|--
|**@bentley/bentleyjs-core**|Utility classes and functions that can be run in either the frontend or the backend.
|**@bentley/geometry-core**|A library of classes and functions for operations on 2d and 3d geometry.
|**@bentley/imodeljs-backend** |The part of the iModelJs library that runs in Node.js The backend code communicates with the frontend via the Gateway. Often the backend code runs on a server, but it may also run on a desktop (see Electron) or mobile devices.
|**@bentley/imodeljs-frontend**|The part of the iModelJs library that runs in a web browser. The frontend utilizes the HTML document paradigm.
|**@bentley/imodeljs-native**|The part of the iModelJs library that performs low-level I/O to an iModel. **@bentley/imodeljs-backend** depends on this library.

## iModelHub Overview

## iModel Bridges Overview