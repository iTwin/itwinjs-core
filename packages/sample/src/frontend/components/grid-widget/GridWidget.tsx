import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { Table } from "@bentley/ecpresentation-controls";
import "./GridWidget.css";

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}

export default class GridWidget extends React.Component<Props> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = {};
  }
  public render() {
    return (
      <div className="GridWidget">
        <h3>{IModelApp.i18n.translate("Sample:controls.grid")}</h3>
        <div className="ContentContainer">
          <Table imodel={this.props.imodel} rulesetId={this.props.rulesetId} />
        </div>
      </div>
    );
  }
}
