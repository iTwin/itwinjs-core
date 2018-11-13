/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import * as React from "react";
import { DisposeFunc } from "@bentley/bentleyjs-core";
import { Orientation } from "@bentley/ui-core";
import { PropertyRecord } from "../../properties";
import { PropertyDataProvider, PropertyCategory, PropertyData } from "../PropertyDataProvider";
import { SelectablePropertyBlock } from "./SelectablePropertyBlock";
import "./PropertyGrid.scss";
import { PropertyValueRendererManager } from "../../properties/ValueRendererManager";
import { PropertyUpdatedArgs } from "../../editors/EditorContainer";

/** Properties for [[PropertyGrid]] React component */
export interface PropertyGridProps {
  /** Property data provider */
  dataProvider: PropertyDataProvider;
  /** Grid orientation */
  orientation: Orientation;
  /** Enables/disables property selection */
  isPropertySelectionEnabled?: boolean;
  /** Enables/disables property editing */
  isPropertyEditingEnabled?: boolean;
  /** Callback to property selection */
  onPropertySelectionChanged?: (property: PropertyRecord) => void;
  /** Custom property value renderer manager */
  propertyValueRendererManager?: PropertyValueRendererManager;
  /** Callback for when properties are being edited */
  onPropertyEditing?: (args: PropertyEditingArgs, category: PropertyCategory) => void;
  /** Callback for when properties are updated */
  onPropertyUpdated?: (args: PropertyUpdatedArgs, category: PropertyCategory) => Promise<boolean>;
}

/** Property Editor state */
export interface PropertyEditorState {
  active: boolean;
  propertyRecord?: PropertyRecord;
}

/** Arguments for the Property Editing event callback */
export interface PropertyEditingArgs {
  /** PropertyRecord being edited  */
  propertyRecord: PropertyRecord;
  /** Unique key of currently edited property */
  propertyKey?: string;
}

/** Property Category in the [[PropertyGrid]] state */
export interface PropertyGridCategory {
  propertyCategory: PropertyCategory;
  propertyCount: number;
  properties: PropertyRecord[];
}

/** State of [[PropertyGrid]] React component */
export interface PropertyGridState {
  /** List of PropertyGrid categories */
  categories: PropertyGridCategory[];
  /** Unique key of currently selected property */
  selectedPropertyKey?: string;
  /** Unique key of currently edited property */
  editingPropertyKey?: string;
}

/** PropertyGrid React component.
 */
export class PropertyGrid extends React.Component<PropertyGridProps, PropertyGridState> {

  private _dataChangesListenerDisposeFunc?: DisposeFunc;
  private _isMounted = false;

  public readonly state: Readonly<PropertyGridState> = {
    categories: [],
    selectedPropertyKey: undefined,
    editingPropertyKey: undefined,
  };

  constructor(props: PropertyGridProps) {
    super(props);
    this._dataChangesListenerDisposeFunc = this.props.dataProvider.onDataChanged.addListener(this._onPropertyDataChanged);
  }

  public componentDidMount() {
    this._isMounted = true;
    this.gatherData(this.props.dataProvider);
  }

  public componentWillUnmount() {
    if (this._dataChangesListenerDisposeFunc) {
      this._dataChangesListenerDisposeFunc();
      this._dataChangesListenerDisposeFunc = undefined;
    }
    this._isMounted = false;
  }

  public componentDidUpdate() {
    if (this._dataChangesListenerDisposeFunc)
      this._dataChangesListenerDisposeFunc();
    this._dataChangesListenerDisposeFunc = this.props.dataProvider.onDataChanged.addListener(this._onPropertyDataChanged);
  }

  private _onPropertyDataChanged = () => {
    this.gatherData(this.props.dataProvider);
  }

  private _shouldExpandCategory = (category: PropertyCategory): boolean => {
    if (category.expand)
      return true;
    return this.state.categories.some((stateCategory: PropertyGridCategory) => {
      return stateCategory.propertyCategory.name === category.name && stateCategory.propertyCategory.expand;
    });
  }

  private async gatherData(dataProvider: PropertyDataProvider) {
    const propertyData: PropertyData = await dataProvider.getData();
    if (!this._isMounted)
      return;

    const categories = new Array<PropertyGridCategory>();
    propertyData.categories.map((category: PropertyCategory, _index: number) => {
      const gridCategory: PropertyGridCategory = {
        propertyCategory: { ...category, expand: this._shouldExpandCategory(category) },
        propertyCount: propertyData.records[category.name].length,
        properties: propertyData.records[category.name],
      };
      categories.push(gridCategory);
    });
    this.setState({ categories });
  }

  private _onExpansionToggled = (categoryName: string) => {
    const index = this.state.categories.findIndex((c) => c.propertyCategory.name === categoryName);
    if (-1 === index)
      return;

    const categories = [...this.state.categories];

    const newCategory = {
      ...categories[index],
      propertyCategory: {
        ...categories[index].propertyCategory,
        expand: !categories[index].propertyCategory.expand,
      },
    };

    categories[index] = newCategory;
    this.setState({ categories });
  }

  private _isClickSupported(): boolean {
    return (!this.props.isPropertySelectionEnabled && !this.props.isPropertyEditingEnabled) ? false : true;
  }

  private _onPropertyClicked = (property: PropertyRecord, key?: string) => {
    if (!this._isClickSupported())
      return;

    let selectedPropertyKey = this.state.selectedPropertyKey;
    let editingPropertyKey = this.state.editingPropertyKey;

    if (this.props.isPropertyEditingEnabled) {
      if (this.props.isPropertySelectionEnabled) {
        if (this.state.selectedPropertyKey === key)
          editingPropertyKey = key;
        else
          editingPropertyKey = undefined;
      } else {
        editingPropertyKey = key;
      }
    }

    if (this.props.isPropertySelectionEnabled && editingPropertyKey !== key) {
      if (this.state.selectedPropertyKey === key) {
        // Deselect
        selectedPropertyKey = undefined;
      } else {
        // Select another one
        selectedPropertyKey = key;
      }

      if (this.props.onPropertySelectionChanged)
        this.props.onPropertySelectionChanged(property);
    }

    this.setState({ selectedPropertyKey, editingPropertyKey });
  }

  private _onEditCommit = async (args: PropertyUpdatedArgs, category: PropertyCategory) => {
    if (this.props.onPropertyUpdated) {
      await this.props.onPropertyUpdated(args, category);
      this.setState({ editingPropertyKey: undefined });
    }
  }

  private _onEditCancel = () => {
    this.setState({ editingPropertyKey: undefined });
  }

  public render() {
    return (
      <div className="components-property-grid-wrapper">
        <div className="components-property-grid">
          {
            this.state.categories.map((gridCategory: PropertyGridCategory) => (
              <SelectablePropertyBlock
                key={gridCategory.propertyCategory.name}
                category={gridCategory.propertyCategory}
                properties={gridCategory.properties}
                orientation={this.props.orientation}
                selectedPropertyKey={this.state.selectedPropertyKey}
                onExpansionToggled={this._onExpansionToggled}
                onPropertyClicked={this._isClickSupported() ? this._onPropertyClicked : undefined}
                propertyValueRendererManager={this.props.propertyValueRendererManager}
                editingPropertyKey={this.state.editingPropertyKey}
                onEditCommit={this._onEditCommit}
                onEditCancel={this._onEditCancel}
              />
            ))
          }
        </div>
      </div>
    );
  }
}
