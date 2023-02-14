/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import * as React from "react";
import { IconSpec } from "@itwin/core-react";
import { UiFramework } from "../UiFramework";
import { BackstageToggledArgs, FrameworkBackstage } from "../framework/FrameworkBackstage";
import { InternalBackstageManager } from "./InternalBackstageManager";

/** Controls backstage.
 * @public
 */
export class BackstageManager {
  private internal = new InternalBackstageManager();

  /** Event raised when backstage is opened or closed. */
  public get onToggled() { return this.internal.onToggled; }

  public get isOpen() {
    return this.internal.isOpen;
  }

  public open() {
    return this.internal.open();
  }

  public close() {
    return this.internal.close();
  }

  public toggle() {
    return this.internal.toggle();
  }

  public getBackstageToggleCommand(overrideIconSpec?: IconSpec) {
    return this.internal.getBackstageToggleCommand(overrideIconSpec);
  }

  /** Get CommandItemDef that will toggle display of Backstage and allow iconSpec to be overridden
  */
  public static getBackstageToggleCommand(overrideIconSpec?: IconSpec) {
    return UiFramework.backstage.getBackstageToggleCommand(overrideIconSpec);
  }
}

/** Hook that returns isOpen flag of the backstage.
 * @public
 */
export const useIsBackstageOpen = (manager: FrameworkBackstage) => {
  const [isOpen, setIsOpen] = React.useState(manager.isOpen);
  React.useEffect(() => {
    const handleToggled = (args: BackstageToggledArgs) => {
      setIsOpen(args.isOpen);
    };
    setIsOpen(manager.isOpen);
    manager.onToggled.addListener(handleToggled);
    return () => {
      manager.onToggled.removeListener(handleToggled);
    };
  }, [manager]);
  return isOpen;
};

/** Hook that returns backstage manager.
 * @public
 */
export const useBackstageManager = () => {
  const [manager] = React.useState(UiFramework.backstage);
  return manager;
};
