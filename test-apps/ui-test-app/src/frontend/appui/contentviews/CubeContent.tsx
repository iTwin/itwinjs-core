/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { Cube } from "@bentley/ui-core";
import { RotMatrix } from "@bentley/geometry-core";
import { ConfigurableUiManager, ConfigurableCreateInfo, ContentControl } from "@bentley/ui-framework";
import { ViewportManager, CubeRotationChangeEventArgs } from "@bentley/ui-components";

import "./CubeContent.scss";

class CubeContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <CubeContent />;
  }
}

interface CubeContentState {
  rotMatrix: RotMatrix;
}

class CubeContent extends React.Component<{}, CubeContentState> {

  public readonly state: CubeContentState = {
    rotMatrix: RotMatrix.createIdentity(),
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
    ViewportManager.CubeRotationChangeEvent.addListener(this._handleCubeRotationChangeEvent);
  }

  public componentWillUnmount() {
    ViewportManager.CubeRotationChangeEvent.removeListener(this._handleCubeRotationChangeEvent);
  }

  private _handleCubeRotationChangeEvent = (args: CubeRotationChangeEventArgs) => {
    this.setState({rotMatrix: args.rotMatrix});
  }
}

ConfigurableUiManager.registerControl("CubeContent", CubeContentControl);
