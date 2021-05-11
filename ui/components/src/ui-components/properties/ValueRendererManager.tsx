/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import * as React from "react";
import { PropertyRecord, PropertyValueFormat } from "@bentley/ui-abstract";
import { Orientation } from "@bentley/ui-core";
import { ArrayPropertyValueRenderer } from "./renderers/value/ArrayPropertyValueRenderer";
import { DoublePropertyValueRenderer } from "./renderers/value/DoublePropertyValueRenderer";
import { MergedPropertyValueRenderer } from "./renderers/value/MergedPropertyValueRenderer";
import { MultilineTextPropertyValueRenderer } from "./renderers/value/MultilineTextPropertyValueRenderer";
import { NavigationPropertyValueRenderer } from "./renderers/value/NavigationPropertyValueRenderer";
import { PrimitivePropertyValueRenderer } from "./renderers/value/PrimitivePropertyValueRenderer";
import { StructPropertyValueRenderer } from "./renderers/value/StructPropertyValueRenderer";
import { UrlPropertyValueRenderer } from "./renderers/value/UrlPropertyValueRenderer";

/** Types of property containers
 * @public
 */
export enum PropertyContainerType {
  PropertyPane = "pane",
  Table = "table",
  Tree = "tree",
}

/** State of the Dialog component in a container which renders properties
 * @public
 */
export interface PropertyDialogState {
  title: string;
  content: React.ReactNode;
}

/** State of the Popup component in a container which renders properties
 * @public
 */
export interface PropertyPopupState {
  fixedPosition: { top: number, left: number };
  content: React.ReactNode;
}

/** Additional parameters to the renderer
 * @public
 */
export interface PropertyValueRendererContext {
  /** Type of container that holds the property */
  containerType?: string;
  /** Style that should be applied to the rendered element */
  style?: React.CSSProperties;
  /** Orientation of property/container */
  orientation?: Orientation;
  /** Callback to request for a Popup to be shown. */
  onPopupShow?: (popupState: PropertyPopupState) => void;
  /** Callback to request for a Popup to be hidden. */
  onPopupHide?: () => void;
  /** Callback to request for Dialog to be opened. */
  onDialogOpen?: (dialogState: PropertyDialogState) => void;
  /** Text with custom style applied to it */
  decoratedTextElement?: React.ReactNode;
  /** Callback to highlight text */
  textHighlighter?: (text: string) => React.ReactNode;
  /** Default value to show if value rendering is asynchronous */
  defaultValue?: React.ReactNode;
  /** Whether property value is expanded. */
  isExpanded?: boolean;
  /** Called when property value expansion or collapse is requested. */
  onExpansionToggled?: () => void;
  /** Called when property value element height changes. */
  onHeightChanged?: (newHeight: number) => void;
}

/** Custom property value renderer interface
 * @public
 */
export interface IPropertyValueRenderer {
  /** Checks if the renderer can handle given property */
  canRender: (record: PropertyRecord, context?: PropertyValueRendererContext) => boolean;
  /** Method that returns a JSX representation of PropertyRecord */
  render: (record: PropertyRecord, context?: PropertyValueRendererContext) => React.ReactNode;
}

/** Default implementation of property value renderer manager
 * @public
 */
export class PropertyValueRendererManager {
  private static _defaultRendererManager: PropertyValueRendererManager;

  protected _propertyRenderers: Map<string, IPropertyValueRenderer> = new Map<string, IPropertyValueRenderer>();
  protected _defaultPrimitiveValueRenderer: IPropertyValueRenderer = new PrimitivePropertyValueRenderer();
  protected _defaultArrayValueRenderer: IPropertyValueRenderer = new ArrayPropertyValueRenderer();
  protected _defaultStructValueRenderer: IPropertyValueRenderer = new StructPropertyValueRenderer();
  protected _defaultMergedValueRenderer: IPropertyValueRenderer = new MergedPropertyValueRenderer();

  private selectRenderer(record: PropertyRecord) {
    if (record.property.renderer && this._propertyRenderers.has(record.property.renderer.name))
      return this._propertyRenderers.get(record.property.renderer.name);

    if (this._propertyRenderers.has(record.property.typename))
      return this._propertyRenderers.get(record.property.typename)!;

    if (this._defaultMergedValueRenderer.canRender(record))
      return this._defaultMergedValueRenderer;

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
  public render(record: PropertyRecord, context?: PropertyValueRendererContext): React.ReactNode {
    const selectedRenderer = this.selectRenderer(record);

    if (!selectedRenderer || !selectedRenderer.canRender(record, context))
      return undefined;

    return selectedRenderer.render(record, context);
  }

  /** Register a specified property type renderer */
  public registerRenderer(rendererType: string, propertyRenderer: IPropertyValueRenderer, overwrite = false) {
    if (!overwrite && this._propertyRenderers.has(rendererType)) {
      throw Error(`PropertyValueRendererManager.registerRenderer error: type '${rendererType}' already registered to '${propertyRenderer.constructor.name}'`);
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
PropertyValueRendererManager.defaultManager.registerRenderer("url", new UrlPropertyValueRenderer());
PropertyValueRendererManager.defaultManager.registerRenderer("double", new DoublePropertyValueRenderer());
PropertyValueRendererManager.defaultManager.registerRenderer("multiline", new MultilineTextPropertyValueRenderer());
