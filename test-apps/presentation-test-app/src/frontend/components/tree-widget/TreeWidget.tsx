/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { useResizeDetector } from "react-resize-detector";
import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import { DiagnosticsProps } from "@itwin/presentation-components";
import { FilteringInput, FilteringInputStatus } from "@itwin/components-react";
import { DiagnosticsSelector } from "../diagnostics-selector/DiagnosticsSelector";
import { Tree } from "./Tree";

interface Props {
  imodel: IModelConnection;
  rulesetId?: string;
}

export function TreeWidget(props: Props) {
  const { rulesetId, imodel } = props;
  const [diagnosticsOptions, setDiagnosticsOptions] = React.useState<DiagnosticsProps>({ ruleDiagnostics: undefined, devDiagnostics: undefined });
  const [filter, setFilter] = React.useState("");
  const [filteringStatus, setFilteringStatus] = React.useState(FilteringInputStatus.ReadyToFilter);
  const [matchesCount, setMatchesCount] = React.useState<number>();
  const [activeMatchIndex, setActiveMatchIndex] = React.useState(0);

  const onFilteringStateChange = React.useCallback((isFiltering: boolean, newMatchesCount: number | undefined) => {
    setFilteringStatus(isFiltering
      ? FilteringInputStatus.FilteringInProgress : (undefined !== newMatchesCount)
        ? FilteringInputStatus.FilteringFinished : FilteringInputStatus.ReadyToFilter,
    );
    setMatchesCount(newMatchesCount);
  }, []);

  const { width, height, ref } = useResizeDetector();

  return (
    <div className="treewidget">
      <div className="treewidget-header">
        <h3>{IModelApp.localization.getLocalizedString("Sample:controls.tree")}</h3>
        <DiagnosticsSelector onDiagnosticsOptionsChanged={setDiagnosticsOptions} />
        {rulesetId ? <FilteringInput
          status={filteringStatus}
          onFilterCancel={() => { setFilter(""); }}
          onFilterClear={() => { setFilter(""); }}
          onFilterStart={(newFilter) => { setFilter(newFilter); }}
          resultSelectorProps={{
            onSelectedChanged: (index) => setActiveMatchIndex(index),
            resultCount: matchesCount || 0,
          }} /> : null}
      </div>
      <div ref={ref} className="filteredTree">
        {rulesetId && width && height ? <>
          <Tree
            imodel={imodel}
            rulesetId={rulesetId}
            diagnostics={diagnosticsOptions}
            filtering={{ filter, activeMatchIndex, onFilteringStateChange }}
            width={width}
            height={height}
          />
          {(filteringStatus === FilteringInputStatus.FilteringInProgress) ? <div className="filteredTreeOverlay" /> : null}
        </> : null}
      </div>
    </div>
  );
}
