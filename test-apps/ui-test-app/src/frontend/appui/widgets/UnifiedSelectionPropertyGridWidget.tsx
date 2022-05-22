/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import { Field } from "@itwin/presentation-common";
import {
  IPresentationPropertyDataProvider, PresentationPropertyDataProvider, usePropertyDataProviderWithUnifiedSelection,
} from "@itwin/presentation-components";
import { FavoritePropertiesScope, Presentation } from "@itwin/presentation-frontend";
import {
  ActionButtonRendererProps, PropertyGridContextMenuArgs, useAsyncValue, VirtualizedPropertyGridWithDataProvider,
  VirtualizedPropertyGridWithDataProviderProps,
} from "@itwin/components-react";
import {
  ContextMenuItem, ContextMenuItemProps, FillCentered, GlobalContextMenu, Icon, Orientation, ResizableContainerObserver,
} from "@itwin/core-react";
import { ConfigurableCreateInfo, ConfigurableUiManager, FrameworkVersionSwitch, WidgetControl } from "@itwin/appui-react";

export class UnifiedSelectionPropertyGridWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (options && options.iModelConnection)
      this.reactNode = <UnifiedSelectionPropertyGridWidget iModelConnection={options.iModelConnection} />;
  }
}

interface UnifiedSelectionPropertyGridWidgetProps {
  iModelConnection: IModelConnection;
}

export type ContextMenuItemInfo = ContextMenuItemProps & React.Attributes & { label: string };

export interface State {
  dataProvider: PresentationPropertyDataProvider;
  contextMenu?: PropertyGridContextMenuArgs;
  contextMenuItemInfos?: ContextMenuItemInfo[];
  gridSize?: { width: number, height: number };
}

class UnifiedSelectionPropertyGridWidget extends React.Component<UnifiedSelectionPropertyGridWidgetProps, State> {

  constructor(props: UnifiedSelectionPropertyGridWidgetProps) {
    super(props);
    this.state = {
      dataProvider: createDataProvider(this.props.iModelConnection),
    };
  }

  private _onAddFavorite = async (propertyField: Field) => {
    await Presentation.favoriteProperties.add(propertyField, this.props.iModelConnection, FavoritePropertiesScope.IModel);
    this.setState({ contextMenu: undefined });
  };
  private _onRemoveFavorite = async (propertyField: Field) => {
    await Presentation.favoriteProperties.remove(propertyField, this.props.iModelConnection, FavoritePropertiesScope.IModel);
    this.setState({ contextMenu: undefined });
  };

  private _onPropertyContextMenu = (args: PropertyGridContextMenuArgs) => {
    args.event.persist();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.buildContextMenu(args);
  };

  private _onContextMenuOutsideClick = () => {
    this.setState({ contextMenu: undefined });
  };

  private _onContextMenuEsc = () => {
    this.setState({ contextMenu: undefined });
  };

  private async buildContextMenu(args: PropertyGridContextMenuArgs) {
    const field = await this.state.dataProvider.getFieldByPropertyRecord(args.propertyRecord);
    const items: ContextMenuItemInfo[] = [];
    if (field !== undefined) {
      if (Presentation.favoriteProperties.has(field, this.props.iModelConnection, FavoritePropertiesScope.IModel)) {
        items.push({
          key: "remove-favorite",
          icon: "icon-remove-2",
          onSelect: async () => this._onRemoveFavorite(field),
          title: IModelApp.localization.getLocalizedString("SampleApp:properties.context-menu.remove-favorite.description"),
          label: IModelApp.localization.getLocalizedString("SampleApp:properties.context-menu.remove-favorite.label"),
        });
      } else {
        items.push({
          key: "add-favorite",
          icon: "icon-add",
          onSelect: async () => this._onAddFavorite(field),
          title: IModelApp.localization.getLocalizedString("SampleApp:properties.context-menu.add-favorite.description"),
          label: IModelApp.localization.getLocalizedString("SampleApp:properties.context-menu.add-favorite.label"),
        });
      }
    }

    this.setState({ contextMenu: args, contextMenuItemInfos: items.length > 0 ? items : undefined });
  }

  private renderContextMenu() {
    if (!this.state.contextMenu || !this.state.contextMenuItemInfos)
      return undefined;

    const items: React.ReactNode[] = [];
    this.state.contextMenuItemInfos.forEach((info: ContextMenuItemInfo) => (
      items.push(
        <ContextMenuItem
          key={info.key}
          onSelect={info.onSelect}
          title={info.title}
          icon={info.icon}
        >
          {info.label}
        </ContextMenuItem>,
      )
    ));

    return (
      <GlobalContextMenu
        opened={true}
        onOutsideClick={this._onContextMenuOutsideClick}
        onEsc={this._onContextMenuEsc}
        identifier="PropertiesWidget"
        x={this.state.contextMenu.event.clientX}
        y={this.state.contextMenu.event.clientY}
      >
        {items}
      </GlobalContextMenu>
    );
  }

  private _favoriteActionButtonRenderer = (props: ActionButtonRendererProps) => {
    const { dataProvider } = this.state;
    const { property } = props;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const field = useAsyncValue(React.useMemo(async () => dataProvider.getFieldByPropertyRecord(property), [dataProvider, property]));

    return (
      <div>
        {
          field &&
          (Presentation.favoriteProperties.has(field, this.props.iModelConnection, FavoritePropertiesScope.IModel) || props.isPropertyHovered) &&
          <FavoriteActionButton
            field={field}
            imodel={this.props.iModelConnection} />
        }
      </div>
    );
  };

  private _onPropertyGridResize = (width: number, height: number) => {
    this.setState({ gridSize: { width, height } });
  };

  public override render() {
    const actionButtonRenderers = [this._favoriteActionButtonRenderer];
    if (this.props.iModelConnection) {
      const element = (this.state.gridSize?.width && this.state.gridSize.height) ? <>
        <UnifiedSelectionPropertyGrid
          dataProvider={this.state.dataProvider}
          orientation={Orientation.Horizontal}
          width={this.state.gridSize.width}
          height={this.state.gridSize.height}
          isPropertyHoverEnabled={true}
          onPropertyContextMenu={this._onPropertyContextMenu}
          actionButtonRenderers={actionButtonRenderers}
        />
        {this.renderContextMenu()}
      </> : null;
      return (
        <>
          <FrameworkVersionSwitch
            v1={<div style={{ height: "100%" }}>{element}</div>}
            v2={<div style={{ height: "100%", width: "100%", position: "absolute" }}>{element}</div>}
          />
          <ResizableContainerObserver onResize={this._onPropertyGridResize} />
        </>
      );
    }

    return null;
  }
}

function UnifiedSelectionPropertyGrid(props: VirtualizedPropertyGridWithDataProviderProps & { dataProvider: IPresentationPropertyDataProvider }) {
  const { isOverLimit } = usePropertyDataProviderWithUnifiedSelection({ dataProvider: props.dataProvider });

  if (isOverLimit) {
    return (<FillCentered>{IModelApp.localization.getLocalizedString("SampleApp:property-grid.too-many-elements-selected")}</FillCentered>);
  }
  return <VirtualizedPropertyGridWithDataProvider {...props} />;
}

function createDataProvider(imodel: IModelConnection): PresentationPropertyDataProvider {
  const provider = new PresentationPropertyDataProvider({ imodel });
  provider.isNestedPropertyCategoryGroupingEnabled = true;
  return provider;
}

ConfigurableUiManager.registerControl("UnifiedSelectionPropertyGridDemoWidget", UnifiedSelectionPropertyGridWidgetControl);

interface FavoriteActionButtonProps {
  field: Field;
  imodel: IModelConnection;
}

class FavoriteActionButton extends React.Component<FavoriteActionButtonProps> {

  private _isMounted = false;

  public override componentDidMount() {
    this._isMounted = true;
  }

  public override componentWillUnmount() {
    this._isMounted = false;
  }

  public override render() {
    return (
      <div onClick={this._onActionButtonClicked}>
        {this.isFavorite() ?
          <Icon iconSpec="icon-star" /> :
          <Icon iconSpec="icon-star" />}
      </div>
    );
  }

  private _onActionButtonClicked = () => {
    this.toggleFavoriteProperty(); // eslint-disable-line @typescript-eslint/no-floating-promises
  };

  private async toggleFavoriteProperty() {
    if (this.isFavorite())
      await Presentation.favoriteProperties.remove(this.props.field, this.props.imodel, FavoritePropertiesScope.IModel);
    else
      await Presentation.favoriteProperties.add(this.props.field, this.props.imodel, FavoritePropertiesScope.IModel);
    if (this._isMounted)
      this.setState({ isFavorite: this.isFavorite() });
  }

  private isFavorite(): boolean {
    return Presentation.favoriteProperties.has(this.props.field, this.props.imodel, FavoritePropertiesScope.IModel);
  }
}
