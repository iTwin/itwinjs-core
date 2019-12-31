/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { RealityDataEntry } from "./RealityData";
import "./RealityDataItem.scss";

/** Properties for the [[RealityDataItem]] component */
interface RealityDataItemProps {
  item: RealityDataEntry;
  onVisibilityChange: () => void;
}

/**
 * A reality data list item.
 * @alpha
 */
// istanbul ignore next
export class RealityDataItem extends React.Component<RealityDataItemProps> {

  constructor(props: RealityDataItemProps) {
    super(props);
  }

  private _onToggle = () => {
    this.props.onVisibilityChange();
  }

  /** @hidden */
  public render() {
    const groupLabel = IModelApp.i18n.translate("UiFramework:realityData.group") + ": ";
    const groupValue = (this.props.item.group || IModelApp.i18n.translate("UiFramework:realityData.notAvailable"));
    const groupInfo = groupLabel + groupValue;
    const sizeLabel = IModelApp.i18n.translate("UiFramework:realityData.size") + ": ";
    const sizeValue = (this.props.item.size + " " + IModelApp.i18n.translate("UiFramework:realityData.kilobytes")) || IModelApp.i18n.translate("UiFramework:realityData.notAvailable");
    const sizeInfo = sizeLabel + sizeValue;
    const tooltip = groupInfo + "\n" + sizeInfo;
    return (
      <li className="reality-data-item" key={this.props.item.url} onClick={this._onToggle} title={tooltip} >
        <span className={this.props.item.enabled ? "icon icon-visibility" : "icon icon-visibility-hide-2"} />
        <a>
          <span className="reality-data-name">{this.props.item.name}</span>
          <span className="reality-data-description">{this.props.item.description}</span>
        </a>
      </li>
    );
  }
}
