/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { IModelConnection } from "@itwin/core-frontend";
import { Field } from "@itwin/presentation-common";
import {
  IPresentationPropertyDataProvider, PresentationPropertyDataProvider, usePropertyDataProviderWithUnifiedSelection,
} from "@itwin/presentation-components";
import { FavoritePropertiesScope, Presentation } from "@itwin/presentation-frontend";
import {
  ActionButtonRendererProps, PropertyGridContextMenuArgs, useAsyncValue, VirtualizedPropertyGridWithDataProvider,
  VirtualizedPropertyGridWithDataProviderProps,
} from "@itwin/components-react";
import { ContextMenuItem, ContextMenuItemProps, FillCentered, GlobalContextMenu, Icon, Orientation, ResizableContainerObserver } from "@itwin/core-react";
import { ConfigurableCreateInfo, useActiveIModelConnection, useFrameworkVersion, WidgetControl } from "@itwin/appui-react";
import { UiItemsProvidersTest } from "../../ui-items-providers-test";

export type ContextMenuItemInfo = ContextMenuItemProps & React.Attributes & { label: string };

// eslint-disable-next-line @typescript-eslint/naming-convention
function FavoriteActionButton({ field, imodel }: { field: Field, imodel: IModelConnection }) {
  const isMountedRef = React.useRef(false);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const getIsFavoriteField = React.useCallback(() => {
    return Presentation.favoriteProperties.has(field, imodel, FavoritePropertiesScope.IModel);
  }, [field, imodel]);

  const [isFavorite, setIsFavorite] = React.useState(false);

  const toggleFavoriteProperty = React.useCallback(async () => {
    if (getIsFavoriteField()) {
      await Presentation.favoriteProperties.remove(field, imodel, FavoritePropertiesScope.IModel);
      isMountedRef.current && setIsFavorite(false);
    } else {
      await Presentation.favoriteProperties.add(field, imodel, FavoritePropertiesScope.IModel);
      isMountedRef.current && setIsFavorite(true);
    }
  }, [field, getIsFavoriteField, imodel]);

  const onActionButtonClicked = React.useCallback(async () => {
    void toggleFavoriteProperty();
  }, [toggleFavoriteProperty]);

  return (
    <div onClick={onActionButtonClicked}>
      {isFavorite ?
        <Icon iconSpec="icon-star" /> :
        <Icon iconSpec="icon-star" />}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function PresentationPropertyGrid(props: VirtualizedPropertyGridWithDataProviderProps & { dataProvider: IPresentationPropertyDataProvider }) {
  const { isOverLimit } = usePropertyDataProviderWithUnifiedSelection({ dataProvider: props.dataProvider });
  if (isOverLimit) {
    return (<FillCentered>{UiItemsProvidersTest.translate("properties.too-many-elements-selected")}</FillCentered>);
  }
  return <VirtualizedPropertyGridWithDataProvider {...props} />;
}

function createDataProvider(imodel: IModelConnection | undefined): PresentationPropertyDataProvider | undefined {
  if (imodel) {
    const provider = new PresentationPropertyDataProvider({ imodel });
    provider.isNestedPropertyCategoryGroupingEnabled = true;
    return provider;
  }
  return undefined;
}

function useDataProvider(iModelConnection: IModelConnection | undefined): PresentationPropertyDataProvider | undefined {
  const [dataProvider, setDataProvider] = React.useState(createDataProvider(iModelConnection));
  React.useEffect(() => {
    setDataProvider(createDataProvider(iModelConnection));
  }, [iModelConnection]);

  return dataProvider;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function PresentationPropertyGridWidget() {
  const iModelConnection = useActiveIModelConnection();
  const dataProvider = useDataProvider(iModelConnection);

  const [contextMenu, setContextMenu] = React.useState<PropertyGridContextMenuArgs | undefined>(undefined);
  const [contextMenuItemInfos, setContextMenuItemInfos] = React.useState<ContextMenuItemInfo[] | undefined>(undefined);

  const version = useFrameworkVersion();
  const componentId = ("2" === version) ? "uifw-v2-container" : "uifw-v1-container";
  const style: React.CSSProperties = ("2" === version) ? { height: "100%", width: "100%", position: "absolute" } : { height: "100%" };

  const onAddFavorite = React.useCallback(async (propertyField: Field) => {
    if (iModelConnection)
      await Presentation.favoriteProperties.add(propertyField, iModelConnection, FavoritePropertiesScope.IModel);
    setContextMenu(undefined);
  }, [iModelConnection]);

  const onRemoveFavorite = React.useCallback(async (propertyField: Field) => {
    if (iModelConnection)
      await Presentation.favoriteProperties.remove(propertyField, iModelConnection, FavoritePropertiesScope.IModel);
    setContextMenu(undefined);
  }, [iModelConnection]);

  const setupContextMenu = React.useCallback((args: PropertyGridContextMenuArgs) => {
    if (iModelConnection && dataProvider) {
      void dataProvider.getFieldByPropertyRecord(args.propertyRecord)
        .then((field) => {
          const items: ContextMenuItemInfo[] = [];
          if (field !== undefined) {
            if (Presentation.favoriteProperties.has(field, iModelConnection, FavoritePropertiesScope.IModel)) {
              items.push({
                key: "remove-favorite",
                icon: "icon-remove-2",
                onSelect: async () => onRemoveFavorite(field),
                title: UiItemsProvidersTest.translate("properties.context-menu.remove-favorite.description"),
                label: UiItemsProvidersTest.translate("properties.context-menu.remove-favorite.label"),
              });
            } else {
              items.push({
                key: "add-favorite",
                icon: "icon-add",
                onSelect: async () => onAddFavorite(field),
                title: UiItemsProvidersTest.translate("properties.context-menu.add-favorite.description"),
                label: UiItemsProvidersTest.translate("properties.context-menu.add-favorite.label"),
              });
            }
          }
          setContextMenu(args);
          setContextMenuItemInfos(items.length > 0 ? items : undefined);
        });
    }
  }, [iModelConnection, dataProvider, onRemoveFavorite, onAddFavorite]);

  const onPropertyContextMenu = React.useCallback((args: PropertyGridContextMenuArgs) => {
    args.event.persist();
    setupContextMenu(args);
  }, [setupContextMenu]);

  const onContextMenuOutsideClick = React.useCallback(() => {
    setContextMenu(undefined);
  }, []);

  const onContextMenuEsc = React.useCallback(() => {
    setContextMenu(undefined);
  }, []);

  const favoriteActionButtonRenderer = React.useCallback((props: ActionButtonRendererProps) => {
    if (iModelConnection && dataProvider) {
      const { property } = props;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const field = useAsyncValue(React.useMemo(async () => dataProvider.getFieldByPropertyRecord(property), [property]));

      return (
        <div>
          {
            field &&
            (Presentation.favoriteProperties.has(field, iModelConnection, FavoritePropertiesScope.IModel) || props.isPropertyHovered) &&
            <FavoriteActionButton
              field={field}
              imodel={iModelConnection} />
          }
        </div>
      );
    }
    return null;
  }, [dataProvider, iModelConnection]);

  const [gridSize, setGridSize] = React.useState<{ width: number, height: number }>();
  const onGridResize = React.useCallback((width, height) => setGridSize({ width, height }), []);

  return (
    <div data-component-id={componentId} style={style}>
      {dataProvider && gridSize?.width && gridSize.height &&
        <>
          <PresentationPropertyGrid
            dataProvider={dataProvider}
            orientation={Orientation.Horizontal}
            width={gridSize.width}
            height={gridSize.height}
            isPropertyHoverEnabled={true}
            onPropertyContextMenu={onPropertyContextMenu}
            actionButtonRenderers={[favoriteActionButtonRenderer]}
          />

          {contextMenu && contextMenuItemInfos &&
            <GlobalContextMenu
              opened={true}
              onOutsideClick={onContextMenuOutsideClick}
              onEsc={onContextMenuEsc}
              identifier="TableWidget"
              x={contextMenu.event.clientX}
              y={contextMenu.event.clientY}
            >
              {contextMenuItemInfos.map((info: ContextMenuItemInfo) =>
                <ContextMenuItem
                  key={info.key}
                  onSelect={info.onSelect}
                  title={info.title}
                  icon={info.icon}
                >
                  {info.label}
                </ContextMenuItem>
              )}
            </GlobalContextMenu>
          }
        </>
      }
      <ResizableContainerObserver onResize={onGridResize} />
    </div>
  );
}

/** PresentationPropertyGridWidgetControl provides a widget that shows properties returned from Presentation System
 * based of the active element selection. To use in a frontstage use the following in the frontstageDef.
 * ``` tsx
 *  <Widget id={PresentationPropertyGridWidgetControl.id} label={PresentationPropertyGridWidgetControl.label} control={PresentationPropertyGridWidgetControl}
 *    iconSpec={PresentationPropertyGridWidgetControl.iconSpec} />,
 * ```
 */
export class PresentationPropertyGridWidgetControl extends WidgetControl {
  public static id = "uiItemsProvidersTest:PresentationPropertyGridWidget";
  public static iconSpec = "icon-info";
  public static get label(): string {
    return UiItemsProvidersTest.translate("properties.widget-label");
  }

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <PresentationPropertyGridWidget />;
  }
}
