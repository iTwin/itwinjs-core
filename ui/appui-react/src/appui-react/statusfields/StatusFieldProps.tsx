/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import { CommonProps } from "@itwin/core-react";
import { StatusBarFieldId } from "../statusbar/StatusBarWidgetControl";

/** Properties for a StatusBar field component
 * @public
 */
export interface StatusFieldProps extends CommonProps {
  /** Indicates whether the StatusBar is in footer mode */
  isInFooterMode: boolean;
  /** Function called when the widget is opened or closed.
   * @deprecated In upcoming versions, this will be removed. Field will be have the freedom of handling their dialog behavior however they like.
  */
  onOpenWidget?: (widget: StatusBarFieldId) => void;
  /** Field Id for open widgets
   * @deprecated In upcoming versions, this will be removed. Field will be have the freedom of handling their dialog behavior however they like.
  */
  openWidget?: StatusBarFieldId;
}
