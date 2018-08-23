/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
export * from "./BaseHandler";
export * from "./Query";
export * from "./Errors";
export * from "./Briefcases";
export * from "./ChangeSets";
export * from "./Codes";
export * from "./Events";
export * from "./GlobalEvents";
export * from "./iModels";
export * from "./Locks";
export * from "./Users";
export * from "./Versions";
export * from "./Thumbnails";

// NOTE: Classes with backend-specific dependencies (like "fs") must be kept out of the "barrel" to avoid unacceptable webpack trickery on the frontend.
// NOTE: Do not export AzureFileHandler - "fs" dependency
