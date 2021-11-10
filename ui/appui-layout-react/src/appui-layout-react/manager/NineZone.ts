/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Zone
 */

import { PointProps } from "@itwin/appui-abstract";
import { Point, Rectangle, RectangleProps } from "@itwin/core-react";
import { NestedStagePanelKey, NestedStagePanelsManagerProps } from "../stage-panels/manager/NestedStagePanels";
import { StagePanelsManager } from "../stage-panels/manager/StagePanels";
import { StagePanelType } from "../stage-panels/StagePanel";
import { ToolSettingsWidgetMode } from "../zones/manager/Widget";
import { WidgetZoneId, ZonesManager, ZonesManagerProps } from "../zones/manager/Zones";
import { NineZoneNestedStagePanelsManager, NineZoneNestedStagePanelsManagerProps } from "./NestedStagePanels";
import { NineZoneStagePanelManager } from "./StagePanel";

/** Properties used by [[NineZoneManager]].
 * @internal
 */
export interface NineZoneManagerProps {
  readonly nested: NineZoneNestedStagePanelsManagerProps;
  readonly zones: ZonesManagerProps;
}

/** Arguments of [[NineZoneManager.handleWidgetTabDragStart]].
 * @internal
 */
export interface WidgetTabDragStartArguments {
  /** Initial mouse down position. */
  readonly initialPosition: PointProps;
  /** Dragged tab index. */
  readonly tabIndex: number;
  /** Current widget bounds. */
  readonly widgetBounds: RectangleProps;
  /** Dragged widget index. */
  readonly widgetId: WidgetZoneId;
}

/** Stage panel target used by [[NineZoneManager]].
 * @internal
 */
export interface NineZoneManagerPanelTarget {
  readonly panelId: string | number;
  readonly panelType: StagePanelType;
}

/** Splitter pane target used by [[NineZoneManager]].
 * @internal
 */
export interface NineZoneManagerPaneTarget extends NineZoneManagerPanelTarget {
  readonly paneIndex: number;
}

/**  @internal */
export type NineZoneManagerHiddenWidgets = { readonly [id in WidgetZoneId]: NineZoneManagerHiddenWidget };

/** @internal */
export interface NineZoneManagerHiddenWidget {
  panel?: {
    key: NestedStagePanelKey<NestedStagePanelsManagerProps>;
  };
}

/** Class used to manage [[NineZoneStagePanelManagerProps]].
 * @internal
 */
export class NineZoneManager {
  private _nestedPanelsManager?: NineZoneNestedStagePanelsManager;
  private _zonesManager?: ZonesManager;
  private _paneTarget?: NineZoneManagerPaneTarget;
  private _panelTarget?: NineZoneManagerPanelTarget;
  private _hiddenWidgets?: NineZoneManagerHiddenWidgets;

  private findPanelWithWidget<TProps extends NineZoneManagerProps>(widgetId: WidgetZoneId, props: TProps) {
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

  public handleWidgetTabClick<TProps extends NineZoneManagerProps>(widgetId: WidgetZoneId, tabIndex: number, props: TProps): TProps {
    let zones = props.zones;
    const panelWithWidget = this.findPanelWithWidget(widgetId, props);
    const zonesManager = this.getZonesManager();
    if (panelWithWidget) {
      const panels = props.nested.panels[panelWithWidget.id];
      const panel = StagePanelsManager.getPanel(panelWithWidget.type, panels);
      const pane = panel.panes[panelWithWidget.paneIndex];
      for (const widget of pane.widgets) {
        if (widget === widgetId)
          zones = zonesManager.setWidgetTabIndex(widget, tabIndex, zones);
        else
          zones = zonesManager.setWidgetTabIndex(widget, -1, zones);
      }
    } else {
      zones = zonesManager.handleWidgetTabClick(widgetId, tabIndex, zones);
    }
    if (zones === props.zones)
      return props;
    return this.setZones(zones, props);
  }

  public handleWidgetTabDragEnd<TProps extends NineZoneManagerProps>(props: TProps): TProps {
    const zonesManager = this.getZonesManager();
    let zones = zonesManager.handleWidgetTabDragEnd(props.zones);

    const paneTarget = this.getPaneTarget();
    const targetKey = this.getTargetKey();
    const paneIndex = paneTarget ? paneTarget.paneIndex : undefined;
    let nested = props.nested;
    const draggedWidget = props.zones.draggedWidget;
    if (targetKey && draggedWidget) {
      const nestedPanelsManager = this.getNestedPanelsManager();
      if (paneIndex !== undefined) {
        const panels = nested.panels[targetKey.id];
        const panel = StagePanelsManager.getPanel(targetKey.type, panels);
        const pane = panel.panes[paneIndex];
        for (const widget of pane.widgets) {
          zones = zonesManager.setWidgetTabIndex(widget, -1, zones);
        }
      }
      nested = nestedPanelsManager.addWidget(draggedWidget.id, targetKey, paneIndex, props.nested);
      zones = zonesManager.removeWidget(draggedWidget.id, draggedWidget.id, zones);

      const horizontalAnchor = NineZoneStagePanelManager.getHorizontalAnchor(targetKey.type);
      zones = zonesManager.setWidgetHorizontalAnchor(draggedWidget.id, horizontalAnchor, zones);
      const verticalAnchor = NineZoneStagePanelManager.getVerticalAnchor(targetKey.type);
      zones = zonesManager.setWidgetVerticalAnchor(draggedWidget.id, verticalAnchor, zones);
      if (draggedWidget.id === 2)
        zones = zonesManager.setToolSettingsWidgetMode(ToolSettingsWidgetMode.Tab, zones);
    }

    props = this.setNested(nested, props);
    props = this.setZones(zones, props);
    return props;
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
        zones = zonesManager.setWidgetTabIndex(args.widgetId, args.tabIndex, zones);
      } else {
        // Opened widget is removed, need to open next widget in a pane
        for (const w of pane.widgets) {
          if (w === args.widgetId)  // Skip removed widget if it is first
            continue;
          zones = zonesManager.setWidgetTabIndex(w, 0, zones);
          break;
        }
      }
    }
    zones = zonesManager.handleWidgetTabDragStart(args.widgetId, args.tabIndex, args.initialPosition, args.widgetBounds, zones);

    const newZone = zones.zones[args.widgetId];
    const oldZone = props.zones.zones[args.widgetId];
    if (panelWithWidget && newZone.floating && oldZone.floating) {
      const newBounds = Rectangle.create(newZone.floating.bounds);
      const oldBounds = Rectangle.create(oldZone.floating.bounds);
      const newSize = newBounds.getSize();
      const oldSize = oldBounds.getSize();

      let draggedWidget = zones.draggedWidget;
      if (draggedWidget && panelWithWidget && panelWithWidget.type === StagePanelType.Left) {
        const widthDiff = oldSize.width - newSize.width;
        draggedWidget = {
          ...draggedWidget,
          lastPosition: Point.create(draggedWidget.lastPosition).offsetX(widthDiff).toProps(),
        };
      }
      if (draggedWidget && panelWithWidget && panelWithWidget.type === StagePanelType.Top) {
        const heightDiff = oldSize.height - newSize.height;
        draggedWidget = {
          ...draggedWidget,
          lastPosition: Point.create(draggedWidget.lastPosition).offsetY(heightDiff).toProps(),
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
        draggedWidget,
      };
    }

    props = this.setNested(nested, props);
    props = this.setZones(zones, props);
    return props;
  }

  public getNestedPanelsManager(): NineZoneNestedStagePanelsManager {
    if (!this._nestedPanelsManager)
      this._nestedPanelsManager = new NineZoneNestedStagePanelsManager();
    return this._nestedPanelsManager;
  }

  /** @internal */
  public getHiddenWidgets(): NineZoneManagerHiddenWidgets {
    if (!this._hiddenWidgets)
      this._hiddenWidgets = {
        1: {},
        2: {},
        3: {},
        4: {},
        6: {},
        7: {},
        8: {},
        9: {},
      };
    return this._hiddenWidgets;
  }

  public getZonesManager(): ZonesManager {
    if (!this._zonesManager)
      this._zonesManager = new ZonesManager();
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

  public showWidget<TProps extends NineZoneManagerProps>(widgetId: WidgetZoneId, props: TProps): TProps {
    const zonesManager = this.getZonesManager();
    const hiddenWidgets = this.getHiddenWidgets();
    const hiddenWidget = hiddenWidgets[widgetId];
    const panel = hiddenWidget.panel;
    let zones = props.zones;
    let nested = props.nested;
    if (panel) {
      const nestedPanelsManager = this.getNestedPanelsManager();
      nested = nestedPanelsManager.addWidget(widgetId, panel.key, undefined, props.nested);
    } else {
      zones = zonesManager.addWidget(widgetId, widgetId, props.zones);
    }
    zones = zonesManager.setWidgetTabIndex(widgetId, 0, zones);
    props = this.setZones(zones, props);
    props = this.setNested(nested, props);
    return props;
  }

  public hideWidget<TProps extends NineZoneManagerProps>(widgetId: WidgetZoneId, props: TProps): TProps {
    const zonesManager = this.getZonesManager();
    const hiddenWidgets = this.getHiddenWidgets();
    const hiddenWidget = hiddenWidgets[widgetId];

    const zoneWithWidget = zonesManager.findZoneWithWidget(widgetId, props.zones);
    if (zoneWithWidget) {
      hiddenWidget.panel = undefined;

      const zones = zonesManager.removeWidget(widgetId, widgetId, props.zones);
      return this.setZones(zones, props);
    }

    const panelWithWidget = this.findPanelWithWidget(widgetId, props);
    if (panelWithWidget) {
      hiddenWidget.panel = {
        key: {
          id: panelWithWidget.id,
          type: panelWithWidget.type,
        },
      };

      let zones = props.zones;
      const nestedPanelsManager = this.getNestedPanelsManager();
      const panels = props.nested.panels[panelWithWidget.id];
      const panel = StagePanelsManager.getPanel(panelWithWidget.type, panels);
      const pane = panel.panes[panelWithWidget.paneIndex];
      const isOpen = props.zones.widgets[widgetId].tabIndex > -1;

      if (isOpen && pane.widgets.length > 1) {
        const widgetToOpen = pane.widgets.find((w) => w !== widgetId)!;
        zones = zonesManager.setWidgetTabIndex(widgetToOpen, 0, zones);
      }

      zones = zonesManager.setWidgetTabIndex(widgetId, -1, zones);
      const nested = nestedPanelsManager.removeWidget(widgetId, panelWithWidget, props.nested);
      props = this.setZones(zones, props);
      props = this.setNested(nested, props);
      return props;
    }

    return props;
  }

  /** @internal */
  public setZones<TProps extends NineZoneManagerProps>(zones: TProps["zones"], props: TProps): TProps {
    return this.setProp(zones, "zones", props);
  }

  /** @internal */
  public setNested<TProps extends NineZoneManagerProps>(nested: TProps["nested"], props: TProps): TProps {
    return this.setProp(nested, "nested", props);
  }

  /** @internal */
  public setProp<TProps extends NineZoneManagerProps, TKey extends keyof TProps>(value: TProps[TKey], key: TKey, props: TProps): TProps {
    if (value === props[key])
      return props;
    return {
      ...props,
      [key]: value,
    };
  }
}
