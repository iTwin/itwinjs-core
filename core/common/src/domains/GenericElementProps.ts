/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { GeometricElement2dProps, RelatedElementProps } from "../ElementProps";

export interface ViewAttachmentLabelProps extends GeometricElement2dProps {
  viewAttachment?: RelatedElementProps;
}

export interface CalloutProps extends GeometricElement2dProps {
  drawingModel?: RelatedElementProps;
}
