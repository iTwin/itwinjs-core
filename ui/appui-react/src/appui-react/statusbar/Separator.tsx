/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import "./Separator.scss";
import * as React from "react";
import { CommonProps } from "@itwin/core-react";
import { FooterSeparator } from "@itwin/appui-layout-react";

/** Component used to separate status fields in a status bar.
 * @public
 */
export function StatusBarSeparator(props: CommonProps) {
  return (
    <FooterSeparator {...props} />
  );
}
