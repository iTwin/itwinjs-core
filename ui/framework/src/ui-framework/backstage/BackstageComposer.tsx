/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";

import { ConditionalDisplayType } from "@bentley/imodeljs-frontend";
import { AccessToken } from "@bentley/imodeljs-clients";

import { SeparatorBackstageItem } from "../backstage/Separator";
import { CommandLaunchBackstageItem } from "../backstage/CommandLaunch";
import { FrontstageLaunchBackstageItem } from "../backstage/FrontstageLaunch";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import {
  BackstageItemManager, BackstageItemProviderRegisteredEventArgs, BackstageItemType, BackstageItemSpec,
  ActionItemSpec, StageLauncher, CustomItemSpec,
} from "./BackstageItemManager";
import { Backstage, BackstageProps } from "../backstage/Backstage";
import { SessionStateActionId } from "../SessionState";
import { UiFramework } from "../UiFramework";

/** State for the BackstageComposer component.
 * @internal
 */
interface BackstageComposerState {
  frontstageId: string;
  accessToken: AccessToken | undefined;
}

/** BackstageComposer React component.
 * @beta
 */
export class BackstageComposer extends React.Component<BackstageProps, BackstageComposerState> {

  /** @internal */
  public readonly state: Readonly<BackstageComposerState>;

  constructor(props: BackstageProps) {
    super(props);

    this.state = {
      frontstageId: FrontstageManager.activeFrontstageId,
      accessToken: UiFramework.getAccessToken(),
    };
  }

  private _handleUiProviderRegisteredEvent = (_args: BackstageItemProviderRegisteredEventArgs): void => {
    this.forceUpdate();
  }

  public componentDidMount() {
    SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
    BackstageItemManager.onBackstageItemProviderRegisteredEvent.addListener(this._handleUiProviderRegisteredEvent);
  }

  public componentWillUnmount() {
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
    BackstageItemManager.onBackstageItemProviderRegisteredEvent.removeListener(this._handleUiProviderRegisteredEvent);
  }

  /** If any BackstageItem is listening for the sync event being processed the just regenerate backstage items so any updates are re-rendered. */
  private _handleSyncUiEvent = async (args: SyncUiEventArgs) => {
    let refreshRequired = false;

    for (const itemSpec of BackstageItemManager.getBackstageItemSpecs()) {
      // istanbul ignore else
      if (itemSpec.condition && itemSpec.condition.testFunc && itemSpec.condition.syncEventIds.length > 0 &&
        SyncUiEventDispatcher.hasEventOfInterest(args.eventIds, itemSpec.condition.syncEventIds)) {
        refreshRequired = true;
        break;
      }
    }

    if (!refreshRequired && SyncUiEventDispatcher.hasEventOfInterest(args.eventIds, [SessionStateActionId.SetAccessToken])) {
      refreshRequired = true;
    }

    if (refreshRequired) {
      this.setState({ accessToken: UiFramework.getAccessToken() });
    }
  }

  /** Called to get an array of ReactNodes to show in backstage menu.
   */
  public getBackstageItemNodes(): React.ReactNode[] {
    const itemNodes: React.ReactNode[] = [];
    let lastGroupPriority: number | undefined;

    // process the items in sorted order
    BackstageItemManager.getBackstageItemSpecs().sort((lhs: BackstageItemSpec, rhs: BackstageItemSpec) => {
      return (lhs.groupPriority * 10000 + lhs.itemPriority) - (rhs.groupPriority * 10000 + rhs.itemPriority);
    }).forEach((itemSpec: BackstageItemSpec) => {
      let enabled = true;
      let visible = true;
      if (itemSpec.condition && itemSpec.condition.testFunc) {
        if (itemSpec.condition.type === ConditionalDisplayType.Visibility)
          visible = itemSpec.condition.testFunc();
        else
          enabled = itemSpec.condition.testFunc();
      }

      if (visible) {
        // Add separator between groups of differing priorities
        if (undefined === lastGroupPriority) {
          lastGroupPriority = itemSpec.groupPriority;
        } else {
          if (lastGroupPriority !== itemSpec.groupPriority) {
            itemNodes.push(<SeparatorBackstageItem key={`backstage-item-separator-${lastGroupPriority}-${itemSpec.groupPriority}`} />);
            lastGroupPriority = itemSpec.groupPriority;
          }
        }
        // add specific backstage item
        if (itemSpec.itemType === BackstageItemType.ActionItem) {
          const actionSpec = itemSpec as ActionItemSpec;
          itemNodes.push(<CommandLaunchBackstageItem isEnabled={enabled} iconSpec={actionSpec.icon} commandId={actionSpec.itemId} execute={actionSpec.execute}
            label={actionSpec.label} description={actionSpec.subtitle} tooltip={actionSpec.tooltip} key={actionSpec.itemId} />);
        } else if (itemSpec.itemType === BackstageItemType.StageLauncher) {
          const launchSpec = itemSpec as StageLauncher;
          itemNodes.push(<FrontstageLaunchBackstageItem isEnabled={enabled} iconSpec={launchSpec.icon} frontstageId={launchSpec.stageId}
            label={launchSpec.label} description={launchSpec.subtitle} tooltip={launchSpec.tooltip} key={launchSpec.itemId} />);
        } else /* istanbul ignore else */ if (itemSpec.itemType === BackstageItemType.CustomItem) {
          const customSpec = itemSpec as CustomItemSpec;
          const provider = BackstageItemManager.getBackstageItemProvider(customSpec.customItemProviderId);
          // istanbul ignore else
          if (provider && provider.provideCustomBackstageItem) {
            const customItem = provider.provideCustomBackstageItem(customSpec);
            // istanbul ignore else
            if (customItem)
              itemNodes.push(customItem);
          }
        }
      }
    });
    return itemNodes;
  }
  public render(): React.ReactNode {
    return (
      <Backstage
        accessToken={this.state.accessToken}
        header={this.props.header}
        isVisible={this.props.isVisible}
        onClose={this.props.onClose}
        showOverlay={this.props.showOverlay}
      >
        {this.getBackstageItemNodes()}
      </Backstage>
    );
  }
}
