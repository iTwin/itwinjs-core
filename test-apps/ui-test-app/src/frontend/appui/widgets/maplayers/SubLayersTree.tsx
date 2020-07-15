/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, ScreenViewport } from "@bentley/imodeljs-frontend";
import { PropertyValueFormat } from "@bentley/ui-abstract";
import { CheckBoxState, ImageCheckBox, Input, NodeCheckboxRenderProps, useDisposable, WebFontIcon } from "@bentley/ui-core";
import { AbstractTreeNodeLoaderWithProvider, ControlledTree, DelayLoadedTreeNodeItem, HighlightableTreeProps, ITreeDataProvider, SelectionMode, TreeCheckboxStateChangeEventArgs, TreeDataProvider, TreeEventHandler, TreeModelSource, TreeNodeItem, TreeNodeLoader, TreeNodeRenderer, TreeNodeRendererProps, TreeRenderer, TreeRendererProps, UiComponents, useVisibleTreeNodes } from "@bentley/ui-components";
import { StyleMapLayerSettings } from "./MapLayerManager";
import { SubLayersDataProvider } from "./SubLayersDataProvider";
import { MapLayerSettings, MapSubLayerProps, MapSubLayerSettings } from "@bentley/imodeljs-common";
import "./SubLayersTree.scss";

interface ToolbarProps {
  searchField?: React.ReactNode;
  children?: React.ReactNode[];
}

function Toolbar(props: ToolbarProps) {
  return (
    <div className="map-manager-sublayer-tree-toolbar">
      <div className="tree-toolbar-action-buttons">
        {props.children}
      </div>
      {props.searchField && <div className="tree-toolbar-searchbox">
        {props.searchField}
      </div>}
    </div>
  );
}

export function SubLayersPanel({ mapLayer, viewport }: { mapLayer: StyleMapLayerSettings, viewport: ScreenViewport | undefined }) {
  const [noneAvailableLabel] = React.useState("No Sub-layers Available");
  if (!viewport || (undefined === mapLayer.subLayers || 0 === mapLayer.subLayers.length)) {
    return <div className="map-manager-sublayer-panel">
      <div>{noneAvailableLabel}</div>
    </div>;
  }

  return (
    <SubLayersTree mapLayer={mapLayer} />
  );
}

function getSubLayerProps(subLayerSettings: MapSubLayerSettings[]): MapSubLayerProps[] {
  return subLayerSettings.map((subLayer) => subLayer.toJSON());
}

function getStyleMapLayerSettings(settings: MapLayerSettings, isOverlay: boolean): StyleMapLayerSettings {
  return {
    visible: settings.visible,
    name: settings.name,
    url: settings.url,
    transparency: settings.transparency,
    transparentBackground: settings.transparentBackground,
    subLayers: settings.subLayers ? getSubLayerProps(settings.subLayers) : undefined,
    showSubLayers: true,
    isOverlay,
  };
}

/**
 * This component demonstrates how use `ControlledTree` with custom checkbox rendering.
 * It uses `SubLayersDataProvider` to get fake data to show.
 *
 * In order to override default rendering in `ControlledTree` custom 'treeRenderer' should
 * be passed to it. In this component 'nodeWithEyeCheckboxTreeRenderer' is used. It uses default
 * `TreeRenderer` with overridden node renderer.
 */
export function SubLayersTree(props: { mapLayer: StyleMapLayerSettings }) {
  const [placeholderLabel] = React.useState(UiComponents.translate("filteringInput:placeholder"));
  const [mapLayer, setMapLayer] = React.useState(props.mapLayer);
  const [layerFilterString, setLayerFilterString] = React.useState<string>("");

  // create data provider to get some nodes to show in tree
  // `React.useMemo' is used avoid creating new object on each render cycle
  const dataProvider = React.useMemo(() => new SubLayersDataProvider(mapLayer), [mapLayer]);

  const {
    modelSource,
    nodeLoader,
    nodeHighlightingProps,
  } = useTreeFiltering(dataProvider, layerFilterString);

  // create custom event handler. It handles all tree event same as `TreeEventHandler` but additionally
  // it selects/deselects node when checkbox is checked/unchecked and vice versa.
  // `useDisposable` takes care of disposing old event handler when new is created in case 'nodeLoader' has changed
  // `React.useCallback` is used to avoid creating new callback that creates handler on each render
  const eventHandler = useDisposable(React.useCallback(() => new SubLayerCheckboxHandler(mapLayer, nodeLoader), [nodeLoader, mapLayer]));

  // get list of visible nodes to render in `ControlledTree`. This is a flat list of nodes in tree model.
  // `useVisibleTreeNodes` uses 'modelSource' to get flat list of nodes and listens for model changes to
  // re-render component with updated nodes list
  const visibleNodes = useVisibleTreeNodes(modelSource);

  const showAll = React.useCallback(async () => {
    const vp = IModelApp.viewManager.selectedView;
    const displayStyle = vp?.displayStyle;
    if (displayStyle && vp) {
      const indexInDisplayStyle = displayStyle ? displayStyle.findMapLayerIndexByNameAndUrl(mapLayer.name, mapLayer.url, mapLayer.isOverlay) : -1;
      displayStyle.changeMapSubLayerProps({ visible: true }, -1, indexInDisplayStyle, mapLayer.isOverlay);
      // toggleAllCategories(IModelApp.viewManager, props.iModel, true, undefined, true, filteredProvider);
      vp.invalidateRenderPlan();
      const updatedMapLayer = displayStyle.mapLayerAtIndex(indexInDisplayStyle, mapLayer.isOverlay);
      if (updatedMapLayer) {
        setMapLayer(getStyleMapLayerSettings(updatedMapLayer, mapLayer.isOverlay));
      }
    }
  }, [mapLayer]);

  const hideAll = React.useCallback(async () => {
    const vp = IModelApp.viewManager.selectedView;
    const displayStyle = vp?.displayStyle;
    if (displayStyle && vp) {
      const indexInDisplayStyle = displayStyle ? displayStyle.findMapLayerIndexByNameAndUrl(mapLayer.name, mapLayer.url, mapLayer.isOverlay) : -1;
      displayStyle.changeMapSubLayerProps({ visible: false }, -1, indexInDisplayStyle, mapLayer.isOverlay);
      const updatedMapLayer = displayStyle.mapLayerAtIndex(indexInDisplayStyle, mapLayer.isOverlay);
      if (updatedMapLayer) {
        setMapLayer(getStyleMapLayerSettings(updatedMapLayer, mapLayer.isOverlay));
      }
      vp.invalidateRenderPlan();
    }
  }, [mapLayer]);

  const handleFilterTextChanged = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setLayerFilterString(event.target.value);
  }, []);

  return <>
    <div className="map-manager-sublayer-tree">
      <Toolbar
        searchField={
          <Input type="text" className="map-manager-source-list-filter"
            placeholder={placeholderLabel}
            value={layerFilterString}
            onChange={handleFilterTextChanged} />
        }
      >
        {[
          <button key="show-all-btn" title="Turn on all Sub-layers" onClick={showAll}>
            <WebFontIcon iconName="icon-visibility" />
          </button>,
          <button key="hide-all-btn" title="Turn off all Sub-layers" onClick={hideAll}>
            <WebFontIcon iconName="icon-visibility-hide-2" />
          </button>,
        ]}
      </Toolbar>
      <ControlledTree
        nodeLoader={nodeLoader}
        selectionMode={SelectionMode.None}
        treeEvents={eventHandler}
        visibleNodes={visibleNodes}
        treeRenderer={nodeWithEyeCheckboxTreeRenderer}
        nodeHighlightingProps={nodeHighlightingProps}
      />
    </div>
  </>;
}

/** TreeEventHandler derived class that handler processing changes to subLayer visibility */
class SubLayerCheckboxHandler extends TreeEventHandler {
  constructor(private _mapLayer: StyleMapLayerSettings, nodeLoader: AbstractTreeNodeLoaderWithProvider<TreeDataProvider>) {
    super({ modelSource: nodeLoader.modelSource, nodeLoader, collapsedChildrenDisposalEnabled: true });
  }

  /** Changes nodes checkboxes states until event is handled or handler is disposed */
  public onCheckboxStateChanged({ stateChanges }: TreeCheckboxStateChangeEventArgs) {
    // call base checkbox handling
    const baseHandling = super.onCheckboxStateChanged({ stateChanges });

    // subscribe to checkbox state changes to new checkbox states and do some additional work with them
    const selectionHandling = stateChanges.subscribe({
      next: (changes) => {
        const vp = IModelApp.viewManager.selectedView;
        const displayStyle = vp?.displayStyle;
        const indexInDisplayStyle = displayStyle ? displayStyle.findMapLayerIndexByNameAndUrl(this._mapLayer.name, this._mapLayer.url, this._mapLayer.isOverlay) : -1;
        changes.forEach((change) => {
          const isSelected = (change.newState === CheckBoxState.On);
          if (-1 !== indexInDisplayStyle && displayStyle) {
            displayStyle.changeMapSubLayerProps({ visible: isSelected }, undefined !== change.nodeItem.extendedData?.subLayerId ? change.nodeItem.extendedData?.subLayerId : change.nodeItem.id, indexInDisplayStyle, this._mapLayer.isOverlay);
          }
        });
        if (vp)
          vp.invalidateRenderPlan();
      },
    });
    // stop handling selection when checkboxes handling is stopped
    baseHandling?.add(selectionHandling);
    return baseHandling;
  }
}

/** Custom checkbox renderer that renders checkbox as an eye */
const eyeCheckboxRenderer = (props: NodeCheckboxRenderProps) => (
  <ImageCheckBox
    checked={props.checked}
    disabled={props.disabled}
    imageOn="icon-visibility"
    imageOff="icon-visibility-hide-2"
    onClick={props.onChange}
    tooltip={props.title}
  />
);

/** Custom node renderer. It uses default 'TreeNodeRenderer' but overrides default checkbox renderer to render checkbox as an eye */
const nodeWithEyeCheckboxRenderer = (props: TreeNodeRendererProps) => (
  <TreeNodeRenderer
    {...props}
    checkboxRenderer={eyeCheckboxRenderer}
  />
);

/** Custom tree renderer. It uses default `TreeRenderer` but overrides default node renderer to render node with custom checkbox */
const nodeWithEyeCheckboxTreeRenderer = (props: TreeRendererProps) => (
  <TreeRenderer
    {...props}
    nodeRenderer={nodeWithEyeCheckboxRenderer}
  />
);

function useTreeFiltering(
  dataProvider: ITreeDataProvider,
  filter: string,
) {
  const nodeLoader = useFilteredProvider(dataProvider, filter);
  const nodeHighlightingProps = useNodeHighlightingProps(filter);
  return {
    nodeLoader,
    modelSource: nodeLoader.modelSource,
    nodeHighlightingProps,
  };
}

function useFilteredProvider(
  dataProvider: ITreeDataProvider,
  filter: string,
) {
  const filteredProvider = React.useMemo(() => {
    return new FilteredTreeDataProvider(dataProvider, filter);
  }, [dataProvider, filter]);

  const nodeLoader = React.useMemo(() => {
    return new TreeNodeLoader(filteredProvider, new TreeModelSource());
  }, [filteredProvider]);

  return nodeLoader;
}

function useNodeHighlightingProps(
  filter: string,
) {
  const [nodeHighlightingProps, setNodeHighlightingProps] = React.useState<HighlightableTreeProps>();

  React.useEffect(() => {
    if (filter === "") {
      setNodeHighlightingProps(undefined);
      return;
    }
    setNodeHighlightingProps({
      searchText: filter,
      activeMatch: undefined,
    });
  }, [filter]);

  return nodeHighlightingProps;
}

class FullTreeHierarchy {
  private _dataProvider: ITreeDataProvider;
  private _hierarchy = new Map<string | undefined, DelayLoadedTreeNodeItem[]>();
  private _init: Promise<void>;

  public constructor(dataProvider: ITreeDataProvider) {
    this._dataProvider = dataProvider;

    this._init = (async () => {
      await this.initNode();
    })();
  }

  private async initNode(parent?: TreeNodeItem) {
    const nodes = await this._dataProvider.getNodes(parent);
    this._hierarchy.set(parent?.id, nodes);
    for (const node of nodes) {
      await this.initNode(node);
    }
  }

  public async getHierarchy() {
    await this._init;
    return this._hierarchy;
  }
}

class FilteredTreeHierarchy {
  private _fullHierarchy: FullTreeHierarchy;
  private _filter: string;
  private _filtered = new Map<string | undefined, DelayLoadedTreeNodeItem[]>();
  private _init: Promise<void>;

  public constructor(dataProvider: ITreeDataProvider, filter: string) {
    this._fullHierarchy = new FullTreeHierarchy(dataProvider);
    this._filter = filter;

    this._init = (async () => {
      await this.init();
    })();
  }

  private async init() {
    const hierarchy = await this._fullHierarchy.getHierarchy();
    if (this._filter === "") {
      this._filtered = hierarchy;
      return;
    }
    this.filterNodes(hierarchy);
  }

  /** Initializes `this._filtered` field. Returns a node if it matches a filter. */
  private filterNodes(hierarchy: Map<string | undefined, DelayLoadedTreeNodeItem[]>, current?: DelayLoadedTreeNodeItem): DelayLoadedTreeNodeItem | undefined {
    const matches = current ? this.matchesFilter(current) : false;
    const children = hierarchy.get(current?.id);
    if (!children)
      return matches ? current : undefined;

    const matchedChildren = new Array<DelayLoadedTreeNodeItem>();
    for (const child of children) {
      const matchedChild = this.filterNodes(hierarchy, child);
      matchedChild && matchedChildren.push(matchedChild);
    }

    const hasChildren = matchedChildren.length > 0;
    const included = matches || hasChildren;
    let filtered: DelayLoadedTreeNodeItem | undefined;
    if (included) {
      this._filtered.set(current?.id, matchedChildren);

      // Return a modified copy of current node (to persist initial hierarchy when filter is cleared).
      if (current) {
        filtered = {
          ...current,
          hasChildren,
          autoExpand: hasChildren ? true : current.autoExpand,
        };
      }
    }
    return filtered;
  }

  private matchesFilter(node: TreeNodeItem) {
    if (node.label.value.valueFormat !== PropertyValueFormat.Primitive)
      return false;

    const value = node.label.value.displayValue?.toLowerCase();
    if (!value)
      return false;
    return value.includes(this._filter.toLowerCase());
  }

  public async getHierarchy() {
    await this._init;
    return this._filtered;
  }
}

class FilteredTreeDataProvider implements ITreeDataProvider {
  private _hierarchy: FilteredTreeHierarchy;

  public constructor(
    parentDataProvider: ITreeDataProvider,
    filter: string,
  ) {
    this._hierarchy = new FilteredTreeHierarchy(parentDataProvider, filter);
  }

  public async getNodes(parent?: TreeNodeItem) {
    const hierarchy = await this._hierarchy.getHierarchy();
    const nodes = hierarchy.get(parent?.id);
    return nodes || [];
  }

  public async getNodesCount(parent?: TreeNodeItem) {
    const hierarchy = await this._hierarchy.getHierarchy();
    const nodes = hierarchy.get(parent?.id);
    return nodes?.length || 0;
  }
}
