/* eslint-disable @typescript-eslint/no-empty-interface */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CompartmentControl } from "./CompartmentControl";

/** @deprecated in 4.3 use CompartmentKey
 * @internal
 */
export type ChannelKey = string;

/** @deprecated in 4.3 use CompartmentControl
 * @internal
 */
export interface ChannelControl extends CompartmentControl { }

/** @deprecated in 4.3 use CompartmentControl
 * @internal
 */
export namespace ChannelControl {
  /** @deprecated in 4.3 use sharedCompartmentControl
   * @internal
   */
  export const sharedChannelName = CompartmentControl.sharedCompartmentName;
}
