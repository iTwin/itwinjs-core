/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StagePanels
 */

import { StagePanelType } from "../StagePanel";
import { getDefaultStagePanelManagerProps, StagePanelManager, StagePanelManagerProps } from "./StagePanel";

/** Properties used to manage stage panels.
 * @beta
 */
export interface StagePanelsManagerProps {
  readonly bottom: StagePanelManagerProps;
  readonly left: StagePanelManagerProps;
  readonly right: StagePanelManagerProps;
  readonly top: StagePanelManagerProps;
}

/** Returns default [[StagePanelsManagerProps]] object.
 * @beta
 */
export const getDefaultStagePanelsManagerProps = (): StagePanelsManagerProps => ({
  bottom: getDefaultStagePanelManagerProps(),
  left: getDefaultStagePanelManagerProps(),
  right: getDefaultStagePanelManagerProps(),
  top: getDefaultStagePanelManagerProps(),
});

type PickNames<T, K extends keyof T> = K;

interface StagePanelTypeToPropName {
  [StagePanelType.Bottom]: PickNames<StagePanelsManagerProps, "bottom">;
  [StagePanelType.Left]: PickNames<StagePanelsManagerProps, "left">;
  [StagePanelType.Right]: PickNames<StagePanelsManagerProps, "right">;
  [StagePanelType.Top]: PickNames<StagePanelsManagerProps, "top">;
}

type StagePanelPropNames = PickNames<StagePanelsManagerProps, "left" | "top" | "right" | "bottom">;
type MapPropNameToType<T, K extends keyof T, N> = {
  [P in K]: N;
};
type StagePanelPropNameToType =
  MapPropNameToType<StagePanelsManagerProps, "left", StagePanelType.Left> &
  MapPropNameToType<StagePanelsManagerProps, "top", StagePanelType.Top> &
  MapPropNameToType<StagePanelsManagerProps, "right", StagePanelType.Right> &
  MapPropNameToType<StagePanelsManagerProps, "bottom", StagePanelType.Bottom>;

/** Class used to manage [[StagePanelsManagerProps]].
 * @beta
 */
export class StagePanelsManager {
  private _managers?: Map<StagePanelType, StagePanelManager>;

  public static getPanel<TProps extends StagePanelsManagerProps, T extends StagePanelType>(type: T, props: TProps): TProps[StagePanelTypeToPropName[T]] {
    const propName = StagePanelsManager.getPanelPropName(type);
    return props[propName];
  }

  public static getPanelPropName<T extends StagePanelType>(type: T): StagePanelTypeToPropName[T] {
    switch (type) {
      case StagePanelType.Bottom:
        return "bottom" as StagePanelTypeToPropName[T];
      case StagePanelType.Left:
        return "left" as StagePanelTypeToPropName[T];
      case StagePanelType.Right:
        return "right" as StagePanelTypeToPropName[T];
      case StagePanelType.Top:
        return "top" as StagePanelTypeToPropName[T];
    }
    throw new Error(`Unknown StagePanelType=${type}`);
  }

  public static getPanelType<T extends StagePanelPropNames>(propName: T): StagePanelPropNameToType[T] {
    switch (propName) {
      case "bottom":
        return StagePanelType.Bottom as StagePanelPropNameToType[T];
      case "left":
        return StagePanelType.Left as StagePanelPropNameToType[T];
      case "right":
        return StagePanelType.Right as StagePanelPropNameToType[T];
      case "top":
      default:
        return StagePanelType.Top as StagePanelPropNameToType[T];
    }
  }

  public resize<TProps extends StagePanelsManagerProps>(type: StagePanelType, resizeBy: number, props: TProps): TProps {
    const panel = StagePanelsManager.getPanel(type, props);
    const updatedPanel = this.getPanelManager(type).resize(resizeBy, panel);
    if (panel === updatedPanel)
      return props;

    const propName = StagePanelsManager.getPanelPropName(type);
    return {
      ...props,
      [propName]: updatedPanel,
    };
  }

  public setIsCollapsed<TProps extends StagePanelsManagerProps>(type: StagePanelType, isCollapsed: boolean, props: TProps): TProps {
    const panel = StagePanelsManager.getPanel(type, props);
    const updatedPanel = this.getPanelManager(type).setIsCollapsed(isCollapsed, panel);
    if (panel === updatedPanel)
      return props;

    const propName = StagePanelsManager.getPanelPropName(type);
    return {
      ...props,
      [propName]: updatedPanel,
    };
  }

  public setSize<TProps extends StagePanelsManagerProps>(type: StagePanelType, size: number, props: TProps): TProps {
    const panel = StagePanelsManager.getPanel(type, props);
    const updatedPanel = this.getPanelManager(type).setSize(size, panel);
    if (panel === updatedPanel)
      return props;

    const propName = StagePanelsManager.getPanelPropName(type);
    return {
      ...props,
      [propName]: updatedPanel,
    };
  }

  public getPanelManager(type: StagePanelType): StagePanelManager {
    if (!this._managers)
      this._managers = new Map();
    let manager = this._managers.get(type);
    if (!manager) {
      manager = new StagePanelManager();
      this._managers.set(type, manager);
    }
    return manager;
  }
}
