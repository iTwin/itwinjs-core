/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import { CommonProps } from "@itwin/core-react";
import { Dialog } from "@itwin/appui-layout-react";
import { StatusBarDialogTitleBar } from "./TitleBar";
import { StatusBarDialogTitleBarButton } from "./Button";

/** Properties of [[StatusBarDialog]] component.
 * @beta
 */
export interface StatusBarDialogProps extends CommonProps {
  /** Dialog content.  */
  children?: React.ReactNode;
  /** Dialog title bar. See [[StatusBarDialog.TitleBar]] */
  titleBar?: React.ReactNode;
}

/** Dialog component used in a [[StatusBarIndicator]] component.
 * @beta
 */
export function StatusBarDialog(props: StatusBarDialogProps) {
  return <Dialog {...props} />;
}

/** Components used in a [[StatusBarDialog]].
 * @beta
 */
export namespace StatusBarDialog {
  /** Title bar of a [[StatusBarDialog]]. */
  export const TitleBar = StatusBarDialogTitleBar;

  /** Title bar button of a [[StatusBarDialog]]. */
  export const TitleBarButton = StatusBarDialogTitleBarButton;
}
