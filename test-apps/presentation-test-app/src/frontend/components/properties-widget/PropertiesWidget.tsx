/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { PresentationPropertyDataProvider, withUnifiedSelection } from "@bentley/presentation-components/lib/propertygrid";
import { Orientation } from "@bentley/ui-core";
import { PropertyGrid, PropertyData, PropertyCategory } from "@bentley/ui-components";
import "./PropertiesWidget.css";

// tslint:disable-next-line:variable-name naming-convention
const SamplePropertyGrid = withUnifiedSelection(PropertyGrid);

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}
export interface State {
  dataProvider: PresentationPropertyDataProvider;
  show?: boolean;
}
export default class PropertiesWidget extends React.Component<Props, State> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = {
      dataProvider: createDataProvider(this.props.imodel, this.props.rulesetId),
    };
  }
  public static getDerivedStateFromProps(props: Props, state: State): State | undefined {
    if (props.imodel !== state.dataProvider.connection || props.rulesetId !== state.dataProvider.rulesetId)
      return { ...state, dataProvider: createDataProvider(props.imodel, props.rulesetId) };
    return undefined;
  }
  public render() {
    const togglePropertyPane = () => {
      this.setState((prev) => ({ show: prev.show ? false : true }));
    };
    let pane;
    if (this.state.show) {
      pane = (<SamplePropertyGrid
        orientation={Orientation.Horizontal}
        dataProvider={this.state.dataProvider}
      />);
    }
    return (
      <div className="PropertiesWidget">
        <h3>{IModelApp.i18n.translate("Sample:controls.properties")}</h3>
        <button onClick={togglePropertyPane}>Show/Hide</button>
        <div className="ContentContainer">
          {pane}
        </div>
      </div>
    );
  }
}

class AutoExpandingPropertyDataProvider extends PresentationPropertyDataProvider {
  public async getData(): Promise<PropertyData> {
    const result = await super.getData();
    result.categories.forEach((category: PropertyCategory) => {
      category.expand = true;
    });
    return result;
  }
}

function createDataProvider(imodel: IModelConnection, rulesetId: string): PresentationPropertyDataProvider {
  return new AutoExpandingPropertyDataProvider(imodel, rulesetId);
}
