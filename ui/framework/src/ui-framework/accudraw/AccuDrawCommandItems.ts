/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import { AccuDrawShortcuts, RotationMode } from "@bentley/imodeljs-frontend";
import { CommandItemDef } from "../../ui-framework";

/** AccuDraw Command Items - useful in Keyboard Shortcuts
 * @alpha
 */
// istanbul ignore next
export class AccuDrawCommandItems {
  public static get lockSmart() {
    return new CommandItemDef({
      commandId: "lockSmart",
      labelKey: "UiFramework:accuDraw.lockSmart",
      execute: () => AccuDrawShortcuts.lockSmart(),
    });
  }

  public static get lockX() {
    return new CommandItemDef({
      commandId: "lockX",
      labelKey: "UiFramework:accuDraw.lockX",
      execute: () => AccuDrawShortcuts.lockX(),
    });
  }

  public static get lockY() {
    return new CommandItemDef({
      commandId: "lockY",
      labelKey: "UiFramework:accuDraw.lockY",
      execute: () => setTimeout(() => AccuDrawShortcuts.lockY()),
    });
  }

  public static get lockZ() {
    return new CommandItemDef({
      commandId: "lockZ",
      labelKey: "UiFramework:accuDraw.lockZ",
      execute: () => setTimeout(() => AccuDrawShortcuts.lockZ()),
    });
  }

  public static get lockAngle() {
    return new CommandItemDef({
      commandId: "lockAngle",
      labelKey: "UiFramework:accuDraw.lockAngle",
      execute: () => setTimeout(() => AccuDrawShortcuts.lockAngle()),
    });
  }

  public static get lockDistance() {
    return new CommandItemDef({
      commandId: "lockDistance",
      labelKey: "UiFramework:accuDraw.lockDistance",
      execute: () => setTimeout(() => AccuDrawShortcuts.lockDistance()),
    });
  }

  public static get changeCompassMode() {
    return new CommandItemDef({
      commandId: "changeCompassMode",
      labelKey: "UiFramework:accuDraw.changeCompassMode",
      execute: () => setTimeout(() => AccuDrawShortcuts.changeCompassMode()),
    });
  }

  public static get rotateTop() {
    return new CommandItemDef({
      commandId: "rotateTop",
      labelKey: "UiFramework:accuDraw.rotateTop",
      execute: () => AccuDrawShortcuts.setStandardRotation(RotationMode.Top),
    });
  }

  public static get rotateFront() {
    return new CommandItemDef({
      commandId: "rotateFront",
      labelKey: "UiFramework:accuDraw.rotateFront",
      execute: () => AccuDrawShortcuts.setStandardRotation(RotationMode.Front),
    });
  }

  public static get rotateSide() {
    return new CommandItemDef({
      commandId: "rotateSide",
      labelKey: "UiFramework:accuDraw.rotateSide",
      execute: () => AccuDrawShortcuts.setStandardRotation(RotationMode.Side),
    });
  }

  public static get rotateView() {
    return new CommandItemDef({
      commandId: "rotateView",
      labelKey: "UiFramework:accuDraw.rotateView",
      execute: () => AccuDrawShortcuts.setStandardRotation(RotationMode.View),
    });
  }

  public static get setOrigin() {
    return new CommandItemDef({
      commandId: "setOrigin",
      labelKey: "UiFramework:accuDraw.setOrigin",
      execute: () => AccuDrawShortcuts.setOrigin(),
    });
  }

  public static get rotateCycle() {
    return new CommandItemDef({
      commandId: "rotateCycle",
      labelKey: "UiFramework:accuDraw.rotateCycle",
      execute: () => AccuDrawShortcuts.rotateCycle(),
    });
  }

  public static get rotateAxes() {
    return new CommandItemDef({
      commandId: "rotateAxes",
      labelKey: "UiFramework:accuDraw.rotateAxes",
      execute: () => AccuDrawShortcuts.rotateAxes(true),
    });
  }

  public static get rotateToElement() {
    return new CommandItemDef({
      commandId: "rotateToElement",
      labelKey: "UiFramework:accuDraw.rotateToElement",
      execute: () => AccuDrawShortcuts.rotateToElement(),
    });
  }

  public static get defineACSByPoints() {
    return new CommandItemDef({
      commandId: "defineACSByPoints",
      labelKey: "UiFramework:accuDraw.defineACSByPoints",
      execute: () => AccuDrawShortcuts.defineACSByPoints(),
    });
  }
}
