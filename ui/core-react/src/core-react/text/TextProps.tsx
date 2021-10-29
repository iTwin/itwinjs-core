/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Text
 */

import * as React from "react";
import { CommonProps } from "../utils/Props";

/** Properties for various text components
 * @public
 */
export interface TextProps extends React.AllHTMLAttributes<HTMLSpanElement>, CommonProps { }
