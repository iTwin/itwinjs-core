/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { CheckBoxState } from "@bentley/ui-core";

/**
 * Tree actions that can be performed on tree.
 * @beta
 */
export interface TreeActions {
  onNodeCheckboxClicked: (nodeId: string, newState: CheckBoxState) => void;
  onNodeExpanded: (nodeId: string) => void;
  onNodeCollapsed: (nodeId: string) => void;
  onNodeClicked: (nodeId: string, event: React.MouseEvent) => void;
  onNodeMouseDown: (nodeId: string) => void;
  onNodeMouseMove: (nodeId: string) => void;
}
