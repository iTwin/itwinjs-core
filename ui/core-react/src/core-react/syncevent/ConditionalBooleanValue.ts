/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { ConditionalBooleanValue as AbstractConditionalBooleanValue } from "@itwin/appui-abstract";

/** Class used to return a boolean value. The boolean value is refreshed by using the specified function. The syncEventIds define one or more
 * eventIds that would require the testFunc to be rerun.
 * @public
 */
export class ConditionalBooleanValue extends AbstractConditionalBooleanValue {
}
