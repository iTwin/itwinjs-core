/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./VisibilityWidget.scss";
import * as React from "react";
import { BeEvent, Id64Array, Id64String } from "@itwin/core-bentley";
import { IModelApp, IModelConnection, NotifyMessageDetails, OutputMessagePriority, Tool, Viewport } from "@itwin/core-frontend";
import { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { FilteringInput, FilteringInputStatus, SelectableContent, SelectionMode } from "@itwin/components-react";
import { Icon, useLayoutResizeObserver, useRefState, WebFontIcon } from "@itwin/core-react";
import {
  CategoryTree, ClassGroupingOption, CommandItemDef, ConfigurableCreateInfo, ModelsTree, ModelsTreeNodeType, ModelsTreeSelectionPredicate, toggleAllCategories,
  useActiveViewport,
  WidgetControl,
} from "@itwin/appui-react";
import { Button } from "@itwin/itwinui-react";
import { NodeKey } from "@itwin/presentation-common";
import { UiItemsProvidersTest } from "../../ui-items-providers-test";

// eslint-disable-next-line @typescript-eslint/naming-convention
function CancelFilterIcon(props?: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"  {...props}>
      <path d="M15,1v0.5L9.4,6.2L9,6.5V7v5.5L7,14V7V6.5L6.6,6.2L1,1.5V1H15 M16,0H0v2l6,5v9l4-3V7l6-5V0L16,0z" />
    </svg>
  );
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function FilterIcon(props?: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"  {...props}>
      <path d="m0 0v2l6 5v9l4-3v-6l6-5v-2z" />
    </svg>
  );
}

export class VisibilityWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactNode = <VisibilityTreeComponent config={options.config} />;
  }
}

export interface VisibilityTreeComponentProps {
  config?: {
    modelsTree: {
      selectionMode?: SelectionMode;
      selectionPredicate?: ModelsTreeSelectionPredicate; // eslint-disable-line deprecation/deprecation
    };
    categoriesTree: {
      allViewports?: boolean;
    };
  };
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function VisibilityTreeComponent(props: VisibilityTreeComponentProps) {
  const activeView = useActiveViewport();
  const imodel = React.useMemo(() => activeView?.iModel, [activeView]);

  const modelsTreeProps = React.useMemo(() => props.config?.modelsTree ?? {
    selectionMode: SelectionMode.Extended,
    selectionPredicate: (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Element, // eslint-disable-line deprecation/deprecation
  }, [props.config]);
  const categoriesTreeProps = props.config?.categoriesTree;
  const selectLabel = IModelApp.localization.getLocalizedString("UiFramework:visibilityWidget.options");
  const filteredElementIds = useElementIdsFiltering(activeView);
  const renderModels = React.useCallback(
    () => imodel ? <ModelsTreeComponent iModel={imodel} activeView={activeView} {...modelsTreeProps} filteredElementIds={filteredElementIds} /> : null,
    [imodel, activeView, modelsTreeProps, filteredElementIds]);

  const renderCategories = React.useCallback(
    () => imodel ? <CategoriesTreeComponent iModel={imodel} activeView={activeView} {...categoriesTreeProps} /> : null,
    [imodel, activeView, categoriesTreeProps]);

  return (
    <div className="ui-test-app-visibility-widget">
      <SelectableContent defaultSelectedContentId="models-tree" selectAriaLabel={selectLabel}>
        {[{
          id: "models-tree",
          label: IModelApp.localization.getLocalizedString("UiFramework:visibilityWidget.modeltree"),
          render: renderModels,
        },
        {
          id: "categories-tree",
          label: IModelApp.localization.getLocalizedString("UiFramework:visibilityWidget.categories"),
          render: renderCategories,
        }]}
      </SelectableContent>
    </div>
  );
}

interface ModelsTreeComponentProps {
  iModel: IModelConnection;
  selectionMode?: SelectionMode;
  selectionPredicate?: ModelsTreeSelectionPredicate; // eslint-disable-line deprecation/deprecation
  activeView?: Viewport;
  filteredElementIds?: Id64Array;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function ModelsTreeComponent(props: ModelsTreeComponentProps) {
  const {
    searchOptions,
    filterString,
    activeMatchIndex,
    onFilterApplied,
  } = useTreeFilteringState();

  const [divRef, divElement] = useRefState<HTMLDivElement>();
  const [width, height] = useLayoutResizeObserver(divElement ?? null);

  return (
    <>
      <Toolbar
        searchOptions={searchOptions} >
        {[
          <Button
            key="activate-filter-btn"
            onClick={async () => IModelApp.tools.run(TriggerFilterHierarchyByVisibleElementIdsTool.toolId)}>
            <Icon iconSpec={<FilterIcon />} />
          </Button>,
          <Button
            key="cancel-filter-btn"
            onClick={async () => IModelApp.tools.run(CancelFilterHierarchyByVisibleElementIdsTool.toolId)}>
            <Icon iconSpec={<CancelFilterIcon />} />
          </Button>,
        ]}
      </Toolbar>
      <div ref={divRef} className="ui-test-app-visibility-tree-content">
        {width && height ? <ModelsTree // eslint-disable-line deprecation/deprecation
          {...props}
          enableElementsClassGrouping={ClassGroupingOption.YesWithCounts} // eslint-disable-line deprecation/deprecation
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
}

// eslint-disable-next-line @typescript-eslint/naming-convention
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

  const [divRef, divElement] = useRefState<HTMLDivElement>();
  const [width, height] = useLayoutResizeObserver(divElement ?? null);

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
      <div ref={divRef} style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        {width && height ? <CategoryTree // eslint-disable-line deprecation/deprecation
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

// eslint-disable-next-line @typescript-eslint/naming-convention
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
    TriggerFilterHierarchyByVisibleElementIdsTool.register(UiItemsProvidersTest.localizationNamespace);
    CancelFilterHierarchyByVisibleElementIdsTool.register(UiItemsProvidersTest.localizationNamespace);
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
  public static override toolId = "TestItemsProvider:TriggerFilterHierarchyByVisibleElementIds";
  public override async run(): Promise<boolean> {
    ELEMENTS_FILTER.onTrigger.raiseEvent();
    return true;
  }
  public static override get keyin(): string {
    return "test visibility widget trigger filter by visible elements";
  }
  public static override get englishKeyin(): string {
    return this.keyin;
  }

  public static getCommandItemDef() {
    return new CommandItemDef({
      iconSpec: <FilterIcon />,
      commandId: "TriggerFilterHierarchyByVisibleElementIds",
      label: "Enable filter tree by visible elements",
      execute: async () => { await IModelApp.tools.run(TriggerFilterHierarchyByVisibleElementIdsTool.toolId); },
    });
  }
}

export class CancelFilterHierarchyByVisibleElementIdsTool extends Tool {
  public static override toolId = "TestItemsProvider:CancelFilterHierarchyByVisibleElementIds";
  public override async run(): Promise<boolean> {
    ELEMENTS_FILTER.onCancel.raiseEvent();
    return true;
  }
  public static override get keyin(): string {
    return "test visibility widget cancel filter by visible elements";
  }
  public static override get englishKeyin(): string {
    return this.keyin;
  }

  public static getCommandItemDef() {
    return new CommandItemDef({
      iconSpec: <CancelFilterIcon />,
      commandId: "CancelFilterHierarchyByVisibleElementIds",
      label: "Cancel filter tree by visible elements",
      execute: async () => { await IModelApp.tools.run(CancelFilterHierarchyByVisibleElementIdsTool.toolId); },
    });
  }
}
