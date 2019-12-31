/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as React from "react";
import { withOnOutsideClick } from "../hocs/withOnOutsideClick";
import { CommonDivProps } from "../utils/Props";

/** Div element with Outside Click behavior
 * @beta
 */
export const DivWithOutsideClick = withOnOutsideClick((props: CommonDivProps) => (<div {...props} />)); // tslint:disable-line:variable-name
