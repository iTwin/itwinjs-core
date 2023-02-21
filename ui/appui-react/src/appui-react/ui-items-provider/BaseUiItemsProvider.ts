/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module UiProvider
 */

import { BaseUiItemsProvider as UIA_BaseUiItemsProvider } from "@itwin/appui-abstract";

/** Base implementation of a UiItemsProvider. The base class allows the user to pass in a function that is used to determine if the
 * active stage should be provided items. Derived provider classes should override the `xxxInternal` methods to provide items.
 * @beta
 */
export class BaseUiItemsProvider extends UIA_BaseUiItemsProvider {
}
