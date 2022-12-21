/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { useResizeDetector } from "react-resize-detector";
import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import { DiagnosticsProps, PresentationInstanceFilter, PresentationInstanceFilterDialog } from "@itwin/presentation-components";
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

function GetCount(filter?: PresentationInstanceFilter) {
  const [changes, setNumber] = React.useState<number>(1);

  const changeState = React.useCallback(() => {
    return changes + 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    setNumber(() => changeState());
  }, [changeState, filter]);

  if (!filter)
    return <div>
      found 1 result
    </div>;
  return <div>
    found {changes} result
  </div>;
}

interface Props {
  imodel: IModelConnection;
  rulesetId?: string;
}

interface FilterBuilderProps {
  imodel: IModelConnection;
  rulesetId?: string;
}

export function FilterBuilderWidget(this: any, props: FilterBuilderProps) {
  const { imodel } = props;
  const [descriptor, setDescriptor] = React.useState<Descriptor>();

  React.useEffect(() => {
    const getContentDescriptor = async () => {
      const latestdescriptor = await getDescriptor(imodel);
      setDescriptor(latestdescriptor);
    };
    void getContentDescriptor();
  }, [imodel]);

  return (
    <div className="filterBuilderWidget">
      {descriptor && <div className="filterBuilder">
        <PresentationInstanceFilterDialog
          imodel={imodel}
          descriptor={descriptor}
          isOpen={true}
          // filterResultCountRenderer={GetCount}
          initialFilter={JSON.parse('{"filter":{"operator":9,"field":{"category":"/selected-item/-DgnCustomItemTypes_MyProp__x003A__area","name":"pc_MyProp_areaElementAspect_cm2","label":"cm2","type":{"typeName":"double","valueFormat":"Primitive"},"isReadonly":false,"priority":2147418111,"properties":[{"property":{"classInfo":{"id":"0x171","name":"DgnCustomItemTypes_MyProp:areaElementAspect","label":"area"},"name":"cm2","type":"double","kindOfQuantity":{"name":"DgnCustomItemTypes_MyProp:AREA_area","label":"AREA_area","persistenceUnit":"SQ_CM","activeFormat":{"type":"Decimal","precision":6,"formatTraits":["keepSingleZero","keepDecimalPoint","showUnitLabel"],"composite":{"includeZero":true,"spacer":" ","units":[{"label":"","name":"Units.SQ_CM"}]}}}}}]}},"usedClasses":[{"id":"0xf2","name":"Generic:PhysicalObject","label":"Physical Object"}]}')}
          onInstanceFilterClosed={() => { }}
          onInstanceFilterApplied={() => { }} />
      </div>}
    </div >
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
