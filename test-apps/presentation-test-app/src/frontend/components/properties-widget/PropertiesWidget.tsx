/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { IModelApp, IModelConnection, PropertyRecord } from "@bentley/imodeljs-frontend";
import {
  PresentationPropertyDataProvider, propertyGridWithUnifiedSelection,
  IPresentationPropertyDataProvider,
} from "@bentley/presentation-components";
import { Field } from "@bentley/presentation-common";
import { GlobalContextMenu, ContextMenuItem, ContextMenuItemProps } from "@bentley/ui-core";
import { PropertyGrid, PropertyData, PropertyCategory, PropertyGridContextMenuArgs } from "@bentley/ui-components";
import { Presentation } from "@bentley/presentation-frontend";
import "./PropertiesWidget.css";

// tslint:disable-next-line:variable-name naming-convention
const SamplePropertyGrid = propertyGridWithUnifiedSelection(PropertyGrid);

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
  onFindSimilar?: (propertiesProvider: IPresentationPropertyDataProvider, record: PropertyRecord) => void;
}

type ContextMenuItemInfo = ContextMenuItemProps & React.Attributes & { label: string };

export interface State {
  dataProvider: PresentationPropertyDataProvider;
  contextMenu?: PropertyGridContextMenuArgs;
  contextMenuItemInfos?: ContextMenuItemInfo[];
}
export default class PropertiesWidget extends React.Component<Props, State> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = {
      dataProvider: createDataProvider(this.props.imodel, this.props.rulesetId),
    };
  }
  public static getDerivedStateFromProps(props: Props, state: State) {
    if (props.imodel !== state.dataProvider.imodel || props.rulesetId !== state.dataProvider.rulesetId)
      return { ...state, dataProvider: createDataProvider(props.imodel, props.rulesetId) };
    return null;
  }
  private _onFindSimilar = (property: PropertyRecord) => {
    if (this.props.onFindSimilar)
      this.props.onFindSimilar(this.state.dataProvider, property);
    this.setState({ contextMenu: undefined });
  }
  private _onAddFavorite = async (propertyField: Field) => {
    await Presentation.favoriteProperties.add(propertyField);
    this.setState({ contextMenu: undefined });
  }
  private _onRemoveFavorite = async (propertyField: Field) => {
    await Presentation.favoriteProperties.remove(propertyField);
    this.setState({ contextMenu: undefined });
  }
  private _onPropertyContextMenu = (args: PropertyGridContextMenuArgs) => {
    args.event.persist();
    this.setState({ contextMenu: args });
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
      if (Presentation.favoriteProperties.has(field)) {
        items.push({
          key: "remove-favorite",
          onSelect: () => this._onRemoveFavorite(field),
          title: IModelApp.i18n.translate("Sample:controls.properties.context-menu.remove-favorite.description"),
          label: IModelApp.i18n.translate("Sample:controls.properties.context-menu.remove-favorite.label"),
        });
      } else {
        items.push({
          key: "add-favorite",
          onSelect: () => this._onAddFavorite(field),
          title: IModelApp.i18n.translate("Sample:controls.properties.context-menu.add-favorite.description"),
          label: IModelApp.i18n.translate("Sample:controls.properties.context-menu.add-favorite.label"),
        });
      }
    }

    if (this.props.onFindSimilar) {
      items.push({
        key: "find-similar",
        onSelect: () => this._onFindSimilar(args.propertyRecord),
        title: IModelApp.i18n.translate("Sample:controls.properties.context-menu.find-similar.description"),
        label: IModelApp.i18n.translate("Sample:controls.properties.context-menu.find-similar.label"),
      });
    }
    this.setState({ contextMenuItemInfos: items.length > 0 ? items : undefined });
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
        x={this.state.contextMenu!.event.clientX}
        y={this.state.contextMenu!.event.clientY}
      >
        {items}
      </GlobalContextMenu>
    );
  }

  public render() {
    return (
      <div className="PropertiesWidget">
        <h3>{IModelApp.i18n.translate("Sample:controls.properties.widget-label")}</h3>
        <div className="ContentContainer">
          <SamplePropertyGrid
            dataProvider={this.state.dataProvider}
            isPropertyHoverEnabled={true}
            onPropertyContextMenu={this._onPropertyContextMenu}
          />
        </div>
        {this.renderContextMenu()}
      </div>
    );
  }
}

class AutoExpandingPropertyDataProvider extends PresentationPropertyDataProvider {
  public async getData(): Promise<PropertyData> {
    const result = await super.getData();
    result.categories.forEach((category: PropertyCategory) => {
      category.expand = true;
    });
    return result;
  }
}

function createDataProvider(imodel: IModelConnection, rulesetId: string): PresentationPropertyDataProvider {
  return new AutoExpandingPropertyDataProvider(imodel, rulesetId);
}
