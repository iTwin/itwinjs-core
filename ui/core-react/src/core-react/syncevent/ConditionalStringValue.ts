/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { ConditionalStringValue as AbstractConditionalStringValue } from "@itwin/appui-abstract";

/** Class used to return a string value. The string value is refreshed by using the specified function. The syncEventIds define one or more
 * eventIds that would require the stringGetter function to be rerun.
 * @public
 */
export class ConditionalStringValue extends AbstractConditionalStringValue {
}
