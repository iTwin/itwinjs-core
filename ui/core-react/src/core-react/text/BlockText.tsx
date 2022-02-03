/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Text
 */

import * as React from "react";
import { StyledText } from "./StyledText";
import type { TextProps } from "./TextProps";

/** Styled block text React functional component
 * @public
 */
export function BlockText(props: TextProps) {
  return <StyledText {...props} mainClassName="uicore-text-block" />;
}
