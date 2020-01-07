/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { GeometricElement2dProps, RelatedElementProps } from "../ElementProps";

/** @public */
export interface ViewAttachmentLabelProps extends GeometricElement2dProps {
  viewAttachment?: RelatedElementProps;
}

/** @public */
export interface CalloutProps extends GeometricElement2dProps {
  drawingModel?: RelatedElementProps;
}
