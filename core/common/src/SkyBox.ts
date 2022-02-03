/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import type { Id64String, NonFunctionPropertiesOf } from "@itwin/core-bentley";
import { Id64 } from "@itwin/core-bentley";
import type { ColorDefProps } from "./ColorDef";
import { ColorDef } from "./ColorDef";
import type { TextureImageSpec } from "./RenderTexture";

/** Supported types of [[SkyBox]] images.
 * @see [[SkyBoxImageProps]].
 * @public
 */
export enum SkyBoxImageType {
  /** No image, indicating a [[SkyGradient]] should be displayed. */
  None = 0,
  /** A single image mapped to the surface of a sphere.
   * @see [[SkySphere]].
   */
  Spherical = 1,
  /** @internal not yet supported */
  Cylindrical = 2,
  /** Six images mapped to the faces of a cube.
   * @see [[SkyCube]].
   */
  Cube = 3,
}

/** JSON representation of the six images used by a [[SkyCube]].
 * Each property specifies the image for a face of the cube as either an image URL, or the Id of a [Texture]($backend) element.
 * Each image must be square and have the same dimensions as all the other images.
 * @public
 */
export interface SkyCubeProps {
  front: TextureImageSpec;
  back: TextureImageSpec;
  top: TextureImageSpec;
  bottom: TextureImageSpec;
  right: TextureImageSpec;
  left: TextureImageSpec;
}

/** JSON representation of the image used for a [[SkySphere]].
 * @see [[SkyBoxProps.image]].
 * @public
 */
export interface SkySphereImageProps {
  type: SkyBoxImageType.Spherical;
  texture: TextureImageSpec;
  /** @internal */
  textures?: never;
}

/** JSON representation of the images used for a [[SkyCube]].
 * @see [[SkyBoxProps.image]].
 * @public
 */
export interface SkyCubeImageProps {
  type: SkyBoxImageType.Cube;
  textures: SkyCubeProps;
  /** @internal */
  texture?: never;
}

/** JSON representation of the image(s) to be mapped to the surfaces of a [[SkyBox]].
 * @see [[SkyBoxProps.image]].
 * @public
 */
export type SkyBoxImageProps = SkySphereImageProps | SkyCubeImageProps | { type?: SkyBoxImageType, texture?: never, textures?: never };

/** JSON representation of a [[SkyBox]] that can be drawn as the background of a [ViewState3d]($frontend).
 * An object of this type can describe one of several types of sky box:
 *  - A cube with a texture image mapped to each face; or
 *  - A sphere with a single texture image mapped to its surface; or
 *  - A sphere with a two- or four-color vertical [[Gradient]] mapped to its surface.
 *
 * Whether cuboid or spherical, the skybox is drawn as if the viewer and the contents of the view are contained within its interior.
 *
 * For a two-color gradient, the gradient transitions smoothly from the nadir color at the bottom of the sphere to the zenith color at the top of the sphere.
 * The sky and ground colors are unused, as are the sky and ground exponents.
 *
 * For a four-color gradient, a "horizon" is produced on the equator of the sphere, where the ground color and sky color meet. The lower half of the sphere transitions
 * smoothly from the ground color at the equator to the nadir color at the bottom, and the upper half transitions from the sky color at the equator to the zenith color at
 * the top of the sphere.
 *
 * The color and exponent properties are unused if one or more texture images are supplied.
 *
 * @see [[DisplayStyle3dSettings.environment]] to define the skybox for a display style.
 * @public
 */
export interface SkyBoxProps {
  /** Whether or not the skybox should be displayed.
   * Default: false.
   */
  display?: boolean;
  /** For a [[SkyGradient]], if true, a 2-color gradient skybox is used instead of a 4-color.
   * Default: false.
   */
  twoColor?: boolean;
  /** The color of the sky at the horizon. Unused unless this is a four-color [[SkyGradient]].
   * Default: (143, 205, 255).
   */
  skyColor?: ColorDefProps;
  /** The color of the ground at the horizon. Unused unless this is a four-color [[SkyGradient]].
   * Default: (120, 143, 125).
   */
  groundColor?: ColorDefProps;
  /** The color of the top of the sphere.
   * Default: (54, 117, 255).
   */
  zenithColor?: ColorDefProps;
  /** The color of the bottom of the sphere.
   * Default: (40, 15, 0).
   */
  nadirColor?: ColorDefProps;
  /** For a 4-color [[SkyGradient]], controls speed of change from sky color to zenith color; otherwise unused.
   * Default: 4.0.
   */
  skyExponent?: number;
  /** For a 4-color [[SkyGradient]], controls speed of change from ground color to nadir color; otherwise unused.
   * Default: 4.0.
   */
  groundExponent?: number;
  /** The image(s), if any, to be mapped to the surfaces of the sphere or cube. If undefined, the skybox will be displayed as a gradient instead.
   * Default: undefined.
   */
  image?: SkyBoxImageProps;
}

const defaultGroundColor = ColorDef.from(143, 205, 125);
const defaultZenithColor = ColorDef.from(54, 117, 255);
const defaultNadirColor = ColorDef.from(40, 125, 0);
const defaultSkyColor = ColorDef.from(142, 205, 255);
const defaultExponent = 4.0;

function colorDefFromJson(props?: ColorDefProps): ColorDef | undefined {
  return undefined !== props ? ColorDef.fromJSON(props) : undefined;
}

/** A type containing all of the properties and none of the methods of [[SkyGradient]] with `readonly` modifiers removed.
 * @see [[SkyGradient.create]] and [[SkyGradient.clone]].
 * @public
 */
export type SkyGradientProperties = NonFunctionPropertiesOf<SkyGradient>;

/** Describes how to map a two- or four-color [[Gradient]] to the interior of a sphere to produce a [[SkyBox]].
 * @see [[SkyBox.gradient]].
 * @public
 */
export class SkyGradient {
  public readonly twoColor: boolean;
  public readonly skyColor: ColorDef;
  public readonly groundColor: ColorDef;
  public readonly zenithColor: ColorDef;
  public readonly nadirColor: ColorDef;
  public readonly skyExponent: number;
  public readonly groundExponent: number;

  private constructor(args: Partial<SkyGradientProperties>) {
    this.twoColor = args.twoColor ?? false;
    this.skyColor = args.skyColor ?? defaultSkyColor;
    this.groundColor = args.groundColor ?? defaultGroundColor;
    this.nadirColor = args.nadirColor ?? defaultNadirColor;
    this.zenithColor = args.zenithColor ?? defaultZenithColor;
    this.skyExponent = args.skyExponent ?? defaultExponent;
    this.groundExponent = args.groundExponent ?? defaultExponent;
  }

  /** Default settings for a four-color gradient. */
  public static readonly defaults = new SkyGradient({});

  /** Create a new gradient. Any properties not specified by `props` are initialized to their default values. */
  public static create(props?: Partial<SkyGradientProperties>): SkyGradient {
    return props ? new this(props) : this.defaults;
  }

  /** Create from JSON representation. */
  public static fromJSON(props?: SkyBoxProps): SkyGradient {
    if (!props)
      return this.defaults;

    return new this({
      twoColor: props.twoColor,
      skyExponent: props.skyExponent,
      groundExponent: props.groundExponent,
      skyColor: colorDefFromJson(props.skyColor),
      groundColor: colorDefFromJson(props.groundColor),
      nadirColor: colorDefFromJson(props.nadirColor),
      zenithColor: colorDefFromJson(props.zenithColor),
    });
  }

  /** Create ea copy of this gradient, identical except for any properties explicitly specified by `changedProps`.
   * Any properties of `changedProps` explicitly set to `undefined` will be reset to their default values.
   */
  public clone(changedProps: SkyGradientProperties): SkyGradient {
    return new SkyGradient({ ...this, ...changedProps });
  }

  /** Convert to JSON representation. */
  public toJSON(): SkyBoxProps {
    const props: SkyBoxProps = {
      skyColor: this.skyColor.toJSON(),
      groundColor: this.groundColor.toJSON(),
      nadirColor: this.nadirColor.toJSON(),
      zenithColor: this.zenithColor.toJSON(),
    };

    if (this.groundExponent !== defaultExponent)
      props.groundExponent = this.groundExponent;

    if (this.skyExponent !== defaultExponent)
      props.skyExponent = this.skyExponent;

    if (this.twoColor)
      props.twoColor = this.twoColor;

    return props;
  }

  /** Returns true if this gradient is equivalent to the supplied gradient. */
  public equals(other: SkyGradient): boolean {
    if (this === other)
      return true;

    return this.twoColor === other.twoColor && this.skyColor.equals(other.skyColor) && this.groundColor.equals(other.groundColor) &&
      this.zenithColor.equals(other.zenithColor) && this.nadirColor.equals(other.nadirColor);
  }
}

/** Describes how to draw a representation of a sky, as part of an [[Environment]].
 * @see [[SkyBoxProps]].
 * @public
 */
export class SkyBox {
  /** The gradient settings, used if no cube or sphere images are supplied, or if the images cannot be loaded. */
  public readonly gradient: SkyGradient;

  protected constructor(gradient: SkyGradient) {
    this.gradient = gradient;
  }

  /** Default settings for a four-color gradient. */
  public static readonly defaults = new SkyBox(SkyGradient.defaults);

  /** Create a skybox that displays the specified gradient, or the default gradient if none is supplied. */
  public static createGradient(gradient?: SkyGradient): SkyBox {
    return gradient ? new this(gradient) : this.defaults;
  }

  /** Create from JSON representation. */
  public static fromJSON(props?: SkyBoxProps): SkyBox {
    const gradient = SkyGradient.fromJSON(props);

    if (props?.image) {
      switch (props.image.type) {
        case SkyBoxImageType.Spherical:
          if (undefined !== props.image.texture)
            return new SkySphere(props.image.texture, gradient);

          break;
        case SkyBoxImageType.Cube: {
          const tx = props.image.textures;
          if (tx && undefined !== tx.top && undefined !== tx.bottom && undefined !== tx.right && undefined !== tx.left && undefined !== tx.front && undefined !== tx.back)
            return new SkyCube(tx, gradient);

          break;
        }
      }
    }

    return this.createGradient(gradient);
  }

  /** Convert to JSON representation.
   * @param display If defined, the value to use for [[SkyBoxProps.display]]; otherwise, that property will be left undefined.
   */
  public toJSON(display?: boolean): SkyBoxProps {
    const props = this.gradient.toJSON();
    if (undefined !== display)
      props.display = display;

    return props;
  }

  /** @internal */
  public get textureIds(): Iterable<Id64String> {
    return [];
  }
}

/** Describes how to draw a representation of a sky by mapping a single image to the interior of a sphere.
 * @public
 */
export class SkySphere extends SkyBox {
  /** The image to map to the interior of the sphere. */
  public readonly image: TextureImageSpec;

  /** Create a new sky sphere using the specified image.
   * @param image The image to map to the interior of the sphere.
   * @param gradient Optionally overrides the default gradient settings used if the image cannot be obtained.
   */
  public constructor(image: TextureImageSpec, gradient?: SkyGradient) {
    super(gradient ?? SkyGradient.defaults);
    this.image = image;
  }

  /** @internal override */
  public override toJSON(display?: boolean): SkyBoxProps {
    const props = super.toJSON(display);
    props.image = {
      type: SkyBoxImageType.Spherical,
      texture: this.image,
    };

    return props;
  }

  /** @internal */
  public override get textureIds(): Iterable<Id64String> {
    return Id64.isValidId64(this.image) ? [this.image] : [];
  }
}

/** Describes how to draw a representation of a sky by mapping images to the interior faces of a cube.
 * The images are required to be *square*, and each image must have the same dimensions as the other images.
 * @public
 */
export class SkyCube extends SkyBox {
  /** The images to map to each face of the cube. */
  public readonly images: SkyCubeProps;

  /** Create a new sky cube using the specified images.
   * @param images The images to map to each face of the cube.
   * @param Optionally overrides  the default gradient settings used if the images cannot be obtained.
   */
  public constructor(images: SkyCubeProps, gradient?: SkyGradient) {
    super(gradient ?? SkyGradient.defaults);
    this.images = { ...images };
  }

  /** @internal override */
  public override toJSON(display?: boolean): SkyBoxProps {
    const props = super.toJSON(display);
    props.image = {
      type: SkyBoxImageType.Cube,
      textures: { ...this.images },
    };

    return props;
  }

  /** @internal */
  public override get textureIds(): Iterable<Id64String> {
    const imgs = this.images;
    return [imgs.front, imgs.back, imgs.top, imgs.bottom, imgs.left, imgs.right].filter((x) => Id64.isValidId64(x));
  }
}
