/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiProvider
 */

import { UiItemsProvider as UIA_UiItemsProvider } from "@itwin/appui-abstract";

/** Describes interface of objects that want to provide UI component to the running IModelApp.
 * @beta
 */
export type UiItemsProvider = UIA_UiItemsProvider; // eslint-disable-line deprecation/deprecation
