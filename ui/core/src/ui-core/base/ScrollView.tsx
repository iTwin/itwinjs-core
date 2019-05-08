/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as React from "react";
import { CommonDivProps } from "../utils/Props";
import { Div } from "./Div";

/** Scroll View div
 * @beta
 */
// tslint:disable-next-line:variable-name
export const ScrollView: React.FunctionComponent<CommonDivProps> = (props) => {
  return <Div {...props} mainClassName="uicore-scrollview" />;
};
