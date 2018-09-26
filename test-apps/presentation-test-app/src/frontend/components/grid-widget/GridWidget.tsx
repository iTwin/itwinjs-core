import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { PresentationTableDataProvider, withUnifiedSelection } from "@bentley/presentation-components/lib/table";
import { Table } from "@bentley/ui-components";
import "./GridWidget.css";

// tslint:disable-next-line:variable-name naming-convention
const SampleTable = withUnifiedSelection(Table);

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
      <div className="gridwidget">
        <h3>{IModelApp.i18n.translate("Sample:controls.grid")}</h3>
        <div className="gridwidget-content">
          <SampleTable dataProvider={new PresentationTableDataProvider(this.props.imodel, this.props.rulesetId)} />
        </div>
      </div>
    );
  }
}
