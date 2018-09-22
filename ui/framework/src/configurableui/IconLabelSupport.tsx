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
  iconSrc?: string;
  labelKey?: string;
  labelExpr?: string;
  tooltipKey?: string;
  tooltipExpr?: string;
}

/** Properties about an Icon */
export interface IconInfo {
  /** CSS class name for icon */
  iconClass?: string;
  /** Src location for icon */
  iconSrc?: string;
}

/** Provides support for icons, labels & tooltips.
 *  Serves as the base class for ItemBase.
 */
export class IconLabelSupport {
  public iconClass?: string;
  public iconSrc?: string;
  public label: string = "";
  public tooltip: string = "";

  constructor(iconLabelDef?: IconLabelProps) {
    if (iconLabelDef) {
      if (iconLabelDef.iconClass !== undefined)
        this.iconClass = iconLabelDef.iconClass;
      if (iconLabelDef.iconSrc !== undefined)
        this.iconSrc = iconLabelDef.iconSrc;

      this.label = (iconLabelDef.labelKey !== undefined) ? UiFramework.i18n.translate(iconLabelDef.labelKey) : "";
      // labelExpr?: string;

      this.tooltip = (iconLabelDef.tooltipKey !== undefined) ? UiFramework.i18n.translate(iconLabelDef.tooltipKey) : "";
      // tooltipExpr?: string;
    }
  }

  public get iconInfo(): IconInfo {
    return { iconClass: this.iconClass, iconSrc: this.iconSrc };
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
    } else if (this.props.iconInfo.iconSrc) {
      // TODO
      return <i />;
    }

    return null;
  }
}

export default IconLabelSupport;
