import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { ECPresentationPropertyDataProvider, withUnifiedSelection  } from "@bentley/ecpresentation-controls/lib/propertygrid";
import { Orientation } from "@bentley/ui-core";
import { PropertyGrid } from "@bentley/ui-components";
import "./PropertiesWidget.css";

// tslint:disable-next-line:variable-name naming-convention
const SamplePropertyGrid = withUnifiedSelection(PropertyGrid);

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}
export interface State {
  show?: boolean;
}
export default class PropertiesWidget extends React.Component<Props, State> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = {};
  }
  public render() {
    const togglePropertyPane = () => {
      this.setState((prev) => ({ show: prev.show ? false : true }));
    };
    let pane;
    if (this.state.show) {
      pane = (<SamplePropertyGrid
        orientation={Orientation.Horizontal}
        dataProvider={new ECPresentationPropertyDataProvider(this.props.imodel, this.props.rulesetId)}
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
