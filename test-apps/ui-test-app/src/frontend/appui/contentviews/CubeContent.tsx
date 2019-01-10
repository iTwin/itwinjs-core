/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { Cube } from "@bentley/ui-core";
import { Matrix3d } from "@bentley/geometry-core";
import { ConfigurableUiManager, ConfigurableCreateInfo, ContentControl } from "@bentley/ui-framework";
import { ViewportComponentEvents, CubeRotationChangeEventArgs } from "@bentley/ui-components";

import "./CubeContent.scss";

class CubeContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <CubeContent />;
  }

  /** Get the NavigationAidControl associated with this ContentControl */
  public get navigationAidControl(): string {
    return "CubeNavigationAid";
  }
}

interface CubeContentState {
  rotMatrix: Matrix3d;
}

class CubeContent extends React.Component<{}, CubeContentState> {

  public readonly state: CubeContentState = {
    rotMatrix: Matrix3d.createIdentity(),
  };

  public render(): React.ReactNode {
    return (
      <div className={"example-cube-container"}>
        <Cube
          className="example-cube"
          rotMatrix={this.state.rotMatrix} />
      </div>
    );
  }

  public componentDidMount() {
    ViewportComponentEvents.onCubeRotationChangeEvent.addListener(this._handleCubeRotationChangeEvent);
  }

  public componentWillUnmount() {
    ViewportComponentEvents.onCubeRotationChangeEvent.removeListener(this._handleCubeRotationChangeEvent);
  }

  private _handleCubeRotationChangeEvent = (args: CubeRotationChangeEventArgs) => {
    this.setState({ rotMatrix: args.rotMatrix });
  }
}

ConfigurableUiManager.registerControl("CubeContent", CubeContentControl);
