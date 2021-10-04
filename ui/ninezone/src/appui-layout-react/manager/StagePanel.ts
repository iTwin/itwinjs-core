/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StagePanels
 */

import { getDefaultStagePanelManagerProps, StagePanelManager, StagePanelManagerProps } from "../stage-panels/manager/StagePanel";
import { StagePanelType } from "../stage-panels/StagePanel";
import { HorizontalAnchor, VerticalAnchor } from "../widget/Stacked";
import { WidgetZoneId } from "../zones/manager/Zones";
import { getDefaultNineZoneStagePanelPaneManagerProps, NineZoneStagePanelPaneManager, NineZoneStagePanelPaneManagerProps } from "./StagePanelPane";

/** Properties used by [[NineZoneStagePanelManager]].
 * @alpha
 */
export interface NineZoneStagePanelManagerProps extends StagePanelManagerProps {
  readonly panes: ReadonlyArray<NineZoneStagePanelPaneManagerProps>;
}

/** Returns default [[NineZoneStagePanelManagerProps]] object.
 * @alpha
 */
export const getDefaultNineZoneStagePanelManagerProps = (): NineZoneStagePanelManagerProps => ({
  ...getDefaultStagePanelManagerProps(),
  panes: [],
});

/** Class used to manage [[NineZoneStagePanelManagerProps]].
 * @alpha
 */
export class NineZoneStagePanelManager extends StagePanelManager {
  private _paneManagers?: Map<number, NineZoneStagePanelPaneManager>;

  public static getHorizontalAnchor(type: StagePanelType) {
    switch (type) {
      case StagePanelType.Left:
        return HorizontalAnchor.Left;
      default:
        return HorizontalAnchor.Right;
    }
  }

  public static getVerticalAnchor(type: StagePanelType) {
    switch (type) {
      case StagePanelType.Bottom:
        return VerticalAnchor.BottomPanel;
      case StagePanelType.Top:
        return VerticalAnchor.TopPanel;
      default:
        return VerticalAnchor.Middle;
    }
  }

  public addWidget<TProps extends NineZoneStagePanelManagerProps>(widgetId: WidgetZoneId, paneIndex: number | undefined, props: TProps): TProps {
    paneIndex = paneIndex === undefined ? props.panes.length : paneIndex;
    if (paneIndex > props.panes.length || paneIndex < 0)
      return props;
    const widgetKey = this.findWidget(widgetId, props);
    if (widgetKey)
      return props;

    let pane = paneIndex === props.panes.length ? getDefaultNineZoneStagePanelPaneManagerProps() : props.panes[paneIndex];
    const manager = this.getPaneManager(paneIndex);
    pane = manager.addWidget(widgetId, pane);
    return {
      ...props,
      panes: [
        ...props.panes.slice(0, paneIndex),
        pane,
        ...props.panes.slice(paneIndex + 1),
      ],
    };
  }

  public removeWidget<TProps extends NineZoneStagePanelManagerProps>(widgetId: WidgetZoneId, props: TProps): TProps {
    const widgetKey = this.findWidget(widgetId, props);
    if (!widgetKey)
      return props;

    const manager = this.getPaneManager(widgetKey.paneIndex);
    const pane = props.panes[widgetKey.paneIndex];
    const newPane = manager.removeWidget(widgetId, pane);
    if (newPane === pane)
      return props;

    return {
      ...props,
      panes: [
        ...props.panes.slice(0, widgetKey.paneIndex),
        ...newPane.widgets.length > 0 ? [newPane] : [],
        ...props.panes.slice(widgetKey.paneIndex + 1),
      ],
    };
  }

  public findWidget<TProps extends NineZoneStagePanelManagerProps>(widgetId: WidgetZoneId, props: TProps) {
    for (const [paneIndex, pane] of props.panes.entries()) {
      const widgetIndex = pane.widgets.indexOf(widgetId);
      if (widgetIndex > -1)
        return { paneIndex, widgetIndex };
    }
    return undefined;
  }

  public getPaneManager(paneIndex: number): NineZoneStagePanelPaneManager {
    if (!this._paneManagers)
      this._paneManagers = new Map();
    let manager = this._paneManagers.get(paneIndex);
    if (!manager) {
      manager = new NineZoneStagePanelPaneManager();
      this._paneManagers.set(paneIndex, manager);
    }
    return manager;
  }
}
