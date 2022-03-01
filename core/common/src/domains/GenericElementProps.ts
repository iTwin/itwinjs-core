/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Entities
 */

import { GeometricElement2dProps, RelatedElementProps } from "../ElementProps";

/**
 * @public
 * @extensions
 */
export interface ViewAttachmentLabelProps extends GeometricElement2dProps {
  viewAttachment?: RelatedElementProps;
}

/**
 * @public
 * @extensions
 */
export interface CalloutProps extends GeometricElement2dProps {
  drawingModel?: RelatedElementProps;
}
