/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import { CommonProps } from "@itwin/core-react";
import { TitleBar } from "@itwin/appui-layout-react";

/** Properties of [[StatusBarDialogTitleBar]] component.
 * @beta
 */
export interface StatusBarDialogTitleBarProps extends CommonProps {
  /** Title bar buttons. */
  children?: React.ReactNode;
  /** Title bar title. */
  title?: string;
}

/** Dialog component used in a [[StatusBarDialog]] component.
* @beta
*/
export function StatusBarDialogTitleBar(props: StatusBarDialogTitleBarProps) {
  return <TitleBar {...props} />;
}
