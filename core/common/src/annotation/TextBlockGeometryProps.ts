/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { XYZProps } from "@itwin/core-geometry";
import { TextStringProps } from "../geometry/TextString";
import { TextStyleColor } from "./TextStyle";

export type TextBlockGeometryPropsEntry = {
  text: TextStringProps;
  separator?: never;
  color?: never;
} | {
  text?: never;
  separator: {
    startPoint: XYZProps;
    endPoint: XYZProps;
  };
  color?: never;
} | {
  text?: never;
  separator?: never;
  color:TextStyleColor;
};

export type TextBlockGeometryProps = {
  entries: TextBlockGeometryPropsEntry[];
}
