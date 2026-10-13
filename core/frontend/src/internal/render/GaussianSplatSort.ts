/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** Number of splats in one shared GPU page: one 256-texel row of the atlas, the unit of tile allocation. @internal */
export const gaussianSplatsPerPage = 128;
