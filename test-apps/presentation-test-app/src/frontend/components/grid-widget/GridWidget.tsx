/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./GridWidget.css";
import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { DiagnosticsProps, PresentationTableDataProvider, tableWithUnifiedSelection } from "@bentley/presentation-components";
import { Table } from "@bentley/ui-components";
import { useDisposable } from "@bentley/ui-core";
import { DiagnosticsSelector } from "../diagnostics-selector/DiagnosticsSelector";

// eslint-disable-next-line @typescript-eslint/naming-convention
const SampleTable = tableWithUnifiedSelection(Table);

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}

export interface State {
  dataProvider: PresentationTableDataProvider;
}

export default function GridWidget(props: Props) {
  const { imodel, rulesetId } = props;
  const [diagnosticsOptions, setDiagnosticsOptions] = React.useState<DiagnosticsProps>({ ruleDiagnostics: undefined, devDiagnostics: undefined });

  const dataProvider = useDisposable(React.useCallback(
    () => new PresentationTableDataProvider({ imodel, ruleset: rulesetId, ...diagnosticsOptions }),
    [imodel, rulesetId, diagnosticsOptions],
  ));

  return (
    <div className="gridwidget">
      <h3>{IModelApp.i18n.translate("Sample:controls.grid")}</h3>
      <DiagnosticsSelector onDiagnosticsOptionsChanged={setDiagnosticsOptions} />
      <div className="gridwidget-content">
        <SampleTable dataProvider={dataProvider} />
      </div>
    </div>
  );
}
