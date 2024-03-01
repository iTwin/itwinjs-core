/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { ColorDef } from "@itwin/core-common";

/** Convert a channel array [r, g, b, a] to ColorDef
 * @internal
 */
function colorFromArray(channels?: number[]) {
  if (channels && channels.length === 4) {
    // Alpha channel is reversed, 255 = opaque
    return ColorDef.from(channels[0], channels[1], channels[2], 255 - channels[3]);
  }
  return undefined;
}

/** @internal */
export type EsriSymbolPropsType = "esriSFS" | "esriPMS" | "esriSMS" | "esriSLS" | "esriSMS" | "esriTS" | "CIMSymbolReference";

/** @internal */
export interface EsriSymbolCommonProps {
  type: EsriSymbolPropsType;
}

/** @internal */
export type EsriSymbolProps = EsriSLSProps | EsriPMSProps | EsriSFSProps | EsriSMSProps;

/** @internal */
export abstract class EsriSymbol implements EsriSymbolCommonProps {
  public readonly abstract type: EsriSymbolPropsType;

  public static fromJSON(props: EsriSymbolProps) {
    if (props.type === "esriSFS") {
      return EsriSFS.fromJSON(props );
    } else if (props.type === "esriSLS") {
      return EsriSLS.fromJSON(props );
    } else if (props.type === "esriPMS") {
      return EsriPMS.fromJSON(props );
    } else if (props.type === "esriSMS") {
      return EsriSMS.fromJSON(props );
    }
    throw new Error(`Unknown ESRI symbology type}`);
  }
}

/** @internal */
export type EsriSLSStyle = "esriSLSDash" | "esriSLSDashDot" | "esriSLSDashDotDot" | "esriSLSDot" | "esriSLSLongDash" | "esriSLSLongDashDot" |
"esriSLSNull" | "esriSLSShortDash" | "esriSLSShortDashDot" | "esriSLSShortDashDotDot" | "esriSLSShortDot" | "esriSLSSolid";

/** @internal */
export interface EsriSLSProps extends EsriSymbolCommonProps {
  color: number[];
  type: "esriSLS";
  width: number;
  style: EsriSLSStyle;
}

/** @internal */
export class EsriSLS implements EsriSymbolCommonProps {
  public readonly props: EsriSLSProps;

  public get color() { return colorFromArray(this.props.color); }
  public get type() { return this.props.type; }
  public get width() { return this.props.width; }
  public get style() { return this.props.style; }

  constructor(json: EsriSLSProps) {
    this.props = json;
  }

  public static fromJSON(json: EsriSLSProps) {
    return new EsriSLS(json);
  }
}

/** @internal */
export interface EsriPMSProps extends EsriSymbolCommonProps {
  type: "esriPMS";
  url: string;
  imageData: string;
  contentType: string;
  width?: number;
  height?: number;
  xoffset?: number;
  yoffset?: number;
  angle?: number;
}

/** @internal */
export class EsriPMS implements EsriSymbolCommonProps {
  public readonly props: EsriPMSProps;
  private _image: HTMLImageElement|undefined;

  public get type() { return this.props.type; }
  public get url() { return this.props.url; }
  public get imageData() { return this.props.imageData; }
  public get imageUrl() { return `data:${this.contentType};base64,${this.imageData}`; }
  public get image() {
    assert(this._image !== undefined);
    return this._image;
  }
  public get contentType() { return this.props.contentType; }
  public get width() { return this.props.width; }
  public get height() { return this.props.height; }
  public get xoffset() { return this.props.xoffset; }
  public get yoffset() { return this.props.yoffset; }
  public get angle() { return this.props.angle; }

  public async loadImage() {
    if (this._image === undefined) {
      this._image = new Image();

      return new Promise<void>((resolve, reject) => {
        if (this._image) {
          this._image.addEventListener("load", () => {
            resolve();
          });
          this._image.src = this.imageUrl;
        } else
          reject(new Error("Failed to load image"));
      });
    }
  }

  private constructor(json: EsriPMSProps) {
    this.props = json;
  }

  public static fromJSON(json: EsriPMSProps) {
    return new EsriPMS(json);
  }
}

/** @internal */
export type EsriSMSStyleType = "esriSMSCircle" | "esriSMSCross" | "esriSMSDiamond" | "esriSMSSquare" | "esriSMSTriangle" | "esriSMSX";

/** @internal */
export interface EsriSMSProps extends EsriSymbolCommonProps {
  angle?: number;
  color?: number[];
  outline?: EsriSLSProps;
  size: number;
  style: EsriSMSStyleType;
  type: "esriSMS";
  xoffset?: number;
  yoffset?: number;
}

/** @internal */
export class EsriSMS implements EsriSymbolCommonProps {
  public readonly props: EsriSMSProps;
  private _outline: EsriSLS | undefined;
  public get angle()    { return this.props.angle; }
  public get color()    { return colorFromArray(this.props.color); }
  public get outline()  { return this._outline; }
  public get size()     { return this.props.size; }
  public get style()    { return this.props.style; }
  public get type()     { return this.props.type; }
  public get xoffset()  { return this.props.xoffset; }
  public get yoffset()  { return this.props.yoffset; }

  private constructor(json: EsriSMSProps) {
    this.props = json;
    if (json.outline)
      this._outline = EsriSLS.fromJSON(json.outline);
  }

  public static fromJSON(json: EsriSMSProps) {
    return new EsriSMS(json);
  }
}

/** @internal */
export type EsriSFSStyleProps = "esriSFSBackwardDiagonal" | "esriSFSCross" | "esriSFSDiagonalCross" | "esriSFSForwardDiagonal" | "esriSFSHorizontal" | "esriSFSNull" | "esriSFSSolid" | "esriSFSVertical";

/** @internal */
export interface EsriSFSProps extends EsriSymbolCommonProps {
  color?: number[];
  type: "esriSFS";
  style: EsriSFSStyleProps;
  outline?: EsriSLSProps;
}

/** @internal */
export class EsriSFS implements EsriSymbolCommonProps {
  public readonly props: EsriSFSProps;
  private _outline: EsriSLS | undefined;

  public get color() { return colorFromArray(this.props.color); }
  public get type() { return this.props.type; }
  public get style() { return this.props.style; }
  public get outline() { return this._outline; }
  constructor(json: EsriSFSProps) {
    this.props = json;
    if (json.outline)
      this._outline = EsriSLS.fromJSON(json.outline);
  }

  public static fromJSON(json: EsriSFSProps): EsriSFS {
    return new EsriSFS(json);
  }
}

/** @internal */
export interface EsriUniqueValueInfoProps {
  value: string;
  label?: string;
  description?: string;
  symbol: EsriSymbolProps;
}

/** @internal */
export class EsriUniqueValueInfo  {

  public readonly value: string;
  public readonly label: string|undefined;
  public readonly description: string|undefined;
  public readonly symbol: EsriSymbol;

  private constructor(json: EsriUniqueValueInfoProps) {
    this.value = json.value;
    this.label = json.label;
    this.description = json.description;
    this.symbol = EsriSymbol.fromJSON(json.symbol);
  }

  public static fromJSON(json: EsriUniqueValueInfoProps) {
    return new EsriUniqueValueInfo(json);
  }
}

/** @internal */
export interface EsriClassBreaksInfoProps {
  classMaxValue: number;
  classMinValue?: number;
  label?: string;
  description?: string;
  symbol: EsriSymbolProps;
}

/** @internal */
export class EsriClassBreaksValueInfo  {

  public readonly classMaxValue: number;
  public readonly classMinValue?: number;
  public readonly label: string|undefined;
  public readonly description: string|undefined;
  public readonly symbol: EsriSymbol;

  private constructor(json: EsriClassBreaksInfoProps) {
    this.classMaxValue = json.classMaxValue;
    this.classMinValue = json.classMinValue;
    this.label = json.label;
    this.description = json.description;
    this.symbol = EsriSymbol.fromJSON(json.symbol);
  }

  public static fromJSON(json: EsriClassBreaksInfoProps) {
    return new EsriClassBreaksValueInfo(json);
  }
}

/** @internal */
export interface EsriRendererBaseProps {
  type: EsriRendererType;
}

/** @internal */
export interface EsriSimpleRendererProps extends EsriRendererBaseProps {
  symbol: EsriSymbolProps;
}

/** @internal */
export interface EsriUniqueValueRendererProps extends EsriRendererBaseProps {
  field1?: string;
  field2?: string;
  field3?: string;
  defaultSymbol?: EsriSymbolProps;
  uniqueValueInfos: EsriUniqueValueInfoProps[];
}

/** @internal */
export type EsriClassificationMethodType = "esriClassifyDefinedInterval" | "esriClassifyEqualInterval" | "esriClassifyManual" | "esriClassifyNaturalBreaks" | "esriClassifyQuantile" | "esriClassifyStandardDeviation";

/** @internal */
export interface EsriClassBreaksRendererProps extends EsriRendererBaseProps {
  field: string;
  minValue: number;
  defaultSymbol?: EsriSymbolProps;
  classificationMethod: EsriClassificationMethodType;
  classBreakInfos: EsriClassBreaksInfoProps[];
}

/** @internal */
export type EsriRendererType = "simple" | "uniqueValue" | "classBreaks";

/** @internal */
export  type EsriRendererProps = EsriSimpleRendererProps | EsriUniqueValueRendererProps | EsriClassBreaksRendererProps;

/** @internal */
export abstract class EsriRenderer {
  public readonly abstract type: EsriRendererType;
  public abstract initialize(): Promise<void>;
  public get fields(): string[]|undefined {return undefined;}
  public static fromJSON(json: EsriRendererProps): EsriRenderer {
    if (json.type === "simple")
      return EsriSimpleRenderer.fromJSON(json as EsriSimpleRendererProps);
    else if (json.type === "uniqueValue")
      return EsriUniqueValueRenderer.fromJSON(json as EsriUniqueValueRendererProps);
    else if (json.type === "classBreaks")
      return EsriClassBreaksRenderer.fromJSON(json as EsriClassBreaksRendererProps);
    else
      throw Error("Unknown renderer type");
  }
}

/** @internal */
export class EsriSimpleRenderer extends EsriRenderer {
  public readonly type: EsriRendererType = "simple";
  public readonly symbol: EsriSymbol;

  protected constructor(json: EsriSimpleRendererProps) {
    super();
    this.type = json.type;
    this.symbol = EsriSymbol.fromJSON(json.symbol);
  }
  public async initialize() {
    const promises: Promise<void>[] = [];
    if (this.symbol.type === "esriPMS") {
      promises.push((this.symbol as EsriPMS).loadImage());
    }
    await Promise.all(promises);
  }

  public static override fromJSON(json: EsriSimpleRendererProps) {
    return new EsriSimpleRenderer(json);
  }
}

/** @internal */
export class EsriUniqueValueRenderer extends EsriRenderer {
  private _props: EsriUniqueValueRendererProps;
  public readonly type: EsriRendererType = "uniqueValue";
  public readonly defaultSymbol?: EsriSymbol;
  public readonly uniqueValueInfos: EsriUniqueValueInfo[] = [];

  public override get fields() {
    const fields: string[] = [];
    if (this.field1)
      fields.push(this.field1);
    if (this.field2)
      fields.push(this.field2);
    if (this.field3)
      fields.push(this.field3);

    return fields;
  }

  public get field1() { return this._props.field1 ?? undefined; }
  public get field2() { return this._props.field2 ?? undefined; }
  public get field3() { return this._props.field3 ?? undefined; }

  protected constructor(json: EsriUniqueValueRendererProps) {
    super();
    if (json.defaultSymbol)
      this.defaultSymbol = EsriSymbol.fromJSON(json.defaultSymbol);
    for (const uvi of json.uniqueValueInfos) {
      this.uniqueValueInfos.push(EsriUniqueValueInfo.fromJSON(uvi));
    }

    this._props = json;
  }

  public override async initialize() {
    const promises: Promise<void>[] = [];
    if (this.defaultSymbol?.type === "esriPMS") {
      promises.push((this.defaultSymbol as EsriPMS).loadImage());
    }
    for (const uvi of this.uniqueValueInfos) {
      if (uvi.symbol.type === "esriPMS") {
        promises.push((uvi.symbol as EsriPMS).loadImage());
      }
    }
    await Promise.all(promises);
  }

  public static override fromJSON(json: EsriUniqueValueRendererProps) {
    return new EsriUniqueValueRenderer(json);
  }
}

/** @internal */
export class EsriClassBreaksRenderer extends EsriRenderer {
  private _props: EsriClassBreaksRendererProps;
  public readonly type: EsriRendererType = "classBreaks";
  public readonly defaultSymbol?: EsriSymbol;
  public get classificationMethod() {return this._props.classificationMethod;}
  public readonly classBreakInfos: EsriClassBreaksValueInfo[] = [];

  public override get fields() {
    if (this.field)
      return [this.field];

    return undefined;
  }

  public get field() { return this._props.field ?? undefined; }
  public get minValue() { return this._props.minValue ?? 0; }

  protected constructor(json: EsriClassBreaksRendererProps) {
    super();
    if (json.defaultSymbol)
      this.defaultSymbol = EsriSymbol.fromJSON(json.defaultSymbol);

    for (const cbi of json.classBreakInfos) {
      this.classBreakInfos.push(EsriClassBreaksValueInfo.fromJSON(cbi));
    }

    this._props = json;
  }

  public override async initialize() {
    const promises: Promise<void>[] = [];
    if (this.defaultSymbol?.type === "esriPMS") {
      promises.push((this.defaultSymbol as EsriPMS).loadImage());
    }
    for (const cbi of this.classBreakInfos) {
      if (cbi.symbol.type === "esriPMS") {
        promises.push((cbi.symbol as EsriPMS).loadImage());
      }
    }
    await Promise.all(promises);
  }

  public static override fromJSON(json: EsriClassBreaksRendererProps) {
    return new EsriClassBreaksRenderer(json);
  }
}

