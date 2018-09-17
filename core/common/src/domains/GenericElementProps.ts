/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { GeometricElement2dProps, RelatedElementProps } from "../ElementProps";

export interface ViewAttachmentLabelProps extends GeometricElement2dProps {
  viewAttachment?: RelatedElementProps;
}

export interface CalloutProps extends GeometricElement2dProps {
  drawingModel?: RelatedElementProps;
}
