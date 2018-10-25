// import React from "react";
import { PropertyRecord } from "./Record";
import { PropertyValueFormat } from "./Value";
import { PrimitivePropertyValueRenderer } from "./renderers/PrimitivePropertyValueRenderer";
import { ArrayPropertyValueRenderer } from "./renderers/ArrayPropertyValueRenderer";
import { StructPropertyValueRenderer } from "./renderers/StructPropertyValueRenderer";
import { Orientation } from "@bentley/ui-core";

/** Types of property containers */
export enum PropertyContainerType {
  PropertyPane = "pane",
  Table = "table",
}

/** Additional parameters to the renderer */
export interface IPropertyValueRendererContext {
  /** Type of container that holds the property */
  containerType?: string;
  /** Orientation of property/container */
  orientation?: Orientation;
  /** Additional information */
  extras?: any;
}

/** Custom property value renderer interface */
export interface IPropertyValueRenderer {
  /** Checks if the renderer can handle given property */
  canRender: (record: PropertyRecord, context?: IPropertyValueRendererContext) => boolean;
  /** Method that returns a JSX representation of PropertyRecord */
  render: (record: PropertyRecord, context?: IPropertyValueRendererContext) => Promise<React.ReactNode>;
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
  public async render(record: PropertyRecord, context?: IPropertyValueRendererContext): Promise<React.ReactNode> {
    const selectedRenderer = this.selectRenderer(record);

    if (!selectedRenderer || !selectedRenderer.canRender(record, context))
      return undefined;

    return await selectedRenderer.render(record, context);
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
