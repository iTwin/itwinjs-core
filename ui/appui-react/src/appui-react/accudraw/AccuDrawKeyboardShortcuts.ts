/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import type { KeyboardShortcutProps } from "../keyboardshortcut/KeyboardShortcut";
import { AccuDrawCommandItems } from "./AccuDrawCommandItems";
import { FrameworkAccuDraw } from "./FrameworkAccuDraw";

/** Default AccuDraw Keyboard Shortcuts
 * @beta
 */
export class AccuDrawKeyboardShortcuts {
  /** Get default AccuDraw Keyboard Shortcuts list.
   */
  public static getDefaultShortcuts(): KeyboardShortcutProps[] {
    const keyboardShortcutList: KeyboardShortcutProps[] = [
      {
        key: "a",
        labelKey: "UiFramework:accuDraw.subMenu",
        shortcuts: [
          {
            key: "s",
            item: AccuDrawCommandItems.lockSmart,
          },
          {
            key: "r",
            item: AccuDrawCommandItems.setOrigin,
          },
          {
            key: "t",
            item: AccuDrawCommandItems.changeCompassMode,
          },
          {
            key: "x",
            item: AccuDrawCommandItems.lockX,
            isHidden: FrameworkAccuDraw.isPolarModeConditional,
          },
          {
            key: "y",
            item: AccuDrawCommandItems.lockY,
            isHidden: FrameworkAccuDraw.isPolarModeConditional,
          },
          {
            key: "z",
            item: AccuDrawCommandItems.lockZ,
            isHidden: FrameworkAccuDraw.isPolarModeConditional,
          },
          {
            key: "a",
            item: AccuDrawCommandItems.lockAngle,
            isHidden: FrameworkAccuDraw.isRectangularModeConditional,
          },
          {
            key: "d",
            item: AccuDrawCommandItems.lockDistance,
            isHidden: FrameworkAccuDraw.isRectangularModeConditional,
          },
          {
            key: "b",
            item: AccuDrawCommandItems.bumpToolSetting,
          },
        ],
      },
      {
        key: "r",
        labelKey: "UiFramework:accuDraw.rotateSubMenu",
        shortcuts: [
          {
            key: "t",
            item: AccuDrawCommandItems.rotateTop,
            isDisabled: FrameworkAccuDraw.isTopRotationConditional,
          },
          {
            key: "s",
            item: AccuDrawCommandItems.rotateSide,
            isDisabled: FrameworkAccuDraw.isSideRotationConditional,
          },
          {
            key: "f",
            item: AccuDrawCommandItems.rotateFront,
            isDisabled: FrameworkAccuDraw.isFrontRotationConditional,
          },
          {
            key: "v",
            item: AccuDrawCommandItems.rotateView,
            isDisabled: FrameworkAccuDraw.isViewRotationConditional,
          },
          {
            key: "c",
            item: AccuDrawCommandItems.rotateCycle,
          },
          {
            key: "a",
            item: AccuDrawCommandItems.rotateAxes,
          },
          {
            key: "e",
            item: AccuDrawCommandItems.rotateToElement,
          },
        ],
      },
    ];

    return keyboardShortcutList;
  }
}
