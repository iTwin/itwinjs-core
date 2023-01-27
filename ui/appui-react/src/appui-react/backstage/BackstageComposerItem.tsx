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
import { BadgeUtilities, Icon, IconHelper } from "@itwin/core-react";
import { BackstageItem as NZ_BackstageItem } from "@itwin/appui-layout-react";
import { useActiveFrontstageId } from "../frontstage/Frontstage";
import { useBackstageManager } from "./BackstageManager";
import { UiFramework } from "../UiFramework";

/** @internal */
export interface BackstageComposerActionItemProps {
  readonly item: BackstageActionItem; // eslint-disable-line deprecation/deprecation
}

/** @internal */
export function BackstageComposerActionItem({ item }: BackstageComposerActionItemProps) {
  const manager = useBackstageManager();
  const iconSpec = IconHelper.getIconReactNode (item.icon, item.internalData);
  const handleClick = React.useCallback(() => {
    manager.close();
    item.execute();
  }, [manager, item]);
  return (
    <NZ_BackstageItem
      itemId={item.id}
      providerId={item.providerId}
      itemPriority={item.itemPriority}
      groupPriority={item.groupPriority}
      icon={<Icon iconSpec={iconSpec} />}
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
  readonly item: BackstageStageLauncher; // eslint-disable-line deprecation/deprecation
}

/** @internal */
export function BackstageComposerStageLauncher({ item }: BackstageComposerStageLauncherProps) {
  const manager = useBackstageManager();
  const handleClick = React.useCallback(() => {
    manager.close();
    if (!UiFramework.frontstages.hasFrontstage(item.stageId))
      return Logger.logError("BackstageComposerStageLauncher", `Frontstage with id '${item.stageId}' not found`);
    void UiFramework.frontstages.setActiveFrontstage(item.stageId);
  }, [manager, item.stageId]);
  const activeFrontstageId = useActiveFrontstageId();
  const isActive = ConditionalBooleanValue.getValue(item.isActive ?? item.stageId === activeFrontstageId);
  const iconSpec = IconHelper.getIconReactNode (item.icon, item.internalData);
  return (
    <NZ_BackstageItem
      itemId={item.id}
      providerId={item.providerId}
      itemPriority={item.itemPriority}
      groupPriority={item.groupPriority}
      icon={<Icon iconSpec={iconSpec} />}
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
  readonly item: BackstageItem; // eslint-disable-line deprecation/deprecation
  readonly providerId?: string;
}

/** Item of [[BackstageComposer]].
 * @internal
 */
export function BackstageComposerItem({ item }: BackstageComposerItemProps) {
  if (isStageLauncher(item)) { // eslint-disable-line deprecation/deprecation
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
