/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ConfigurableCreateInfo, ConfigurableUiManager, WidgetControl } from "@itwin/appui-react";
import { Button } from "@itwin/itwinui-react";

const modelNameId = "ui-test-app-modelcreation-modelname";

interface ModelCreationComponentState {
  haveName: boolean;
}

export class ModelCreationComponent extends React.Component<{}, ModelCreationComponentState> {

  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = { haveName: false };
  }

  private onNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    const modelName = (event.target as any).value;
    this.setState((prev) => ({ ...prev, haveName: (modelName.length !== 0) }));
  }

  /* eslint-disable deprecation/deprecation */
  private async createNewModel() {
  }

  public override render() {
    return (
      <div>
        <h2>Create Model</h2>
        <label htmlFor={modelNameId}>Name: </label>
        <input id={modelNameId} type="text" onChange={(ev) => this.onNameChange(ev)} />
        <p></p>
        <Button styleType="cta" onClick={async () => this.createNewModel()} disabled={!this.state.haveName}>
          Create Model
        </Button>
      </div >
    );
  }
}

export class ModelCreationWidget extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <ModelCreationComponent />;
  }
}
ConfigurableUiManager.registerControl("ModelCreation", ModelCreationWidget);
