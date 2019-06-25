/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { PointProps, Point } from "../utilities/Point";
import { RectangleProps, Rectangle } from "../utilities/Rectangle";
import { ZonesManagerProps, WidgetZoneIndex, ZonesManager, DefaultStateManager } from "../zones/manager/Zones";
import { NineZoneNestedStagePanelsManagerProps, NineZoneNestedStagePanelsManager } from "./NestedStagePanels";
import { StagePanelType, StagePanelsManager } from "../../ui-ninezone";
import { NineZoneStagePanelManager } from "./StagePanel";

/** Properties used by [[NineZoneManager]].
 * @alpha
 */
export interface NineZoneManagerProps {
  readonly nested: NineZoneNestedStagePanelsManagerProps;
  readonly zones: ZonesManagerProps;
}

/** Arguments of [[NineZoneManager.handleWidgetTabDragStart]].
 * @alpha
 */
export interface WidgetTabDragStartArguments {
  /** Initial mouse down position. */
  readonly initialPosition: PointProps;
  /** Dragged tab index. */
  readonly tabId: number;
  /** Current widget bounds. */
  readonly widgetBounds: RectangleProps;
  /** Dragged widget index. */
  readonly widgetId: WidgetZoneIndex;
}

/** Stage panel target used by [[NineZoneManager]].
 * @alpha
 */
export interface NineZoneManagerPanelTarget {
  readonly panelId: string | number;
  readonly panelType: StagePanelType;
}

/** Splitter pane target used by [[NineZoneManager]].
 * @alpha
 */
export interface NineZoneManagerPaneTarget extends NineZoneManagerPanelTarget {
  readonly paneIndex: number;
}

/** Class used to manage [[NineZoneStagePanelManagerProps]].
 * @alpha
 */
export class NineZoneManager {
  private _nestedPanelsManager?: NineZoneNestedStagePanelsManager;
  private _zonesManager?: ZonesManager;
  private _paneTarget?: NineZoneManagerPaneTarget;
  private _panelTarget?: NineZoneManagerPanelTarget;

  private findPanelWithWidget<TProps extends NineZoneManagerProps>(widgetId: WidgetZoneIndex, props: TProps) {
    const nestedPanelById = Object.keys(props.nested.panels).map((id) => {
      return { id, panels: props.nested.panels[id] };
    });
    const nestedPanelsManager = this.getNestedPanelsManager();
    for (const { id, panels } of nestedPanelById) {
      const panelsManager = nestedPanelsManager.getPanelsManager(id);
      const type = panelsManager.findWidget(widgetId, panels);
      if (type !== undefined)
        return {
          id,
          ...type,
        };
    }
    return undefined;
  }

  public handleWidgetTabClick<TProps extends NineZoneManagerProps>(widgetId: WidgetZoneIndex, tabId: number, props: TProps): TProps {
    let zones = props.zones;
    const panelWithWidget = this.findPanelWithWidget(widgetId, props);
    const zonesManager = this.getZonesManager();
    if (panelWithWidget) {
      const panels = props.nested.panels[panelWithWidget.id];
      const panel = StagePanelsManager.getPanel(panelWithWidget.type, panels);
      const pane = panel.panes[panelWithWidget.paneIndex];
      for (const widget of pane.widgets) {
        if (widget === widgetId)
          zones = zonesManager.setWidgetTabId(widget, tabId, zones);
        else
          zones = zonesManager.setWidgetTabId(widget, -1, zones);
      }
    } else {
      zones = zonesManager.handleTabClick(widgetId, tabId, zones);
    }
    if (zones === props.zones)
      return props;
    return {
      ...props,
      zones,
    };
  }

  public handleWidgetTabDragEnd<TProps extends NineZoneManagerProps>(props: TProps): TProps {
    const zonesManager = this.getZonesManager();
    let zones = zonesManager.handleWidgetTabDragEnd(props.zones);

    const paneTarget = this.getPaneTarget();
    const targetKey = this.getTargetKey();
    const paneIndex = paneTarget ? paneTarget.paneIndex : undefined;
    let nested = props.nested;
    const draggingWidget = props.zones.draggingWidget;
    if (targetKey && draggingWidget) {
      const nestedPanelsManager = this.getNestedPanelsManager();
      if (paneIndex !== undefined) {
        const panels = nested.panels[targetKey.id];
        const panel = StagePanelsManager.getPanel(targetKey.type, panels);
        const pane = panel.panes[paneIndex];
        for (const widget of pane.widgets) {
          zones = zonesManager.setWidgetTabId(widget, -1, zones);
        }
      }
      nested = nestedPanelsManager.addWidget(draggingWidget.id, targetKey, paneIndex, props.nested);
      zones = zonesManager.removeWidget(draggingWidget.id, draggingWidget.id, zones);

      const horizontalAnchor = NineZoneStagePanelManager.getHorizontalAnchor(targetKey.type);
      zones = zonesManager.setWidgetHorizontalAnchor(draggingWidget.id, horizontalAnchor, zones);
      const verticalAnchor = NineZoneStagePanelManager.getVerticalAnchor(targetKey.type);
      zones = zonesManager.setWidgetVerticalAnchor(draggingWidget.id, verticalAnchor, zones);
    }

    if (nested === props.nested && zones === props.zones)
      return props;
    return {
      ...props,
      nested,
      zones,
    };
  }

  public handleWidgetTabDragStart<TProps extends NineZoneManagerProps>(args: WidgetTabDragStartArguments, props: TProps): TProps {
    const nestedPanelsManager = this.getNestedPanelsManager();
    const zonesManager = this.getZonesManager();
    let nested = props.nested;
    let zones = props.zones;
    const panelWithWidget = this.findPanelWithWidget(args.widgetId, props);
    if (panelWithWidget !== undefined) {
      nestedPanelsManager.getPanelsManager(panelWithWidget.id);
      nested = nestedPanelsManager.removeWidget(args.widgetId, panelWithWidget, props.nested);
      zones = zonesManager.addWidget(args.widgetId, args.widgetId, zones);

      const widget = props.zones.widgets[args.widgetId];
      const panels = props.nested.panels[panelWithWidget.id];
      const panel = StagePanelsManager.getPanel(panelWithWidget.type, panels);
      const pane = panel.panes[panelWithWidget.paneIndex];
      if (widget.tabIndex < 0) {
        // Open dragged widget for zones manager.
        zones = zonesManager.setWidgetTabId(args.widgetId, args.tabId, zones);
      } else {
        // Opened widget is removed, need to open next widget in a pane
        for (const w of pane.widgets) {
          if (w === args.widgetId)  // Skip removed widget if it is first
            continue;
          zones = zonesManager.setWidgetTabId(w, 0, zones);
          break;
        }
      }
    }
    zones = zonesManager.handleWidgetTabDragStart(args.widgetId, args.tabId, args.initialPosition, args.widgetBounds, zones);

    const newZone = zones.zones[args.widgetId];
    const oldZone = props.zones.zones[args.widgetId];
    if (panelWithWidget && newZone.floating && oldZone.floating) {
      const newBounds = Rectangle.create(newZone.floating.bounds);
      const oldBounds = Rectangle.create(oldZone.floating.bounds);
      const newSize = newBounds.getSize();
      const oldSize = oldBounds.getSize();

      let draggingWidget = zones.draggingWidget;
      if (draggingWidget && panelWithWidget && panelWithWidget.type === StagePanelType.Left) {
        const widthDiff = oldSize.width - newSize.width;
        draggingWidget = {
          ...draggingWidget,
          lastPosition: Point.create(draggingWidget.lastPosition).offsetX(widthDiff).toProps(),
        };
      }
      if (draggingWidget && panelWithWidget && panelWithWidget.type === StagePanelType.Top) {
        const heightDiff = oldSize.height - newSize.height;
        draggingWidget = {
          ...draggingWidget,
          lastPosition: Point.create(draggingWidget.lastPosition).offsetY(heightDiff).toProps(),
        };
      }
      zones = {
        ...zones,
        zones: {
          ...zones.zones,
          [args.widgetId]: {
            ...zones.zones[args.widgetId],
            floating: {
              ...zones.zones[args.widgetId].floating,
              bounds: newBounds.setSize(oldSize).toProps(),
            },
          },
        },
        draggingWidget,
      };
    }

    if (zones === props.zones && nested === props.nested)
      return props;
    return {
      ...props,
      nested,
      zones,
    };
  }

  public getNestedPanelsManager(): NineZoneNestedStagePanelsManager {
    if (!this._nestedPanelsManager)
      this._nestedPanelsManager = new NineZoneNestedStagePanelsManager();
    return this._nestedPanelsManager;
  }

  public getZonesManager(): ZonesManager {
    if (!this._zonesManager)
      this._zonesManager = DefaultStateManager;
    return this._zonesManager;
  }

  public setPaneTarget(target: NineZoneManagerPaneTarget | undefined) {
    this._paneTarget = target;
  }

  public getPaneTarget(): NineZoneManagerPaneTarget | undefined {
    return this._paneTarget;
  }

  public setPanelTarget(target: NineZoneManagerPanelTarget | undefined) {
    this._panelTarget = target;
  }

  public getPanelTarget() {
    return this._panelTarget;
  }

  private getTargetKey() {
    const panelTarget = this.getPanelTarget();
    const paneTarget = this.getPaneTarget();
    return panelTarget ? {
      id: panelTarget.panelId,
      type: panelTarget.panelType,
    } : paneTarget ? {
      id: paneTarget.panelId,
      type: paneTarget.panelType,
    } : undefined;
  }
}
