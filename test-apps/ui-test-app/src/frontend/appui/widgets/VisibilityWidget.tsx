/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./VisibilityWidget.scss";
import * as React from "react";
import { useResizeDetector } from "react-resize-detector";
import { BeEvent, Id64Array, Id64String } from "@itwin/core-bentley";
import { IModelApp, IModelConnection, NotifyMessageDetails, OutputMessagePriority, Tool, Viewport } from "@itwin/core-frontend";
import { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { FilteringInput, FilteringInputStatus, SelectableContent, SelectionMode } from "@itwin/components-react";
import { Icon, WebFontIcon } from "@itwin/core-react";
import {
  CategoryTree, ClassGroupingOption, CommandItemDef, ConfigurableCreateInfo, ModelsTree, ModelsTreeSelectionPredicate, toggleAllCategories,
  WidgetControl,
} from "@itwin/appui-react";
import { Button } from "@itwin/itwinui-react";
import { SampleAppIModelApp } from "../..";
import cancelFilterIconSvg from "../icons/filter-outlined.svg?sprite";
import filterIconSvg from "../icons/filter.svg?sprite";

export class VisibilityWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactNode = <VisibilityTreeComponent imodel={options.iModelConnection} activeView={IModelApp.viewManager.selectedView} enablePreloading={options.enablePreloading}
      config={options.config} />;
  }
}

interface VisibilityTreeComponentProps {
  imodel: IModelConnection;
  activeView?: Viewport;
  enablePreloading?: boolean;
  config?: {
    modelsTree: {
      selectionMode?: SelectionMode;
      selectionPredicate?: ModelsTreeSelectionPredicate;
    };
    categoriesTree: {
      allViewports?: boolean;
    };
  };
}

function VisibilityTreeComponent(props: VisibilityTreeComponentProps) {
  const { imodel, activeView, enablePreloading } = props;
  const modelsTreeProps = props.config?.modelsTree;
  const categoriesTreeProps = props.config?.categoriesTree;
  const selectLabel = IModelApp.localization.getLocalizedString("UiFramework:visibilityWidget.options");
  const filteredElementIds = useElementIdsFiltering(props.activeView);
  return (
    <div className="ui-test-app-visibility-widget">
      <SelectableContent defaultSelectedContentId="models-tree" selectAriaLabel={selectLabel}>
        {[{
          id: "models-tree",
          label: IModelApp.localization.getLocalizedString("UiFramework:visibilityWidget.modeltree"),
          render: React.useCallback(
            () => <ModelsTreeComponent iModel={imodel} activeView={activeView} enablePreloading={enablePreloading} {...modelsTreeProps} filteredElementIds={filteredElementIds} />,
            [imodel, activeView, enablePreloading, modelsTreeProps, filteredElementIds],
          ),
        },
        {
          id: "categories-tree",
          label: IModelApp.localization.getLocalizedString("UiFramework:visibilityWidget.categories"),
          render: React.useCallback(
            () => <CategoriesTreeComponent iModel={imodel} activeView={activeView} enablePreloading={enablePreloading} {...categoriesTreeProps} />,
            [imodel, activeView, enablePreloading, categoriesTreeProps],
          ),
        }]}
      </SelectableContent>
    </div>
  );
}

interface ModelsTreeComponentProps {
  iModel: IModelConnection;
  selectionMode?: SelectionMode;
  selectionPredicate?: ModelsTreeSelectionPredicate;
  enablePreloading?: boolean;
  activeView?: Viewport;
  filteredElementIds?: Id64Array;
}

function ModelsTreeComponent(props: ModelsTreeComponentProps) {
  const {
    searchOptions,
    filterString,
    activeMatchIndex,
    onFilterApplied,
  } = useTreeFilteringState();
  const { width, height, ref } = useResizeDetector();
  return (
    <>
      <Toolbar
        searchOptions={searchOptions} >
        {[
          <Button
            key="activate-filter-btn"
            onClick={async () => IModelApp.tools.run(TriggerFilterHierarchyByVisibleElementIdsTool.toolId)}>
            <Icon iconSpec={`svg:${filterIconSvg}`} />
          </Button>,
          <Button
            key="cancel-filter-btn"
            onClick={async () => IModelApp.tools.run(CancelFilterHierarchyByVisibleElementIdsTool.toolId)}>
            <Icon iconSpec={`svg:${cancelFilterIconSvg}`} />
          </Button>,
        ]}
      </Toolbar>
      <div ref={ref} className="ui-test-app-visibility-tree-content">
        {width && height ? <ModelsTree
          {...props}
          enableElementsClassGrouping={ClassGroupingOption.YesWithCounts}
          filterInfo={{
            filter: filterString,
            activeMatchIndex,
          }}
          onFilterApplied={onFilterApplied}
          width={width}
          height={height}
        /> : null}
      </div>
    </>
  );
}

interface CategoriesTreeComponentProps {
  iModel: IModelConnection;
  allViewports?: boolean;
  activeView?: Viewport;
  enablePreloading?: boolean;
}

function CategoriesTreeComponent(props: CategoriesTreeComponentProps) {
  const {
    searchOptions,
    filterString,
    activeMatchIndex,
    onFilterApplied,
    filteredProvider,
  } = useTreeFilteringState();

  const showAll = React.useCallback(async () => {
    return toggleAllCategories(IModelApp.viewManager, props.iModel, true, undefined, true, filteredProvider);
  }, [props.iModel, filteredProvider]);

  const hideAll = React.useCallback(async () => {
    return toggleAllCategories(IModelApp.viewManager, props.iModel, false, undefined, true, filteredProvider);
  }, [props.iModel, filteredProvider]);

  const { width, height, ref } = useResizeDetector();

  return (
    <>
      <Toolbar
        searchOptions={searchOptions}
      >
        {[
          <Button key="show-all-btn" onClick={showAll}>
            <WebFontIcon iconName="icon-visibility" />
          </Button>,
          <Button key="hide-all-btn" onClick={hideAll}>
            <WebFontIcon iconName="icon-visibility-hide-2" />
          </Button>,
        ]}
      </Toolbar>
      <div ref={ref} style={{ width: "100%", height: "100%" }}>
        {width && height ? <CategoryTree
          {...props}
          filterInfo={{
            filter: filterString,
            activeMatchIndex,
          }}
          onFilterApplied={onFilterApplied}
          width={width}
          height={height}
        /> : null}
      </div>
    </>
  );
}

interface ToolbarProps {
  searchOptions?: {
    filteringStatus: FilteringInputStatus;
    onFilterCancel: () => void;
    onFilterStart: (newFilter: string) => void;
    onResultSelectedChanged: (index: number) => void;
    matchedResultCount?: number;
  };
  children?: React.ReactNode[];
}

function Toolbar(props: ToolbarProps) {
  return (
    <div className="ui-test-app-visibility-tree-toolbar">
      <div className="tree-toolbar-action-buttons">
        {props.children}
      </div>
      {props.searchOptions && <div className="tree-toolbar-searchbox">
        <FilteringInput
          status={props.searchOptions.filteringStatus}
          onFilterCancel={props.searchOptions.onFilterCancel}
          onFilterClear={props.searchOptions.onFilterCancel}
          onFilterStart={props.searchOptions.onFilterStart}
          resultSelectorProps={{
            onSelectedChanged: props.searchOptions.onResultSelectedChanged,
            resultCount: props.searchOptions.matchedResultCount ?? 0,
          }}
        />
      </div>}
    </div>
  );
}

const useTreeFilteringState = () => {
  const [filterString, setFilterString] = React.useState("");
  const [matchedResultCount, setMatchedResultCount] = React.useState<number>();
  const [activeMatchIndex, setActiveMatchIndex] = React.useState<number>();
  const [filteredProvider, setFilteredProvider] = React.useState<IPresentationTreeDataProvider>();

  const onFilterCancel = React.useCallback(() => {
    setFilterString("");
    setMatchedResultCount(undefined);
    setFilteredProvider(undefined);
  }, []);

  const onFilterStart = React.useCallback((newFilter: string) => {
    setFilterString(newFilter);
    setMatchedResultCount(undefined);
    setFilteredProvider(undefined);
  }, []);

  const onResultSelectedChanged = React.useCallback((index: number) => {
    setActiveMatchIndex(index);
  }, []);
  const onFilterApplied = React.useCallback((provider: IPresentationTreeDataProvider, matches: number) => {
    setFilteredProvider(provider);
    setMatchedResultCount(matches);
  }, []);

  const filteringStatus = !!filterString
    ? (matchedResultCount === undefined)
      ? FilteringInputStatus.FilteringInProgress
      : FilteringInputStatus.FilteringFinished
    : FilteringInputStatus.ReadyToFilter;
  return {
    searchOptions: {
      filteringStatus,
      onFilterCancel,
      onFilterStart,
      onResultSelectedChanged,
      matchedResultCount,
    },
    filterString,
    activeMatchIndex,
    onFilterApplied,
    filteredProvider,
  };
};

const MAX_ELEMENTS_TO_FILTER_BY = 10000;
const useElementIdsFiltering = (activeViewport: Viewport | undefined) => {
  const [filteredElementIds, setFilteredElementIds] = React.useState<Id64Array | undefined>();

  React.useEffect(() => {
    const dropTriggerListener = ELEMENTS_FILTER.onTrigger.addListener(() => {
      activeViewport && activeViewport.queryVisibleFeatures({ source: "screen" }, (features) => {
        const ids = new Set<Id64String>();
        for (const feature of features) {
          ids.add(feature.elementId);
          if (ids.size > MAX_ELEMENTS_TO_FILTER_BY) {
            IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Too many elements visible in the view",
              `There are too many elements visible in the view to filter the hierarchy. Please zoom-in closer to reduce the number of visible elements.`));
            setFilteredElementIds(undefined);
            return;
          }
        }
        setFilteredElementIds([...ids]);
      });
    });
    const dropCancelListener = ELEMENTS_FILTER.onCancel.addListener(() => {
      setFilteredElementIds(undefined);
    });
    return () => {
      dropTriggerListener();
      dropCancelListener();
    };
  }, [activeViewport]);

  React.useEffect(() => {
    TriggerFilterHierarchyByVisibleElementIdsTool.register(SampleAppIModelApp.sampleAppNamespace);
    CancelFilterHierarchyByVisibleElementIdsTool.register(SampleAppIModelApp.sampleAppNamespace);
    return () => {
      IModelApp.tools.unRegister(TriggerFilterHierarchyByVisibleElementIdsTool.toolId);
      IModelApp.tools.unRegister(CancelFilterHierarchyByVisibleElementIdsTool.toolId);
    };
  }, []);

  return filteredElementIds;
};

class FilterHierarchyByElementIds {
  public readonly onTrigger = new BeEvent<() => void>();
  public readonly onCancel = new BeEvent<() => void>();
}
const ELEMENTS_FILTER = new FilterHierarchyByElementIds();

export class TriggerFilterHierarchyByVisibleElementIdsTool extends Tool {
  public static override toolId = "TriggerFilterHierarchyByVisibleElementIds";
  public override async run(): Promise<boolean> {
    ELEMENTS_FILTER.onTrigger.raiseEvent();
    return true;
  }
  public static override get keyin(): string {
    return "visibility widget trigger filter by visible elements";
  }
  public static override get englishKeyin(): string {
    return this.keyin;
  }

  public static getCommandItemDef() {
    return new CommandItemDef({
      iconSpec: `svg:${filterIconSvg}`,
      commandId: "TriggerFilterHierarchyByVisibleElementIds",
      label: "Enable filter tree by visible elements",
      execute: async () => { await IModelApp.tools.run(TriggerFilterHierarchyByVisibleElementIdsTool.toolId); },
    });
  }
}

export class CancelFilterHierarchyByVisibleElementIdsTool extends Tool {
  public static override toolId = "CancelFilterHierarchyByVisibleElementIds";
  public override async run(): Promise<boolean> {
    ELEMENTS_FILTER.onCancel.raiseEvent();
    return true;
  }
  public static override get keyin(): string {
    return "visibility widget cancel filter by visible elements";
  }
  public static override get englishKeyin(): string {
    return this.keyin;
  }

  public static getCommandItemDef() {
    return new CommandItemDef({
      iconSpec: `svg:${cancelFilterIconSvg}`,
      commandId: "CancelFilterHierarchyByVisibleElementIds",
      label: "Cancel filter tree by visible elements",
      execute: async () => { await IModelApp.tools.run(CancelFilterHierarchyByVisibleElementIdsTool.toolId); },
    });
  }
}
