/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

await import("@itwin/core-frontend");
const module = await import("../../../../core/frontend/lib/esm/common/imdl/ParseImdlDocument.js");
export const parseImdlDocument = module.parseImdlDocument;
