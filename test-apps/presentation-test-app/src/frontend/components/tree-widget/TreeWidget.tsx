/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { useResizeDetector } from "react-resize-detector";
import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import { DiagnosticsProps, PresentationInstanceFilterBuilder } from "@itwin/presentation-components";
import { FilteringInput, FilteringInputStatus } from "@itwin/components-react";
import { DiagnosticsSelector } from "../diagnostics-selector/DiagnosticsSelector";
import { Tree } from "./Tree";
import { ContentSpecificationTypes, DefaultContentDisplayTypes, Descriptor, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";

const getDescriptor = async (imodel: IModelConnection) => {
  const ruleset: Ruleset = {
    id: "MyRuleset",
    rules: [{
      ruleType: RuleTypes.Content,
      specifications: [{
        specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
        classes: { schemaName: "BisCore", classNames: ["GeometricElement3d"], arePolymorphic: true },
        handlePropertiesPolymorphically: true,
      }],
    }],
  };
  const descriptor = await Presentation.presentation.getContentDescriptor({
    imodel, rulesetOrId: ruleset,
    displayType: DefaultContentDisplayTypes.PropertyPane,
    keys: new KeySet(),
  });
  return descriptor;
};

interface Props {
  imodel: IModelConnection;
  rulesetId?: string;
}

interface FilterBuilderProps {
  imodel: IModelConnection;
  rulesetId?: string;
}

export function FilterBuilderWidget(this: any, props: FilterBuilderProps) {
  const {imodel} = props;
  const [descriptor, setDescriptor] = React.useState<Descriptor>();

  React.useEffect(() => {
    const getContentDescriptor = async () => {
      const latestdescriptor = await getDescriptor(imodel);
      setDescriptor(latestdescriptor);
    };
    void getContentDescriptor();
  }, [imodel]);

  return (
    <div className="treewidget">
      {descriptor && <div className="filteredTree">
        <PresentationInstanceFilterBuilder
          imodel={imodel}
          descriptor={descriptor}
          onInstanceFilterChanged={ () => {} }
        />
      </div>}
    </div>
  );
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
