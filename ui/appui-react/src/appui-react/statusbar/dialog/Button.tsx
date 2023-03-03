/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import { CommonProps } from "@itwin/core-react";
import { TitleBarButton } from "@itwin/appui-layout-react";

/** Properties of [[StatusBarDialogTitleBarButton]] component.
 * @beta
 */
export interface StatusBarDialogTitleBarButtonProps extends CommonProps {
  /** Button content. */
  children?: React.ReactNode;
  /** Function called when button is clicked. */
  onClick?: () => void;
  /** Button title. */
  title?: string;
}

/** Dialog component used in a [[StatusBarDialog]] component.
* @beta
*/
export function StatusBarDialogTitleBarButton(props: StatusBarDialogTitleBarButtonProps) {
  return (
    <TitleBarButton {...props} />
  );
}
