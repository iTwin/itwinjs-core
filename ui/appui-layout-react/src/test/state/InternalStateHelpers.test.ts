/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect, should } from "chai";
import { castDraft, produce } from "immer";
import { Point, Rectangle } from "@itwin/core-react";
import {
  addFloatingWidget, addPanelWidget, addPopoutWidget, addTab, createNineZoneState, findTab, NineZoneStateReducer, removeTab,
} from "../../appui-layout-react";
import {
  isTabDragDropTargetState,
  isWidgetDragDropTargetState,
  removeTabFromWidget,
} from "../../appui-layout-react";
import { addTabs } from "../Utils";
