import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { PropertyGrid } from "@bentley/ecpresentation-controls";
import { Orientation } from "@bentley/ui-core";
import "./PropertiesWidget.css";

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}
export default class PropertiesWidget extends React.Component<Props> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = {};
  }
  public render() {
    return (
      <div className="PropertiesWidget">
        <h3>{IModelApp.i18n.translate("Sample:controls.properties")}</h3>
        <div className="ContentContainer">
          <PropertyGrid
            orientation={Orientation.Horizontal}
            imodel={this.props.imodel}
            rulesetId={this.props.rulesetId} />
        </div>
      </div>
    );
  }
}
