/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export const IMJS_GLOBAL_OBJECT = "__IMODELJS_INTERNALS_DO_NOT_USE";
export const IMJS_GLOBAL_LIBS = `${IMJS_GLOBAL_OBJECT}.SHARED_LIBS`;
export const IMJS_GLOBAL_LIBS_VERS = `${IMJS_GLOBAL_LIBS}_VERS`;

/** List of dependencies that are not iTwin.js specific are required to be shared between an Extension and an App to avoid runtime issues with multiple versions.
 */
export const ADDITIONAL_SHARED_LIBRARIES = [
  "react",
  "react-dom",
  "react-redux",
];
