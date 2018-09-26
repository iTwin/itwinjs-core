/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

import { UiFramework } from "../UiFramework";

/** Properties for icons, labels & tooltips.
 */
export interface IconLabelProps {
  iconClass?: string;
  iconElement?: React.ReactNode;
  labelKey?: string;
  labelExpr?: string;
  tooltipKey?: string;
  tooltipExpr?: string;
}

/** Properties about an Icon */
export interface IconInfo {
  /** CSS class name for icon */
  iconClass?: string;
  /** React element for icon */
  iconElement?: React.ReactNode;
}

/** Provides support for icons, labels & tooltips.
 *  Serves as the base class for ItemBase.
 */
export class IconLabelSupport {
  public iconClass?: string;
  public iconElement?: React.ReactNode;
  public label: string = "";
  public tooltip: string = "";

  constructor(iconLabelDef?: IconLabelProps) {
    if (iconLabelDef) {
      if (iconLabelDef.iconClass !== undefined)
        this.iconClass = iconLabelDef.iconClass;
      if (iconLabelDef.iconElement !== undefined)
        this.iconElement = iconLabelDef.iconElement;

      this.label = (iconLabelDef.labelKey !== undefined) ? UiFramework.i18n.translate(iconLabelDef.labelKey) : "";
      // labelExpr?: string;

      this.tooltip = (iconLabelDef.tooltipKey !== undefined) ? UiFramework.i18n.translate(iconLabelDef.tooltipKey) : "";
      // tooltipExpr?: string;
    }
  }

  public get iconInfo(): IconInfo {
    return { iconClass: this.iconClass, iconElement: this.iconElement };
  }
}

/** Props for the Icon React component */
export interface IconProps {
  iconInfo: IconInfo;
}

/** Icon React component */
export class Icon extends React.Component<IconProps> {
  public render(): React.ReactNode {
    if (this.props.iconInfo.iconClass) {
      const className = "icon " + this.props.iconInfo.iconClass;
      return (
        <i className={className} />
      );
    } else if (this.props.iconInfo.iconElement) {
      return (
        <i className="icon item-svg-icon">
          {this.props.iconInfo.iconElement}
        </i>
      );
    }

    return null;
  }
}

export default IconLabelSupport;
