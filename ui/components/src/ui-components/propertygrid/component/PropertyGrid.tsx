/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import * as React from "react";
import ResizeObserver from "resize-observer-polyfill";
import { DisposeFunc } from "@bentley/bentleyjs-core";
import { Orientation, Spinner, SpinnerSize } from "@bentley/ui-core";
import { PropertyRecord, PropertyValueFormat } from "@bentley/imodeljs-frontend";
import { IPropertyDataProvider, PropertyCategory, PropertyData } from "../PropertyDataProvider";
import { SelectablePropertyBlock } from "./SelectablePropertyBlock";
import { PropertyValueRendererManager } from "../../properties/ValueRendererManager";
import { PropertyUpdatedArgs } from "../../editors/EditorContainer";

import "./PropertyGrid.scss";

/** Properties for [[PropertyGrid]] React component */
export interface PropertyGridProps {
  /** Property data provider */
  dataProvider: IPropertyDataProvider;

  /** Grid orientation. When not defined, it is chosen automatically based on width of the grid. */
  orientation?: Orientation;

  /** Enables/disables property hovering effect */
  isPropertyHoverEnabled?: boolean;

  /** Called to show a context menu when properties are right-clicked */
  onPropertyContextMenu?: (args: PropertyGridContextMenuArgs) => void;

  /** Enables/disables property selection */
  isPropertySelectionEnabled?: boolean;
  /** Callback to property selection */
  onPropertySelectionChanged?: (property: PropertyRecord) => void;

  /** Enables/disables property editing */
  isPropertyEditingEnabled?: boolean;
  /** Callback for when properties are being edited */
  onPropertyEditing?: (args: PropertyEditingArgs, category: PropertyCategory) => void;
  /** Callback for when properties are updated */
  onPropertyUpdated?: (args: PropertyUpdatedArgs, category: PropertyCategory) => Promise<boolean>;

  /** Custom property value renderer manager */
  propertyValueRendererManager?: PropertyValueRendererManager;
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

/** Arguments for `PropertyGridProps.onPropertyContextMenu` callback */
export interface PropertyGridContextMenuArgs {
  /** PropertyRecord being edited  */
  propertyRecord: PropertyRecord;
  /** An event which caused the context menu callback */
  event: React.MouseEvent;
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
  /** Actual orientation used by the property grid */
  orientation: Orientation;
  /** Is property grid currently loading data */
  isLoading?: boolean;
}

/** PropertyGrid React component.
 */
export class PropertyGrid extends React.Component<PropertyGridProps, PropertyGridState> {
  private _dataChangesListenerDisposeFunc?: DisposeFunc;
  private _isMounted = false;
  private _isInDataRequest = false;
  private _hasPendingDataRequest = false;
  private _gridRef = React.createRef<HTMLDivElement>();
  private _gridResizeSensor: ResizeObserver;

  public readonly state: Readonly<PropertyGridState> = {
    categories: [],
    orientation: this.props.orientation ? this.props.orientation : Orientation.Horizontal,
  };

  constructor(props: PropertyGridProps) {
    super(props);
    this._gridResizeSensor = new ResizeObserver(this._onGridResize);
  }

  public componentDidMount() {
    this._isMounted = true;
    this._dataChangesListenerDisposeFunc = this.props.dataProvider.onDataChanged.addListener(this._onPropertyDataChanged);

    // tslint:disable-next-line:no-floating-promises
    this.gatherData();

    this.updateOrientation(this.state.orientation, this.props.orientation);

    if (this._gridRef.current) {
      this._gridResizeSensor.observe(this._gridRef.current);
    }
  }

  public componentWillUnmount() {
    if (this._dataChangesListenerDisposeFunc) {
      this._dataChangesListenerDisposeFunc();
      this._dataChangesListenerDisposeFunc = undefined;
    }
    this._gridResizeSensor.disconnect();
    this._isMounted = false;
  }

  public componentDidUpdate(prevProps: PropertyGridProps) {
    if (this.props.dataProvider !== prevProps.dataProvider) {
      if (this._dataChangesListenerDisposeFunc)
        this._dataChangesListenerDisposeFunc();
      this._dataChangesListenerDisposeFunc = this.props.dataProvider.onDataChanged.addListener(this._onPropertyDataChanged);
    }

    this.updateOrientation(this.state.orientation, this.props.orientation);
  }

  private _onGridResize = () => {
    this.updateOrientation(this.state.orientation, this.props.orientation);
  }

  private updateOrientation(currentOrientation: Orientation, propOrientation?: Orientation) {
    if (propOrientation !== undefined) {
      if (propOrientation !== currentOrientation)
        this.setState({ orientation: propOrientation });
      return;
    }

    let newOrientation = Orientation.Horizontal;
    if (this._gridRef.current && this._gridRef.current.getBoundingClientRect().width <= 300)
      newOrientation = Orientation.Vertical;

    if (currentOrientation !== newOrientation)
      this.setState({ orientation: newOrientation });
  }

  private _onPropertyDataChanged = () => {
    // tslint:disable-next-line:no-floating-promises
    this.gatherData();
  }

  private _shouldExpandCategory = (category: PropertyCategory): boolean => {
    if (category.expand)
      return true;
    return this.state.categories.some((stateCategory: PropertyGridCategory) => {
      return stateCategory.propertyCategory.name === category.name && stateCategory.propertyCategory.expand;
    });
  }

  private async gatherData(): Promise<void> {
    if (this._isInDataRequest) {
      this._hasPendingDataRequest = true;
      return;
    }

    this.setState({ isLoading: true });

    this._isInDataRequest = true;
    let propertyData: PropertyData;
    try {
      propertyData = await this.props.dataProvider.getData();
    } finally {
      this._isInDataRequest = false;
    }

    if (!this._isMounted)
      return;

    if (this._hasPendingDataRequest) {
      this._hasPendingDataRequest = false;
      return this.gatherData();
    }

    const categories = new Array<PropertyGridCategory>();
    propertyData.categories.map((category: PropertyCategory, _index: number) => {
      const gridCategory: PropertyGridCategory = {
        propertyCategory: { ...category, expand: this._shouldExpandCategory(category) },
        propertyCount: propertyData.records[category.name].length,
        properties: propertyData.records[category.name],
      };
      categories.push(gridCategory);
    });
    this.setState({ categories, isLoading: false });
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

  private _isClickSupported() {
    return this.props.isPropertySelectionEnabled || this.props.isPropertyEditingEnabled;
  }

  private _onPropertyClicked = (property: PropertyRecord, key?: string) => {
    if (!this._isClickSupported())
      return;

    let selectedPropertyKey = this.state.selectedPropertyKey;
    let editingPropertyKey = this.state.editingPropertyKey;

    if (this.props.isPropertyEditingEnabled && property.value.valueFormat === PropertyValueFormat.Primitive) {
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

  private _onPropertyContextMenu = (property: PropertyRecord, e: React.MouseEvent) => {
    if (this.props.onPropertyContextMenu)
      this.props.onPropertyContextMenu({ propertyRecord: property, event: e });
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
    if (this.state.isLoading) {
      return (
        <div className="components-property-grid-loader">
          <Spinner size={SpinnerSize.Large} />
        </div>
      );
    }

    return (
      <div className="components-property-grid-wrapper">
        <div ref={this._gridRef} className="components-property-grid">
          {
            this.state.categories.map((gridCategory: PropertyGridCategory) => (
              <SelectablePropertyBlock
                key={gridCategory.propertyCategory.name}
                category={gridCategory.propertyCategory}
                properties={gridCategory.properties}
                orientation={this.state.orientation}
                selectedPropertyKey={this.state.selectedPropertyKey}
                onExpansionToggled={this._onExpansionToggled}
                onPropertyClicked={this._isClickSupported() ? this._onPropertyClicked : undefined}
                onPropertyContextMenu={this._onPropertyContextMenu}
                propertyValueRendererManager={this.props.propertyValueRendererManager}
                editingPropertyKey={this.state.editingPropertyKey}
                onEditCommit={this._onEditCommit}
                onEditCancel={this._onEditCancel}
                isPropertyHoverEnabled={this.props.isPropertyHoverEnabled}
                isPropertySelectionEnabled={this.props.isPropertySelectionEnabled}
              />
            ))
          }
        </div>
      </div>
    );
  }
}
