/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { XYZProps } from "@itwin/core-geometry";
import { TextStringProps } from "../geometry/TextString";
import { ColorDefProps } from "../ColorDef";

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
  color:ColorDefProps;
};

export type TextBlockGeometryProps = {
  entries: TextBlockGeometryPropsEntry[];
}
