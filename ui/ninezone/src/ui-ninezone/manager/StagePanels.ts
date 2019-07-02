/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StagePanels */

import { StagePanelsManagerProps, StagePanelsManager } from "../stage-panels/manager/StagePanels";
import { StagePanelType } from "../stage-panels/StagePanel";
import { NineZoneStagePanelManagerProps, NineZoneStagePanelManager, getDefaultNineZoneStagePanelManagerProps } from "./StagePanel";
import { WidgetZoneIndex } from "../zones/manager/Zones";

/** Properties used by [[NineZoneStagePanelsManager]].
 * @alpha
 */
export interface NineZoneStagePanelsManagerProps extends StagePanelsManagerProps {
  readonly bottom: NineZoneStagePanelManagerProps;
  readonly left: NineZoneStagePanelManagerProps;
  readonly right: NineZoneStagePanelManagerProps;
  readonly top: NineZoneStagePanelManagerProps;
}

/** Returns default [[StagePanelsManagerProps]] object.
 * @alpha
 */
export const getDefaultNineZoneStagePanelsManagerProps = (): NineZoneStagePanelsManagerProps => ({
  bottom: getDefaultNineZoneStagePanelManagerProps(),
  left: getDefaultNineZoneStagePanelManagerProps(),
  right: getDefaultNineZoneStagePanelManagerProps(),
  top: getDefaultNineZoneStagePanelManagerProps(),
});

const panelPropertyNames = [
  StagePanelsManager.getPanelPropName(StagePanelType.Left),
  StagePanelsManager.getPanelPropName(StagePanelType.Top),
  StagePanelsManager.getPanelPropName(StagePanelType.Right),
  StagePanelsManager.getPanelPropName(StagePanelType.Bottom),
];

/** Class used to manage [[NineZoneStagePanelsManagerProps]].
 * @alpha
 */
export class NineZoneStagePanelsManager extends StagePanelsManager {
  private _nzManagers?: Map<StagePanelType, NineZoneStagePanelManager>;

  public addWidget<TProps extends NineZoneStagePanelsManagerProps>(widget: WidgetZoneIndex, type: StagePanelType, paneIndex: number | undefined, props: TProps): TProps {
    const panel = StagePanelsManager.getPanel(type, props);
    const updatedPanel = this.getPanelManager(type).addWidget(widget, paneIndex, panel);
    if (panel === updatedPanel)
      return props;

    const propName = StagePanelsManager.getPanelPropName(type);
    return {
      ...props,
      [propName]: updatedPanel,
    };
  }

  public removeWidget<TProps extends NineZoneStagePanelsManagerProps>(widget: WidgetZoneIndex, type: StagePanelType, props: TProps): TProps {
    const panel = StagePanelsManager.getPanel(type, props);
    const updatedPanel = this.getPanelManager(type).removeWidget(widget, panel);
    if (panel === updatedPanel)
      return props;

    const propName = StagePanelsManager.getPanelPropName(type);
    return {
      ...props,
      [propName]: updatedPanel,
    };
  }

  public findWidget<TProps extends NineZoneStagePanelsManagerProps>(widgetId: WidgetZoneIndex, props: TProps) {
    const panels = panelPropertyNames.map((propName) => props[propName]);
    for (const [index, panel] of panels.entries()) {
      const panelPropertyName = panelPropertyNames[index];
      const type = StagePanelsManager.getPanelType(panelPropertyName);
      const manager = this.getPanelManager(type);
      const widget = manager.findWidget(widgetId, panel);
      if (widget)
        return {
          type,
          ...widget,
        };
    }
    return undefined;
  }

  public getPanelManager(type: StagePanelType): NineZoneStagePanelManager {
    if (!this._nzManagers)
      this._nzManagers = new Map();
    let manager = this._nzManagers.get(type);
    if (!manager) {
      manager = new NineZoneStagePanelManager();
      this._nzManagers.set(type, manager);
    }
    return manager;
  }
}
