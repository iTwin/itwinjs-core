/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { IModelElementCloneContext } from "./IModelElementCloneContext";

// re-export both the type and the value of the class, and deprecate both

/** @deprecated use [[IModelElementCloneContext]] instead, @beta */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IModelCloneContext = IModelElementCloneContext;
/** @deprecated use [[IModelElementCloneContext]] instead, @beta */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type IModelCloneContext = IModelElementCloneContext;
