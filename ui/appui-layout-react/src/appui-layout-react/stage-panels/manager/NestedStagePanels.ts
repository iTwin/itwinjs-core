/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StagePanels
 */

import type { StagePanelType } from "../StagePanel";
import type { StagePanelsManagerProps } from "./StagePanels";
import { StagePanelsManager } from "./StagePanels";

/** Properties used by [[NestedStagePanelsManager]].
 * @internal
 */
export interface NestedStagePanelsManagerProps {
  readonly panels: { readonly [id: string]: StagePanelsManagerProps };
}

/** Used to identify stage panels in [[NestedStagePanelsManagerProps]].
 * @internal
 */
export type NestedStagePanelsId<TProps extends NestedStagePanelsManagerProps> = Extract<keyof TProps["panels"], string | number>;

/** Key used to identify stage panel in [[NestedStagePanelsManagerProps]].
 * @internal
 */
export interface NestedStagePanelKey<TProps extends NestedStagePanelsManagerProps> {
  readonly id: NestedStagePanelsId<TProps>;
  readonly type: StagePanelType;
}

/** Class used to manage [[NestedStagePanelsManagerProps]].
 * @internal
 */
export class NestedStagePanelsManager {
  private _managers?: Map<string | number, StagePanelsManager>;

  public resize<TProps extends NestedStagePanelsManagerProps>(panel: NestedStagePanelKey<TProps>, resizeBy: number, props: TProps): TProps {
    const panels = props.panels[panel.id];
    const manager = this.getPanelsManager(panel.id);
    const updatedPanels = manager.resize(panel.type, resizeBy, panels);
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

  public setIsCollapsed<TProps extends NestedStagePanelsManagerProps>(panel: NestedStagePanelKey<TProps>, isCollapsed: boolean, props: TProps): TProps {
    const panels = props.panels[panel.id];
    const manager = this.getPanelsManager(panel.id);
    const updatedPanels = manager.setIsCollapsed(panel.type, isCollapsed, panels);
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

  public setSize<TProps extends NestedStagePanelsManagerProps>(panel: NestedStagePanelKey<TProps>, size: number, props: TProps): TProps {
    const panels = props.panels[panel.id];
    const manager = this.getPanelsManager(panel.id);
    const updatedPanels = manager.setSize(panel.type, size, panels);
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

  public getPanelsManager<TProps extends NestedStagePanelsManagerProps>(id: NestedStagePanelsId<TProps>): StagePanelsManager {
    if (!this._managers)
      this._managers = new Map();
    let manager = this._managers.get(id);
    if (!manager) {
      manager = new StagePanelsManager();
      this._managers.set(id, manager);
    }
    return manager;
  }
}
