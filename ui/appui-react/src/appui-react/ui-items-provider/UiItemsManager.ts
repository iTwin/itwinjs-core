/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module UiProvider
 */

import {
  AllowedUiItemProviderOverrides as UIA_AllowedUiItemProviderOverrides,
  UiItemProviderOverrides as UIA_UiItemProviderOverrides,
  UiItemProviderRegisteredEventArgs as UIA_UiItemProviderRegisteredEventArgs,
  UiItemsManager as UIA_UiItemsManager,
} from "@itwin/appui-abstract";

/** UiItemsProvider register event args.
 * @beta
 */
export type UiItemsProviderRegisteredEventArgs = UIA_UiItemProviderRegisteredEventArgs;

/** UiItemsProvider overrides allows the application that registers a provider to limit when it is allowed to provide items
 * @beta
 */
export type AllowedUiItemsProviderOverrides = UIA_AllowedUiItemProviderOverrides;

/** Allowed overrides applied to a UiItemsProvider the application that registers a provider to limit when it is allowed to provide items.
 * Note that if an override `providerId` is specified then either `stageIds` or `stageUsages` must be defined to limit when the provider's
 * items are allowed.
 * @beta
 */
export type UiItemsProviderOverrides = UIA_UiItemProviderOverrides;

/** Controls registering of UiItemsProviders and calls the provider's methods when populating different parts of the User Interface.
 * @beta
 */
export class UiItemsManager extends UIA_UiItemsManager {
}
