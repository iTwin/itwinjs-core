/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

/** Properties for an item provided by UiItemsProvider
 * @deprecated in 3.6. Use [ProviderItem]($appui-react) instead.
 * @public
 */
export interface ProvidedItem {
  /** id of UiItemsProvider */
  readonly providerId?: string;
}
