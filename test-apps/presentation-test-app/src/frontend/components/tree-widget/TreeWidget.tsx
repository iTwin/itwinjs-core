/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { DiagnosticsProps } from "@bentley/presentation-components";
import { FilteringInput } from "@bentley/ui-components";
import { DiagnosticsSelector } from "../diagnostics-selector/DiagnosticsSelector";
import { Tree } from "./Tree";

interface Props {
  imodel: IModelConnection;
  rulesetId?: string;
}

export function TreeWidget(props: Props) {
  const [diagnosticsOptions, setDiagnosticsOptions] = React.useState<DiagnosticsProps>({ ruleDiagnostics: undefined, devDiagnostics: undefined });

  const [filter, setFilter] = React.useState("");
  const [isFiltering, setIsFiltering] = React.useState(false);
  const [matchesCount, setMatchesCount] = React.useState<number>();
  const [activeMatchIndex, setActiveMatchIndex] = React.useState(0);

  const onFilteringStateChange = React.useCallback((newIsFiltering: boolean, newMatchesCount: number | undefined) => {
    setIsFiltering(newIsFiltering);
    setMatchesCount(newMatchesCount);
  }, []);

  return (
    <div className="treewidget">
      <div className="treewidget-header">
        <h3>{IModelApp.i18n.translate("Sample:controls.tree")}</h3>
        <DiagnosticsSelector onDiagnosticsOptionsChanged={setDiagnosticsOptions} />
        {props.rulesetId ? <FilteringInput
          filteringInProgress={isFiltering}
          onFilterCancel={() => { setFilter(""); }}
          onFilterClear={() => { setFilter(""); }}
          onFilterStart={(newFilter) => { setFilter(newFilter); }}
          resultSelectorProps={{
            onSelectedChanged: (index) => setActiveMatchIndex(index),
            resultCount: matchesCount || 0,
          }} /> : null}
      </div>
      <div className="filteredTree">
        {props.rulesetId ? <>
          <Tree
            imodel={props.imodel}
            rulesetId={props.rulesetId}
            diagnostics={diagnosticsOptions}
            filtering={{ filter, activeMatchIndex, onFilteringStateChange }}
          />
          {isFiltering ? <div className="filteredTreeOverlay" /> : null}
        </> : null}
      </div>
    </div>
  );
}
