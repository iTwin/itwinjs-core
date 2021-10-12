/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import * as React from "react";
import { withOnOutsideClick } from "../hocs/withOnOutsideClick";
import { CommonDivProps } from "../utils/Props";

/** Div element with Outside Click behavior
 * @public
 */
export const DivWithOutsideClick = withOnOutsideClick((props: CommonDivProps) => (<div {...props} />)); // eslint-disable-line @typescript-eslint/naming-convention
