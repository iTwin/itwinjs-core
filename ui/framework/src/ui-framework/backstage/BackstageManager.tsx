/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import * as React from "react";
import { BeEvent } from "@bentley/bentleyjs-core";
import { IconSpec } from "@bentley/ui-core";
import { CommandItemDef } from "../shared/CommandItemDef";
import { UiFramework } from "../UiFramework";
import { Backstage } from "./Backstage";

/** Arguments of [[BackstageManager.onToggled]].
 * @beta
 */
export interface BackstageToggledArgs {
  readonly isOpen: boolean;
}

/** Controls backstage.
 * @beta
 */
export class BackstageManager {
  private _isOpen = false;

  /** Event raised when backstage is opened or closed. */
  public readonly onToggled = new BeEvent<(args: BackstageToggledArgs) => void>();

  public get isOpen() {
    return this._isOpen;
  }

  private setIsOpen(isOpen: boolean) {
    if (isOpen === this._isOpen)
      return;
    this._isOpen = isOpen;
    this.onToggled.raiseEvent({
      isOpen,
    });
    Backstage.onBackstageEvent.emit({ isVisible: isOpen }); // eslint-disable-line deprecation/deprecation
  }

  public open() {
    this.setIsOpen(true);
  }

  public close() {
    this.setIsOpen(false);
  }

  public toggle() {
    this.setIsOpen(!this.isOpen);
  }

  /** Get CommandItemDef that will toggle display of Backstage and allow iconSpec to be overridden */
  public static getBackstageToggleCommand(overrideIconSpec?: IconSpec) {
    return new CommandItemDef({
      commandId: "UiFramework.openBackstage",
      iconSpec: overrideIconSpec ? overrideIconSpec : "icon-home",
      labelKey: "UiFramework:commands.openBackstage",
      execute: () => {
        UiFramework.backstageManager.toggle();
      },
    });
  }
}

/** Hook that returns isOpen flag of the backstage.
 * @beta
 */
export const useIsBackstageOpen = (manager: BackstageManager) => {
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
 * @beta
 */
export const useBackstageManager = () => {
  const [manager] = React.useState(UiFramework.backstageManager);
  return manager;
};
