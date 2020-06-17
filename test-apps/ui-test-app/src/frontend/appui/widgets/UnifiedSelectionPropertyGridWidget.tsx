/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { Field } from "@bentley/presentation-common";
import { PresentationPropertyDataProvider, propertyGridWithUnifiedSelection } from "@bentley/presentation-components";
import { FavoritePropertiesScope, Presentation } from "@bentley/presentation-frontend";
import { ActionButtonRendererProps, PropertyGrid, PropertyGridContextMenuArgs, useAsyncValue } from "@bentley/ui-components";
import { ContextMenuItem, ContextMenuItemProps, GlobalContextMenu, Icon, Orientation } from "@bentley/ui-core";
import { ConfigurableCreateInfo, ConfigurableUiManager, WidgetControl } from "@bentley/ui-framework";

// create a HOC property grid component that supports unified selection
// tslint:disable-next-line:variable-name
const UnifiedSelectionPropertyGrid = propertyGridWithUnifiedSelection(PropertyGrid);

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
  }
  private _onRemoveFavorite = async (propertyField: Field) => {
    await Presentation.favoriteProperties.remove(propertyField, this.props.iModelConnection, FavoritePropertiesScope.IModel);
    this.setState({ contextMenu: undefined });
  }

  private _onPropertyContextMenu = (args: PropertyGridContextMenuArgs) => {
    args.event.persist();
    // tslint:disable-next-line: no-floating-promises
    this.buildContextMenu(args);
  }

  private _onContextMenuOutsideClick = () => {
    this.setState({ contextMenu: undefined });
  }

  private _onContextMenuEsc = () => {
    this.setState({ contextMenu: undefined });
  }

  private async buildContextMenu(args: PropertyGridContextMenuArgs) {
    const field = await this.state.dataProvider.getFieldByPropertyRecord(args.propertyRecord);
    const items: ContextMenuItemInfo[] = [];
    if (field !== undefined) {
      if (Presentation.favoriteProperties.has(field, this.props.iModelConnection, FavoritePropertiesScope.IModel)) {
        items.push({
          key: "remove-favorite",
          icon: "icon-remove-2",
          onSelect: () => this._onRemoveFavorite(field),
          title: IModelApp.i18n.translate("SampleApp:properties.context-menu.remove-favorite.description"),
          label: IModelApp.i18n.translate("SampleApp:properties.context-menu.remove-favorite.label"),
        });
      } else {
        items.push({
          key: "add-favorite",
          icon: "icon-add",
          onSelect: () => this._onAddFavorite(field),
          title: IModelApp.i18n.translate("SampleApp:properties.context-menu.add-favorite.description"),
          label: IModelApp.i18n.translate("SampleApp:properties.context-menu.add-favorite.label"),
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
    const field = useAsyncValue(React.useMemo(() => dataProvider.getFieldByPropertyRecord(property), [dataProvider, property]));

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
  }

  public render() {
    const actionButtonRenderers = [this._favoriteActionButtonRenderer];
    if (this.props.iModelConnection)
      return (
        <div style={{ height: "100%" }}>
          <UnifiedSelectionPropertyGrid
            dataProvider={this.state.dataProvider}
            orientation={Orientation.Horizontal}
            isPropertyHoverEnabled={true}
            onPropertyContextMenu={this._onPropertyContextMenu}
            actionButtonRenderers={actionButtonRenderers}
          />
          {this.renderContextMenu()}
        </div>
      );

    return null;
  }
}

function createDataProvider(imodel: IModelConnection): PresentationPropertyDataProvider {
  return new PresentationPropertyDataProvider({ imodel });
}

ConfigurableUiManager.registerControl("UnifiedSelectionPropertyGridDemoWidget", UnifiedSelectionPropertyGridWidgetControl);

interface FavoriteActionButtonProps {
  field: Field;
  imodel: IModelConnection;
}

class FavoriteActionButton extends React.Component<FavoriteActionButtonProps> {

  private _isMounted = false;

  public componentDidMount() {
    this._isMounted = true;
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  public render() {
    return (
      <div onClick={this._onActionButtonClicked}>
        {this.isFavorite() ?
          <Icon iconSpec="icon-star" /> :
          <Icon iconSpec="icon-star" />}
      </div>
    );
  }

  private _onActionButtonClicked = () => {
    this.toggleFavoriteProperty(); // tslint:disable-line: no-floating-promises
  }

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
