/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Entities
 */

import { ElementProps, RelatedElementProps } from "../ElementProps";

/** @public */
export interface FunctionalElementProps extends ElementProps {
  typeDefinition?: RelatedElementProps;
}
