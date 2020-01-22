/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Text
 */

import * as React from "react";
import { TextProps } from "./TextProps";
import { StyledText } from "./StyledText";

/** Styled body text React functional component
 * @public
 */
export const BodyText: React.FunctionComponent<TextProps> = (props: TextProps) => {  // tslint:disable-line:variable-name
  return <StyledText {...props} mainClassName="uicore-text-body" />;
};
