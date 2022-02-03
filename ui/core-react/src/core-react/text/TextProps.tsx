/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Text
 */

import type * as React from "react";
import type { CommonProps } from "../utils/Props";

/** Properties for various text components
 * @public
 */
export interface TextProps extends React.AllHTMLAttributes<HTMLSpanElement>, CommonProps { }
