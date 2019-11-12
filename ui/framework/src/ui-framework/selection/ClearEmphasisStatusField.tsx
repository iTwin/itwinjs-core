/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { Indicator } from "../statusfields/Indicator";
import { IModelApp, ScreenViewport } from "@bentley/imodeljs-frontend";
import { SelectionContextUtilities } from "./SelectionContextUtilities";
import { StatusFieldProps } from "../statusfields/StatusFieldProps";
import { UiFramework } from "../UiFramework";

/** Clear Emphasis StatusField Props
 * @beta
 */
export interface ClearEmphasisStatusFieldProps extends StatusFieldProps {
  hideWhenUnused?: boolean;
}

/** Clear Emphasis StatusField
 * @beta
 */
export class ClearEmphasisStatusField extends React.Component<ClearEmphasisStatusFieldProps, any> {
  private _toolTip: string = UiFramework.translate("tools.clearVisibility");

  constructor(props: ClearEmphasisStatusFieldProps) {
    super(props);

    this.state = {
      wantShow: this._wantShow(),
    };
  }

  private _updateState = () => {
    this.setState({
      wantShow: this._wantShow(),
    });
  }

  // istanbul ignore next
  private _attachToVp = (vp: ScreenViewport) => {
    vp.onFeatureOverridesChanged.addListener(this._updateState);
  }

  // istanbul ignore next
  private _dettachFromVp = (vp: ScreenViewport) => {
    vp.onFeatureOverridesChanged.removeListener(this._updateState);
  }

  public componentDidMount() {
    SelectionContextUtilities.emphasizeElementsChanged.addListener(this._updateState);
    IModelApp.viewManager.onViewOpen.addListener(this._attachToVp);
    IModelApp.viewManager.onViewClose.addListener(this._dettachFromVp);
  }

  public componentWillUnmount() {
    SelectionContextUtilities.emphasizeElementsChanged.removeListener(this._updateState);
    IModelApp.viewManager.onViewOpen.removeListener(this._attachToVp);
    IModelApp.viewManager.onViewClose.removeListener(this._dettachFromVp);
  }

  private _wantShow() {
    const vp = IModelApp.viewManager.selectedView;
    // istanbul ignore next
    if (!vp)
      return false;

    return SelectionContextUtilities.areFeatureOverridesActive(vp);
  }

  // istanbul ignore next
  private _clearEmphasize = () => {
    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      SelectionContextUtilities.clearEmphasize(vp);
  }

  public render() {
    const classes = (this.props.hideWhenUnused && !this.state.wantShow) ? "uifw-indicator-fade-out" : "uifw-indicator-fade-in";

    return (
      <Indicator toolTip={this._toolTip} className={classes} opened={false} onClick={this._clearEmphasize} iconName="icon-visibility" />
    );
  }
}
