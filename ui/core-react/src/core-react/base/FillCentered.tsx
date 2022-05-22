/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import * as React from "react";
import { CommonDivProps } from "../utils/Props";
import { Div } from "./Div";

/** Full height & width and centered React functional component.
 * Displays content centered vertically and horizontally and has a height and width of 100%.
 * @public
 */
export function FillCentered(props: CommonDivProps) {
  return <Div {...props} mainClassName="uicore-fill-centered" />;
}
