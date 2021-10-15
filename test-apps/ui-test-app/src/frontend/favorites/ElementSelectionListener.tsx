/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import { KeySet } from "@itwin/presentation-common";
import { FavoritePropertiesDataProvider } from "@itwin/presentation-components";
import { ISelectionProvider, Presentation, SelectionChangeEventArgs } from "@itwin/presentation-frontend";
import { AbstractToolbarProps, CommonToolbarItem, RelativePosition, WidgetState } from "@itwin/appui-abstract";
import { FavoritePropertiesRenderer, FavoritePropertyList } from "@itwin/components-react";
import {
  ActionButtonItemDef, CommandItemDef, CoreTools, ElementTooltip,
  FrameworkUiAdmin, FrontstageManager, SelectionContextToolDefinitions, ToolbarHelper,
} from "@itwin/appui-react";
import { ViewsFrontstage } from "../appui/frontstages/ViewsFrontstage";
import { appendContent } from "./appendContent";

export class ElementSelectionListener {
  private _removeSelectionChangeListener?: () => void;
  private _favoritePropertiesDataProvider: FavoritePropertiesDataProvider;
  private _favoritePropertiesRenderer: FavoritePropertiesRenderer;

  public constructor(public displayCardWhenNoFavorites: boolean) {
    this._favoritePropertiesDataProvider = new FavoritePropertiesDataProvider();
    this._favoritePropertiesRenderer = new FavoritePropertiesRenderer();
  }

  public initialize() {
    this.cleanup();
    this._removeSelectionChangeListener = Presentation.selection.selectionChange.addListener(this._onSelectionChanged);
  }

  public cleanup(): void {
    this._removeSelectionChangeListener && this._removeSelectionChangeListener();
    this._removeSelectionChangeListener = undefined;
  }

  private _onSelectionChanged = async (evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider) => {
    const selection = selectionProvider.getSelection(evt.imodel, evt.level);
    if (selection.isEmpty) {
      this._closeCard();
    } else {
      /** _showCard demonstrates HTMLElement content. _showReactCard demonstrates React content. */
      await this._showReactCard(evt, selection);
    }
  };

  private async _showCard(evt: SelectionChangeEventArgs, selection: Readonly<KeySet>) {
    const contentContainer = document.createElement("div");
    const propertyData = await this._favoritePropertiesDataProvider.getData(evt.imodel, new KeySet(selection));
    const hasFavorites = this._favoritePropertiesRenderer.hasFavorites(propertyData);

    if (hasFavorites) {
      const favorites = this._favoritePropertiesRenderer.renderFavorites(propertyData);
      appendContent(contentContainer, favorites);
    } else if (!this.displayCardWhenNoFavorites) {
      return;
    }

    ElementTooltip.isTooltipHalted = true;

    IModelApp.uiAdmin.showCard(contentContainer, propertyData.label, this._toolbar(false),
      IModelApp.uiAdmin.cursorPosition, IModelApp.uiAdmin.createXAndY(8, 8),
      this._toolbarItemExecuted, this._toolbarCancel, RelativePosition.Right);
  }

  private async _showReactCard(evt: SelectionChangeEventArgs, selection: Readonly<KeySet>) {
    let content: React.ReactNode;
    const propertyData = await this._favoritePropertiesDataProvider.getData(evt.imodel, new KeySet(selection));
    const hasFavorites = this._favoritePropertiesRenderer.hasFavorites(propertyData);

    if (hasFavorites) {
      content = (
        <FavoritePropertyList propertyData={propertyData} />
      );
    } else if (!this.displayCardWhenNoFavorites) {
      return;
    }

    ElementTooltip.isTooltipHalted = true;

    (IModelApp.uiAdmin as FrameworkUiAdmin).showReactCard(content, propertyData.label, this._toolbar(false),
      IModelApp.uiAdmin.cursorPosition, IModelApp.uiAdmin.createXAndY(8, 8),
      this._toolbarItemExecuted, this._toolbarCancel, RelativePosition.Right);
  }

  private _toolbarItemExecuted = (_item: ActionButtonItemDef) => {
    this._closeCard();
  };

  private _toolbarCancel = () => {
    this._closeCard();
  };

  private _closeCard() {
    IModelApp.uiAdmin.hideCard();
    ElementTooltip.isTooltipHalted = false;
  }

  private _toolbar = (useCategoryAndModelsContextTools: boolean): AbstractToolbarProps => {
    const items: CommonToolbarItem[] = [];
    items.push(ToolbarHelper.createToolbarItemFromItemDef(0, this._openPropertyGridItemDef));
    if (useCategoryAndModelsContextTools) {
      items.push(
        ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.clearSelectionItemDef),
        ToolbarHelper.createToolbarItemFromItemDef(20, SelectionContextToolDefinitions.hideSectionToolGroup),
        ToolbarHelper.createToolbarItemFromItemDef(30, SelectionContextToolDefinitions.isolateSelectionToolGroup),
        ToolbarHelper.createToolbarItemFromItemDef(40, SelectionContextToolDefinitions.emphasizeElementsItemDef),
      );
    } else {
      items.push(
        ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.clearSelectionItemDef),
        ToolbarHelper.createToolbarItemFromItemDef(20, SelectionContextToolDefinitions.hideElementsItemDef),
        ToolbarHelper.createToolbarItemFromItemDef(30, SelectionContextToolDefinitions.isolateElementsItemDef),
        ToolbarHelper.createToolbarItemFromItemDef(40, SelectionContextToolDefinitions.emphasizeElementsItemDef),
      );
    }
    return {
      toolbarId: "example-toolbar",
      items,
    };
  };

  private get _openPropertyGridItemDef() {
    return new CommandItemDef({
      iconSpec: "icon-info-2",
      labelKey: "SampleApp:tools.OpenPropertyGrid.flyover",
      tooltipKey: "SampleApp:tools.OpenPropertyGrid.description",
      execute: () => {
        const widgetDef = FrontstageManager.findWidget(ViewsFrontstage.unifiedSelectionPropertyGridId);
        if (widgetDef)
          widgetDef.setWidgetState(WidgetState.Open);
      },
    });
  }

}
