/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Text */

import * as React from "react";
import { TextProps } from "./TextProps";
import { StyledText } from "./StyledText";

/** Styled small text React functional component
 * @beta
 */
export const SmallText: React.FunctionComponent<TextProps> = (props: TextProps) => {  // tslint:disable-line:variable-name
  return <StyledText {...props} mainClassName="uicore-text-small" />;
};
