/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeEvent } from "@itwin/core-bentley";
import { IconSpec } from "@itwin/core-react";
import { CommandItemDef } from "../shared/CommandItemDef";

/** Arguments of [[Backstage.onToggled]].
 * @public
 */
export interface BackstageToggledArgs {
  readonly isOpen: boolean;
}

/**
 * [[UiFramework.backstage]] interface.
 * @public
 */
export interface FrameworkBackstage {
  /**
   * Event activated when the backstage is toggled.
   */
  readonly onToggled: BeEvent<(args: BackstageToggledArgs) => void>;
  /**
   * State of the backstage.
   */
  isOpen: boolean;
  /**
   * Display the backstage.
   */
  open(): void;
  /**
   * Hides the backstage.
   */
  close(): void;
  /**
   * Toggle the backstage.
   */
  toggle(): void;
  /**
   * Creates a CommandItemDef that toggle the backstage.
   * @param overrideIconSpec Icon to replace the default 'home'.
   */
  getBackstageToggleCommand(overrideIconSpec?: IconSpec): CommandItemDef;
}
