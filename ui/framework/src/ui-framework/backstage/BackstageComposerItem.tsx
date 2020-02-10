/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import * as React from "react";
import { Logger } from "@bentley/bentleyjs-core";
import { Icon } from "@bentley/ui-core";
import { BackstageItem as NZ_BackstageItem } from "@bentley/ui-ninezone";
import {
  BackstageActionItem,
  BackstageStageLauncher,
  isStageLauncher,
  BackstageItem,
  ConditionalStringValue,
  ConditionalBooleanValue,
} from "@bentley/ui-abstract";
import { useActiveFrontstageId } from "../frontstage/Frontstage";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { useBackstageManager } from "./BackstageManager";

/** @internal */
export interface BackstageComposerActionItemProps {
  readonly item: BackstageActionItem;
}

/** @internal */
export function BackstageComposerActionItem({ item }: BackstageComposerActionItemProps) {
  const manager = useBackstageManager();
  const handleClick = React.useCallback(() => {
    manager.close();
    item.execute();
  }, [manager, item]);
  return (
    <NZ_BackstageItem
      icon={<Icon iconSpec={ConditionalStringValue.getValue(item.icon)} />}
      isDisabled={ConditionalBooleanValue.getValue(item.isDisabled)}
      onClick={handleClick}
      subtitle={ConditionalStringValue.getValue(item.subtitle)}
    >
      {ConditionalStringValue.getValue(item.label)}
    </NZ_BackstageItem>
  );
}

/** @internal */
export interface BackstageComposerStageLauncherProps {
  readonly item: BackstageStageLauncher;
}

/** @internal */
export function BackstageComposerStageLauncher({ item }: BackstageComposerStageLauncherProps) {
  const manager = useBackstageManager();
  const handleClick = React.useCallback(() => {
    manager.close();
    const frontstageDef = FrontstageManager.findFrontstageDef(item.stageId);
    if (!frontstageDef)
      return Logger.logError("BackstageComposerStageLauncher", `Frontstage with id '${item.stageId}' not found`);
    FrontstageManager.setActiveFrontstageDef(frontstageDef); // tslint:disable-line:no-floating-promises
  }, [manager, item.stageId]);
  const activeFrontstageId = useActiveFrontstageId();
  return (
    <NZ_BackstageItem
      icon={<Icon iconSpec={ConditionalStringValue.getValue(item.icon)} />}
      isActive={item.stageId === activeFrontstageId}
      isDisabled={ConditionalBooleanValue.getValue(item.isDisabled)}
      onClick={handleClick}
      subtitle={ConditionalStringValue.getValue(item.subtitle)}
    >
      {ConditionalStringValue.getValue(item.label)}
    </NZ_BackstageItem>
  );
}

/** Props of [[BackstageComposerItem]] component.
 * @beta
 */
export interface BackstageComposerItemProps {
  readonly item: BackstageItem;
}

/** Item of [[BackstageComposer]].
 * @beta
 */
export function BackstageComposerItem({ item }: BackstageComposerItemProps) {
  if (isStageLauncher(item)) {
    return (
      <BackstageComposerStageLauncher
        item={item}
      />
    );
  }
  return (
    <BackstageComposerActionItem
      item={item}
    />
  );
}
