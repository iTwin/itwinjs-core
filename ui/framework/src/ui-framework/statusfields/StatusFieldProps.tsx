/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import { CommonProps } from "@bentley/ui-core";
import { StatusBarFieldId, IStatusBar } from "../widgets/StatusBarWidgetControl";

/** Properties for a StatusBar field component
 * @public
 */
export interface StatusFieldProps extends CommonProps {
  /** Interface to StatusBar */
  statusBar: IStatusBar;
  /** Indicates whether the StatusBar is in footer mode */
  isInFooterMode: boolean;
  /** Field Id for open widgets */
  openWidget: StatusBarFieldId;
}
