/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import * as React from "react";
import { Logger } from "@itwin/core-bentley";
import {
  BackstageActionItem, BackstageItem, BackstageStageLauncher, ConditionalBooleanValue, ConditionalStringValue, isStageLauncher,
} from "@itwin/appui-abstract";
import { BadgeUtilities, Icon } from "@itwin/core-react";
import { BackstageItem as NZ_BackstageItem } from "@itwin/appui-layout-react";
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
      itemId={item.id}
      icon={<Icon iconSpec={ConditionalStringValue.getValue(item.icon)} />}
      isActive={ConditionalBooleanValue.getValue(item.isActive)}
      isDisabled={ConditionalBooleanValue.getValue(item.isDisabled)}
      onClick={handleClick}
      subtitle={ConditionalStringValue.getValue(item.subtitle)}
      badge={BadgeUtilities.getComponentForBadgeType(item.badgeType)}
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
    if (!FrontstageManager.hasFrontstage(item.stageId))
      return Logger.logError("BackstageComposerStageLauncher", `Frontstage with id '${item.stageId}' not found`);
    void FrontstageManager.setActiveFrontstage(item.stageId);
  }, [manager, item.stageId]);
  const activeFrontstageId = useActiveFrontstageId();
  const isActive = ConditionalBooleanValue.getValue(item.isActive ?? item.stageId === activeFrontstageId);
  return (
    <NZ_BackstageItem
      itemId={item.id}
      icon={<Icon iconSpec={ConditionalStringValue.getValue(item.icon)} />}
      isActive={isActive}
      isDisabled={ConditionalBooleanValue.getValue(item.isDisabled)}
      onClick={handleClick}
      subtitle={ConditionalStringValue.getValue(item.subtitle)}
      badge={BadgeUtilities.getComponentForBadgeType(item.badgeType)}
    >
      {ConditionalStringValue.getValue(item.label)}
    </NZ_BackstageItem>
  );
}

/** Props of [[BackstageComposerItem]] component.
 * @internal
 */
export interface BackstageComposerItemProps {
  /** Backstage item to render */
  readonly item: BackstageItem;
}

/** Item of [[BackstageComposer]].
 * @internal
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
