/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import * as React from "react";
import type { CommonDivProps } from "../utils/Props";
import { Div } from "./Div";

/** Scroll View React functional component.
 * Scrolls content vertically and
 * has the 'overflow-y: auto' CSS property and has a height and width of 100%.
 * @public
 */
export function ScrollView(props: CommonDivProps) {
  return <Div {...props} mainClassName="uicore-scrollview" />;
}
