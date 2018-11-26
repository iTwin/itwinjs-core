/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import React from "react";
import { Orientation } from "@bentley/ui-core";
import { PropertyRecord } from "./Record";
import { PropertyValueFormat } from "./Value";
import { PrimitivePropertyValueRenderer } from "./renderers/value/PrimitivePropertyValueRenderer";
import { ArrayPropertyValueRenderer } from "./renderers/value/ArrayPropertyValueRenderer";
import { StructPropertyValueRenderer } from "./renderers/value/StructPropertyValueRenderer";
import { NavigationPropertyValueRenderer } from "./renderers/value/NavigationPropertyValueRenderer";
import { DoublePropertyValueRenderer } from "./renderers/value/DoublePropertyValueRenderer";

/** Types of property containers */
export enum PropertyContainerType {
  PropertyPane = "pane",
  Table = "table",
}

/** State of the Dialog component in a container which renders properties */
export interface PropertyDialogState {
  title: string;
  content: React.ReactNode;
}

/** State of the Popup component in a container which renders properties */
export interface PropertyPopupState {
  fixedPosition: { top: number, left: number };
  content: React.ReactNode;
}

/** Additional parameters to the renderer */
export interface PropertyValueRendererContext {
  /** Type of container that holds the property */
  containerType?: string;
  /** Orientation of property/container */
  orientation?: Orientation;
  /** Callback to request for a Popup to be shown. */
  onPopupShow?: (popupState: PropertyPopupState) => void;
  /** Callback to request for a Popup to be hidden. */
  onPopupHide?: () => void;
  /** Callback to request for Dialog to be opened. */
  onDialogOpen?: (dialogState: PropertyDialogState) => void;
}

/** Custom property value renderer interface */
export interface IPropertyValueRenderer {
  /** Checks if the renderer can handle given property */
  canRender: (record: PropertyRecord, context?: PropertyValueRendererContext) => boolean;
  /** Method that returns a JSX representation of PropertyRecord */
  render: (record: PropertyRecord, context?: PropertyValueRendererContext) => Promise<React.ReactNode>;
}

/** Default implementation of property value renderer manager */
export class PropertyValueRendererManager {
  private static _defaultRendererManager: PropertyValueRendererManager;

  protected _propertyRenderers: Map<string, IPropertyValueRenderer> = new Map<string, IPropertyValueRenderer>();
  protected _defaultPrimitiveValueRenderer: IPropertyValueRenderer = new PrimitivePropertyValueRenderer();
  protected _defaultArrayValueRenderer: IPropertyValueRenderer = new ArrayPropertyValueRenderer();
  protected _defaultStructValueRenderer: IPropertyValueRenderer = new StructPropertyValueRenderer();

  private selectRenderer(record: PropertyRecord) {
    if (this._propertyRenderers.has(record.property.typename))
      return this._propertyRenderers.get(record.property.typename)!;

    // Use one of default renderers
    switch (record.value.valueFormat) {
      case PropertyValueFormat.Primitive:
        return this._defaultPrimitiveValueRenderer;
      case PropertyValueFormat.Array:
        return this._defaultArrayValueRenderer;
      case PropertyValueFormat.Struct:
        return this._defaultStructValueRenderer;
      default:
        return undefined;
    }
  }

  /** Render property into JSX element */
  public async render(record: PropertyRecord, context?: PropertyValueRendererContext): Promise<React.ReactNode> {
    const selectedRenderer = this.selectRenderer(record);

    if (!selectedRenderer || !selectedRenderer.canRender(record, context))
      return undefined;

    return selectedRenderer.render(record, context);
  }

  /** Register a specified property type renderer */
  public registerRenderer(rendererType: string, propertyRenderer: IPropertyValueRenderer, overwrite = false) {
    if (!overwrite && this._propertyRenderers.has(rendererType)) {
      throw Error("PropertyValueRendererManager.registerRenderer error: type '" + rendererType + "' already registered to '" + propertyRenderer.constructor.name + "'");
    }

    this._propertyRenderers.set(rendererType, propertyRenderer);
  }

  /** Unregister a specified property type renderer */
  public unregisterRenderer(rendererType: string) {
    this._propertyRenderers.delete(rendererType);
  }

  /** Get the specified property type renderer instance */
  public getRegisteredRenderer(rendererType: string) {
    return this._propertyRenderers.get(rendererType);
  }

  /** Returns default PropertyValueRendererManager instance */
  public static get defaultManager() {
    if (!this._defaultRendererManager)
      this._defaultRendererManager = new PropertyValueRendererManager();

    return this._defaultRendererManager;
  }
}

PropertyValueRendererManager.defaultManager.registerRenderer("navigation", new NavigationPropertyValueRenderer());
PropertyValueRendererManager.defaultManager.registerRenderer("double", new DoublePropertyValueRenderer());
