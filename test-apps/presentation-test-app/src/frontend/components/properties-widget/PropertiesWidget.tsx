/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./PropertiesWidget.css";
import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { Field } from "@bentley/presentation-common";
import {
  FavoritePropertiesDataFilterer, IPresentationPropertyDataProvider, PresentationPropertyDataProvider, usePropertyDataProviderWithUnifiedSelection,
} from "@bentley/presentation-components";
import { FavoritePropertiesScope, Presentation } from "@bentley/presentation-frontend";
import { PropertyRecord } from "@bentley/ui-abstract";
import {
  ActionButtonRendererProps, CompositeFilterType, CompositePropertyDataFilterer, DisplayValuePropertyDataFilterer, FilteringInput,
  FilteringInputStatus, FilteringPropertyDataProvider, LabelPropertyDataFilterer, PropertyCategory, PropertyData, PropertyGridContextMenuArgs,
  PropertyRecordMatchInfo, useAsyncValue, useDebouncedAsyncValue, VirtualizedPropertyGridWithDataProvider,
} from "@bentley/ui-components";
import { ContextMenuItem, ContextMenuItemProps, FillCentered, GlobalContextMenu, Orientation, Toggle, useDisposable } from "@bentley/ui-core";

const FAVORITES_SCOPE = FavoritePropertiesScope.IModel;

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
  onFindSimilar?: (propertiesProvider: IPresentationPropertyDataProvider, record: PropertyRecord) => void;
}

export function PropertiesWidget(props: Props) {
  const dataProvider = React.useMemo(() => createDataProvider(props.imodel, props.rulesetId), [props.imodel, props.rulesetId]);

  const [activeMatchIndex, setActiveMatchIndex] = React.useState(0);
  const [filteringProvDataChanged, setFilteringProvDataChanged] = React.useState({});
  const [activeMatch, setActiveMatch] = React.useState<PropertyRecordMatchInfo>();
  const { isOverLimit } = usePropertyDataProviderWithUnifiedSelection({ dataProvider });

  const renderFavoritesActionButton = React.useCallback((buttonProps: ActionButtonRendererProps) => (<FavoritePropertyActionButton {...buttonProps} dataProvider={dataProvider} />), [dataProvider]);
  const renderCopyActionButton = React.useCallback(() => <CopyActionButton />, []);

  const [contextMenuArgs, setContextMenuArgs] = React.useState<PropertyGridContextMenuArgs>();
  const onPropertyContextMenu = React.useCallback((args: PropertyGridContextMenuArgs) => {
    args.event.persist();
    setContextMenuArgs(args);
  }, []);
  const onCloseContextMenu = React.useCallback(() => {
    setContextMenuArgs(undefined);
  }, []);

  const { onFindSimilar: onFindSimilarProp } = props;
  const onFindSimilar = React.useCallback((property: PropertyRecord) => {
    if (onFindSimilarProp)
      onFindSimilarProp(dataProvider, property);
    setContextMenuArgs(undefined);
  }, [onFindSimilarProp, dataProvider]);

  const [filterText, setFilterText] = React.useState("");
  const [isFavoritesFilterActive, setIsFavoritesFilterActive] = React.useState(false);

  const filteringDataProvider = useDisposable(React.useCallback(() => {
    const valueFilterer = new DisplayValuePropertyDataFilterer(filterText);
    const labelFilterer = new LabelPropertyDataFilterer(filterText);
    const favoriteFilterer = new FavoritePropertiesDataFilterer({ source: dataProvider, favoritesScope: FAVORITES_SCOPE, isActive: isFavoritesFilterActive });

    const textFilterer = new CompositePropertyDataFilterer(labelFilterer, CompositeFilterType.Or, valueFilterer);
    const favoriteTextFilterer = new CompositePropertyDataFilterer(textFilterer, CompositeFilterType.And, favoriteFilterer);
    const filteringDataProv = new FilteringPropertyDataProvider(dataProvider, favoriteTextFilterer);
    filteringDataProv.onDataChanged.addListener(() => {
      setFilteringProvDataChanged({});
    });
    return filteringDataProv;
  }, [dataProvider, filterText, isFavoritesFilterActive]));

  const { value: filteringResult } = useDebouncedAsyncValue(React.useCallback(async () => {
    const result = await filteringDataProvider.getData();
    return result;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteringDataProvider, filteringProvDataChanged]));

  const resultSelectorProps = React.useMemo(() => {
    return filteringResult?.matchesCount !== undefined ? {
      onSelectedChanged: (index: React.SetStateAction<number>) => setActiveMatchIndex(index),
      resultCount: filteringResult.matchesCount,
    } : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteringResult, filteringProvDataChanged]);

  React.useEffect(() => {
    if (filteringResult?.getMatchByIndex)
      setActiveMatch(filteringResult.getMatchByIndex(activeMatchIndex));
  }, [activeMatchIndex, filteringDataProvider, filteringResult]);

  const setFilter = React.useCallback((filter) => {
    if (filter !== filterText) {
      setFilterText(filter);
    }
  }, [filterText]);

  let content;
  if (isOverLimit) {
    content = (<FillCentered>{IModelApp.i18n.translate("Sample:property-grid.too-many-elements-selected")}</FillCentered>);
  } else {
    content = (<VirtualizedPropertyGridWithDataProvider
      dataProvider={filteringDataProvider}
      isPropertyHoverEnabled={true}
      onPropertyContextMenu={onPropertyContextMenu}
      actionButtonRenderers={[renderFavoritesActionButton, renderCopyActionButton]}
      orientation={Orientation.Horizontal}
      horizontalOrientationMinWidth={500}
      highlightedRecordProps={filterText && filterText.length !== 0 ?
        { searchText: filterText, activeMatch } :
        undefined
      }
    />);
  }

  return (
    <div className="PropertiesWidget">
      <h3>{IModelApp.i18n.translate("Sample:controls.properties.widget-label")}</h3>
      <div className="SearchBar" >
        <FilteringInput
          onFilterCancel={() => { setFilter(""); }}
          onFilterClear={() => { setFilter(""); }}
          onFilterStart={(newFilter) => { setFilter(newFilter); }}
          style={{ flex: "auto" }}
          resultSelectorProps={resultSelectorProps}
          status={filterText.length !== 0 ? FilteringInputStatus.FilteringFinished : FilteringInputStatus.ReadyToFilter}
        />
        <Toggle
          title="Favorites"
          onChange={(on) => setIsFavoritesFilterActive(on)}
        />
      </div>
      <div className="ContentContainer">
        {content}
      </div>
      {contextMenuArgs && <PropertiesWidgetContextMenu args={contextMenuArgs} dataProvider={dataProvider} onFindSimilar={onFindSimilar} onCloseContextMenu={onCloseContextMenu} />}
    </div>
  );
}

type ContextMenuItemInfo = ContextMenuItemProps & React.Attributes & { label: string };
interface PropertiesWidgetContextMenuProps {
  dataProvider: PresentationPropertyDataProvider;
  args: PropertyGridContextMenuArgs;
  onCloseContextMenu: () => void;
  onFindSimilar?: (property: PropertyRecord) => void;
}
function PropertiesWidgetContextMenu(props: PropertiesWidgetContextMenuProps) {
  const { dataProvider, args: { propertyRecord: property }, onFindSimilar: onFindSimilarProp, onCloseContextMenu } = props;
  const imodel = dataProvider.imodel;

  const onFindSimilar = React.useCallback(() => {
    if (onFindSimilarProp)
      onFindSimilarProp(property);
  }, [onFindSimilarProp, property]);

  const addFavorite = React.useCallback(async (propertyField: Field) => {
    await Presentation.favoriteProperties.add(propertyField, imodel, FAVORITES_SCOPE);
    onCloseContextMenu();
  }, [onCloseContextMenu, imodel]);

  const removeFavorite = React.useCallback(async (propertyField: Field) => {
    await Presentation.favoriteProperties.remove(propertyField, imodel, FAVORITES_SCOPE);
    onCloseContextMenu();
  }, [onCloseContextMenu, imodel]);

  const asyncItems = useDebouncedAsyncValue(React.useCallback(async () => {
    const field = await dataProvider.getFieldByPropertyRecord(property);
    const items: ContextMenuItemInfo[] = [];
    if (field !== undefined) {
      if (Presentation.favoriteProperties.has(field, imodel, FAVORITES_SCOPE)) {
        items.push({
          key: "remove-favorite",
          onSelect: async () => removeFavorite(field),
          title: IModelApp.i18n.translate("Sample:controls.properties.context-menu.remove-favorite.description"),
          label: IModelApp.i18n.translate("Sample:controls.properties.context-menu.remove-favorite.label"),
        });
      } else {
        items.push({
          key: "add-favorite",
          onSelect: async () => addFavorite(field),
          title: IModelApp.i18n.translate("Sample:controls.properties.context-menu.add-favorite.description"),
          label: IModelApp.i18n.translate("Sample:controls.properties.context-menu.add-favorite.label"),
        });
      }
    }
    if (onFindSimilarProp) {
      items.push({
        key: "find-similar",
        onSelect: onFindSimilar,
        title: IModelApp.i18n.translate("Sample:controls.properties.context-menu.find-similar.description"),
        label: IModelApp.i18n.translate("Sample:controls.properties.context-menu.find-similar.label"),
      });
    }
    return items;
  }, [imodel, dataProvider, property, addFavorite, removeFavorite, onFindSimilar, onFindSimilarProp]));

  if (!asyncItems.value || asyncItems.value.length === 0)
    return null;

  return (
    <GlobalContextMenu
      opened={true}
      onOutsideClick={onCloseContextMenu}
      onEsc={onCloseContextMenu}
      identifier="PropertiesWidget"
      x={props.args.event.clientX}
      y={props.args.event.clientY}
    >
      {asyncItems.value.map((item) =>
        <ContextMenuItem key={item.key} onSelect={item.onSelect} title={item.title}>
          {item.label}
        </ContextMenuItem>
      )}
    </GlobalContextMenu>
  );
}

function FavoritePropertyActionButton(props: ActionButtonRendererProps & { dataProvider: PresentationPropertyDataProvider }) {
  const { property, dataProvider } = props;
  const field = useAsyncValue(React.useMemo(async () => dataProvider.getFieldByPropertyRecord(property), [dataProvider, property]));
  return (
    <div>
      {
        (field && (Presentation.favoriteProperties.has(field, dataProvider.imodel, FAVORITES_SCOPE) || props.isPropertyHovered))
          ? <FavoriteFieldActionButton field={field} imodel={dataProvider.imodel} />
          : undefined
      }
    </div>
  );
}

function FavoriteFieldActionButton(props: { imodel: IModelConnection, field: Field }) {
  const { field, imodel } = props;
  const toggleFavoriteProperty = React.useCallback(async () => {
    if (Presentation.favoriteProperties.has(field, imodel, FAVORITES_SCOPE))
      await Presentation.favoriteProperties.remove(field, imodel, FAVORITES_SCOPE);
    else
      await Presentation.favoriteProperties.add(field, imodel, FAVORITES_SCOPE);
  }, [field, imodel]);
  return (
    <div className="favorite-action-button" onClick={toggleFavoriteProperty} onKeyDown={toggleFavoriteProperty} role="button" tabIndex={0}>
      {Presentation.favoriteProperties.has(field, imodel, FAVORITES_SCOPE) ?
        <div style={{ width: "20px", height: "20px", background: "orange" }} /> :
        <div style={{ width: "20px", height: "20px", background: "blue" }} />}
    </div>
  );
}

function CopyActionButton() {
  return (
    <div className="copy-action-button" style={{ height: "20px" }}>
      Copy
    </div>
  );
}

class AutoExpandingPropertyDataProvider extends PresentationPropertyDataProvider {
  public async getData(): Promise<PropertyData> {
    const result = await super.getData();
    this.expandCategories(result.categories);
    return result;
  }

  private expandCategories(categories: PropertyCategory[]) {
    categories.forEach((category: PropertyCategory) => {
      category.expand = true;
      if (category.childCategories)
        this.expandCategories(category.childCategories);
    });
  }
}

function createDataProvider(imodel: IModelConnection, rulesetId: string): PresentationPropertyDataProvider {
  const provider = new AutoExpandingPropertyDataProvider({ imodel, ruleset: rulesetId });
  provider.isNestedPropertyCategoryGroupingEnabled = true;
  return provider;
}
