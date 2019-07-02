/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StagePanels */

import { NestedStagePanelsManagerProps, NestedStagePanelsManager, NestedStagePanelKey, NestedStagePanelsId } from "../stage-panels/manager/NestedStagePanels";
import { NineZoneStagePanelsManagerProps, NineZoneStagePanelsManager } from "./StagePanels";
import { WidgetZoneIndex } from "../zones/manager/Zones";

/** Properties used by [[NineZoneNestedStagePanelsManager]].
 * @alpha
 */
export interface NineZoneNestedStagePanelsManagerProps extends NestedStagePanelsManagerProps {
  readonly panels: { readonly [id: string]: NineZoneStagePanelsManagerProps };
}

/** Class used to manage [[NineZoneNestedStagePanelsManagerProps]].
 * @alpha
 */
export class NineZoneNestedStagePanelsManager extends NestedStagePanelsManager {
  private _nzManagers?: Map<string | number, NineZoneStagePanelsManager>;

  public addWidget<TProps extends NineZoneNestedStagePanelsManagerProps>(widget: WidgetZoneIndex, panel: NestedStagePanelKey<TProps>, paneIndex: number | undefined, props: TProps): TProps {
    const panels = props.panels[panel.id];
    const manager = this.getPanelsManager(panel.id);
    const updatedPanels = manager.addWidget(widget, panel.type, paneIndex, panels);
    if (panels === updatedPanels)
      return props;

    return {
      ...props,
      panels: {
        ...props.panels,
        [panel.id]: updatedPanels,
      },
    };
  }

  public removeWidget<TProps extends NineZoneNestedStagePanelsManagerProps>(widget: WidgetZoneIndex, panel: NestedStagePanelKey<TProps>, props: TProps): TProps {
    const panels = props.panels[panel.id];
    const manager = this.getPanelsManager(panel.id);
    const updatedPanels = manager.removeWidget(widget, panel.type, panels);
    if (panels === updatedPanels)
      return props;

    return {
      ...props,
      panels: {
        ...props.panels,
        [panel.id]: updatedPanels,
      },
    };
  }

  public getPanelsManager<TProps extends NestedStagePanelsManagerProps>(id: NestedStagePanelsId<TProps>): NineZoneStagePanelsManager {
    if (!this._nzManagers)
      this._nzManagers = new Map();
    let manager = this._nzManagers.get(id);
    if (!manager) {
      manager = new NineZoneStagePanelsManager();
      this._nzManagers.set(id, manager);
    }
    return manager;
  }
}
