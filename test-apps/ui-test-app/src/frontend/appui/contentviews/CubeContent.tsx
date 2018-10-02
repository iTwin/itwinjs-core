/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { Cube } from "@bentley/ui-core";
import { Matrix3d } from "@bentley/geometry-core";
import { ConfigurableUIManager, ConfigurableCreateInfo, ContentControl } from "@bentley/ui-framework";
import { ViewRotationCube, CubeRotationChangeEventArgs } from "@bentley/ui-components";

import "./CubeContent.scss";

class CubeContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <CubeContent />;
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
    ViewRotationCube.cubeRotationChangeEvent.addListener(this._handleCubeRotationChangeEvent);
  }

  public componentWillUnmount() {
    ViewRotationCube.cubeRotationChangeEvent.removeListener(this._handleCubeRotationChangeEvent);
  }

  private _handleCubeRotationChangeEvent = (args: CubeRotationChangeEventArgs) => {
    this.setState({ rotMatrix: args.rotMatrix });
  }
}

ConfigurableUIManager.registerControl("CubeContent", CubeContentControl);
