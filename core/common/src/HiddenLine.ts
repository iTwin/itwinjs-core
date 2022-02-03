/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { JsonUtils } from "@itwin/core-bentley";
import type { ColorDefProps } from "./ColorDef";
import { ColorDef } from "./ColorDef";
import { LinePixels } from "./LinePixels";

/** Namespace containing types controlling how edges and surfaces should be drawn in "hidden line" and "solid fill" [[RenderMode]]s.
 * @public
 */
export namespace HiddenLine {
  /** Describes the symbology with which edges should be drawn. */
  export interface StyleProps {
    /** @internal
     * This JSON representation is awkward, but it must match that used in the db.
     * If the JSON came from the db then all members are present and:
     *  - color is overridden only if ovrColor = true.
     *  - width is overridden only if width != 0
     *  - pattern is overridden only if pattern != LinePixels.Invalid
     * The 'public' JSON representation is more sensible:
     *  - Color, width, and pattern are each overridden iff they are not undefined.
     * To make this work for both scenarios, the rules are:
     *  - color is overridden if color != undefined and ovrColor != false
     *  - width is overridden if width != undefined and width != 0
     *  - pattern is overridden if pattern != undefined and pattern != LinePixels.Invalid
     */
    readonly ovrColor?: boolean;
    /** If defined, the color used to draw the edges. If undefined, edges are drawn using the element's line color. */
    readonly color?: ColorDefProps;
    /** If defined, the pixel pattern used to draw the edges. If undefined, edges are drawn using the element's line pattern. */
    readonly pattern?: LinePixels;
    /** If defined, the width of the edges in pixels. If undefined (or 0), edges are drawn using the element's line width.
     * @note Non-integer values are truncated, and values are clamped to the range [1, 32].
     */
    readonly width?: number;
  }

  /** Describes the symbology with which edges should be drawn. */
  export class Style {
    /** @internal */
    public get ovrColor(): boolean { return undefined !== this.color; }
    /** If defined, the color used to draw the edges. If undefined, edges are drawn using the element's line color. */
    public readonly color?: ColorDef;
    /** If defined, the pixel pattern used to draw the edges. If undefined, edges are drawn using the element's line pattern. */
    public readonly pattern?: LinePixels;
    /** If defined, the width of the edges in pixels. If undefined (or 0), edges are drawn using the element's line width.
     * @note Non-integer values are truncated, and values are clamped to the range [1, 32].
     */
    public readonly width?: number;

    private constructor(json?: StyleProps, hidden?: true) {
      if (JsonUtils.isEmptyObjectOrUndefined(json)) {
        if (hidden)
          this.pattern = LinePixels.HiddenLine;

        return;
      }

      json = json as StyleProps; // per JsonUtils.isEmptyObjectOrUndefined()
      if (undefined !== json.color && false !== json.ovrColor)
        this.color = ColorDef.fromJSON(json.color);

      if (undefined !== json.pattern) {
        const pattern = JsonUtils.asInt(json.pattern, hidden ? LinePixels.HiddenLine : LinePixels.Invalid);
        if (LinePixels.Invalid !== pattern)
          this.pattern = pattern;
      } else if (hidden) {
        this.pattern = LinePixels.HiddenLine;
      }

      if (undefined !== json.width) {
        let width = JsonUtils.asInt(json.width, 0);
        if (0 !== width) {
          width = Math.max(1, width);
          this.width = Math.min(32, width);
        }
      }
    }

    public static readonly defaultVisible = new Style({});
    public static readonly defaultHidden = new Style({}, true);

    public static fromJSON(json?: StyleProps, hidden?: true): Style {
      if (undefined !== json)
        return new Style(json, hidden);

      return hidden ? this.defaultHidden : this.defaultVisible;
    }

    /** Create a Style equivalent to this one but with the specified color override. */
    public overrideColor(color: ColorDef | undefined): Style {
      if (undefined === this.color && undefined === color)
        return this;

      if (undefined !== this.color && undefined !== color && this.color.equals(color))
        return this;

      return Style.fromJSON({
        color: color?.toJSON(),
        ovrColor: undefined !== color,
        pattern: this.pattern,
        width: this.width,
      });
    }

    /** Create a Style equivalent to this one but with the specified pattern override. */
    public overridePattern(pattern: LinePixels | undefined): Style {
      if (pattern === this.pattern)
        return this;

      return Style.fromJSON({
        color: this.color?.toJSON(),
        ovrColor: this.ovrColor,
        pattern,
        width: this.width,
      });
    }

    /** Create a Style equivalent to this one but with the specified width override. */
    public overrideWidth(width: number | undefined): Style {
      if (width === this.width)
        return this;

      return Style.fromJSON({
        color: this.color?.toJSON(),
        ovrColor: this.ovrColor,
        pattern: this.pattern,
        width,
      });
    }

    /** Returns true if this Style is equivalent to the supplied Style. */
    public equals(other: Style): boolean {
      if (this === other)
        return true;
      else if (this.ovrColor !== other.ovrColor || this.pattern !== other.pattern || this.width !== other.width)
        return false;
      else
        return undefined === this.color || this.color.equals(other.color!);
    }

    public toJSON(): StyleProps {
      return {
        ovrColor: this.ovrColor,
        color: this.color ? this.color.toJSON() : ColorDef.white.toJSON(),
        pattern: undefined !== this.pattern ? this.pattern : LinePixels.Invalid,
        width: undefined !== this.width ? this.width : 0,
      };
    }
  }

  /** Describes how visible and hidden edges and transparent surfaces should be rendered in "hidden line" and "solid fill" [[RenderMode]]s. */
  export interface SettingsProps {
    /** Describes how visible edges (those unobscured by other geometry) should be displayed. */
    readonly visible?: StyleProps;
    /** Describes how hidden edges (those obscured by other geometry) should be displayed. */
    readonly hidden?: StyleProps;
    /** A value in the range [0.0, 1.0] specifying a threshold below which transparent surfaces should not be drawn.
     * A value of 0.0 indicates any surface that is not 100% opaque should not be drawn.
     * A value of 0.25 indicates any surface that is less than 25% opaque should not be drawn.
     * A value of 1.0 indicates that all surfaces should be drawn regardless of transparency.
     * @note values will be clamped to the range [0.0, 1.0].
     * @note Defaults to 1.0.
     */
    readonly transThreshold?: number;
  }

  /** Describes how visible and hidden edges and transparent surfaces should be rendered in "hidden line" and "solid fill" [[RenderMode]]s. */
  export class Settings {
    /** Describes how visible edges (those unobscured by other geometry) should be displayed. */
    public readonly visible: Style;
    /** Describes how hidden edges (those obscured by other geometry) should be displayed. */
    public readonly hidden: Style;
    /** A value in the range [0.0, 1.0] specifying a threshold below which transparent surfaces should not be drawn.
     * A value of 0.0 indicates any surface that is not 100% opaque should not be drawn.
     * A value of 0.25 indicates any surface that is less than 25% opaque should not be drawn.
     * A value of 1.0 indicates that all surfaces should be drawn regardless of transparency.
     * @note values will be clamped to the range [0.0, 1.0].
     * @note Defaults to 1.0.
     */
    public readonly transparencyThreshold: number;
    public get transThreshold(): number { return this.transparencyThreshold; }

    /** The default display settings. */
    public static defaults = new Settings({});

    /** Create a DisplaySettings from its JSON representation. */
    public static fromJSON(json?: SettingsProps): Settings {
      if (JsonUtils.isEmptyObjectOrUndefined(json))
        return this.defaults;
      else if (json instanceof Settings)
        return json;
      else
        return new Settings(json!);
    }

    public toJSON(): SettingsProps {
      return {
        visible: this.visible.toJSON(),
        hidden: this.hidden.toJSON(),
        transThreshold: this.transThreshold,
      };
    }

    /** Create a Settings equivalent to this one with the exception of those properties defined in the supplied JSON. */
    public override(props: SettingsProps): Settings {
      const visible = props.visible;
      const hidden = props.hidden;
      const transparencyThreshold = props.transThreshold;
      return Settings.fromJSON({
        visible: undefined !== visible ? visible : this.visible.toJSON(),
        hidden: undefined !== hidden ? hidden : this.hidden.toJSON(),
        transThreshold: undefined !== transparencyThreshold ? transparencyThreshold : this.transparencyThreshold,
      });
    }

    public equals(other: Settings): boolean {
      if (this === other)
        return true;

      return this.visible.equals(other.visible) && this.hidden.equals(other.hidden) && this.transparencyThreshold === other.transparencyThreshold;
    }

    public get matchesDefaults(): boolean {
      return this.equals(Settings.defaults);
    }

    private constructor(json: SettingsProps) {
      this.visible = Style.fromJSON(json.visible);
      this.hidden = Style.fromJSON(json.hidden, true);
      this.transparencyThreshold = JsonUtils.asDouble(json.transThreshold, 1.0);
    }
  }
}
