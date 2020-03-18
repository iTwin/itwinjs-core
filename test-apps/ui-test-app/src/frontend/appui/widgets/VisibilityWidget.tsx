/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelConnection, IModelApp, Viewport } from "@bentley/imodeljs-frontend";
import { ModelsTree, CategoryTree, WidgetControl, ConfigurableCreateInfo, toggleAllCategories, ModelsTreeSelectionPredicate } from "@bentley/ui-framework";
import { FilteringInput, SelectableContent, SelectionMode } from "@bentley/ui-components";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { WebFontIcon } from "@bentley/ui-core";

import "./VisibilityWidget.scss";

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
    },
    categoriesTree: {
      allViewports?: boolean;
    },
  };
}

function VisibilityTreeComponent(props: VisibilityTreeComponentProps) {
  const { imodel, activeView, enablePreloading } = props;
  const modelsTreeProps = props.config?.modelsTree;
  const categoriesTreeProps = props.config?.categoriesTree;
  return (
    <div className="ui-test-app-visibility-widget">
      <SelectableContent defaultSelectedContentId="models-tree">
        {[{
          id: "models-tree",
          label: IModelApp.i18n.translate("UiFramework:visibilityWidget.modeltree"),
          render: React.useCallback(
            () => <ModelsTreeComponent iModel={imodel} activeView={activeView} enablePreloading={enablePreloading} {...modelsTreeProps} />,
            [imodel, activeView, enablePreloading, modelsTreeProps],
          ),
        },
        {
          id: "categories-tree",
          label: IModelApp.i18n.translate("UiFramework:visibilityWidget.categories"),
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
}

function ModelsTreeComponent(props: ModelsTreeComponentProps) {
  const {
    searchOptions,
    filterString,
    activeMatchIndex,
    onFilterApplied,
  } = useTreeFilteringState();

  return (
    <>
      <Toolbar
        searchOptions={searchOptions}
      />
      <ModelsTree
        {...props}
        filterInfo={{
          filter: filterString,
          activeMatchIndex,
        }}
        onFilterApplied={onFilterApplied}
      />
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

  return (
    <>
      <Toolbar
        searchOptions={searchOptions}
      >
        {[
          <button key="show-all-btn" onClick={showAll}>
            <WebFontIcon iconName="icon-visibility" />
          </button>,
          <button key="hide-all-btn" onClick={hideAll}>
            <WebFontIcon iconName="icon-visibility-hide-2" />
          </button>,
        ]}
      </Toolbar>
      <CategoryTree
        {...props}
        filterInfo={{
          filter: filterString,
          activeMatchIndex,
        }}
        onFilterApplied={onFilterApplied}
      />
    </>
  );
}

interface ToolbarProps {
  searchOptions?: {
    isFiltering: boolean;
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
          filteringInProgress={props.searchOptions.isFiltering}
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

  const isFiltering = !!filterString && matchedResultCount === undefined;
  return {
    searchOptions: {
      isFiltering,
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
