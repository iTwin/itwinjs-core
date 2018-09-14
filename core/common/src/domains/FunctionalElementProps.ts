/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { ElementProps, RelatedElementProps } from "../ElementProps";

export interface FunctionalElementProps extends ElementProps {
  typeDefinition?: RelatedElementProps;
}
