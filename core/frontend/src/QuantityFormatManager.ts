/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Formatter, Quantity, UnitProps, Format } from "@bentley/imodeljs-quantity";
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";

/** Defines standard format types for tools that need to display measurements to user. */
export enum ToolFormatType { Length = 1, Angle = 2, Area = 3, Volume = 4 }

export abstract class ToolFormatsProvider {
  public abstract getStandardFormat(type: ToolFormatType): Promise<Format>;
  public abstract getStandardUnit(type: ToolFormatType): Promise<UnitProps>;
}

/**
 * The QuantityFormatManager provide the ability for tools to show formatted values for standard quantity types.
 */
export class QuantityFormatManager {
  private _toolFormatsProvider: ToolFormatsProvider | undefined;

  public set toolFormatsProvider(formatsProvider: ToolFormatsProvider) { this._toolFormatsProvider = formatsProvider; }
  public get toolFormatsProvider() {
    if (undefined === this._toolFormatsProvider)
      throw new BentleyError(BentleyStatus.ERROR, "IModelApp must define a formatsProvider class");
    return this._toolFormatsProvider;
  }

  public getStandardToolUnit(type: ToolFormatType): Promise<UnitProps> {
    return this.toolFormatsProvider.getStandardUnit(type);
  }

  public getStandardToolFormat(type: ToolFormatType): Promise<Format> {
    return this.toolFormatsProvider.getStandardFormat(type);
  }

  public async formatToolQuantity(magnitude: number, type: ToolFormatType): Promise<string> {
    const lengthFormat = await this.getStandardToolFormat(type);
    const fromProps = await this.getStandardToolUnit(type);
    const formatter = new Formatter();
    const quantity = new Quantity(fromProps, magnitude);
    return formatter.formatQuantity(quantity, lengthFormat);
  }
}
