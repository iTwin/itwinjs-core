/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { NonFunctionPropertiesOf } from "@itwin/core-bentley";
import { ColorDef, ColorDefProps } from "./ColorDef";
import { TextureImageSpec } from "./RenderTexture";

/** Enumerates the supported types of [SkyBox]($frontend) images.
 * @public
 */
export enum SkyBoxImageType {
  None,
  /** A single image mapped to the surface of a sphere. @see [SkySphere]($frontend) */
  Spherical,
  /** 6 images mapped to the faces of a cube. @see [SkyCube]($frontend) */
  Cube,
  /** @internal not yet supported */
  Cylindrical,
}

/** JSON representation of a set of images used by a [SkyCube]($frontend). Each property specifies the element ID of a texture associated with one face of the cube.
 * @public
 */
export interface SkyCubeProps {
  /** Id of a persistent texture element stored in the iModel to use for the front side of the skybox cube. */
  front: TextureImageSpec;
  /** Id of a persistent texture element stored in the iModel to use for the back side of the skybox cube. */
  back: TextureImageSpec;
  /** Id of a persistent texture element stored in the iModel to use for the top of the skybox cube. */
  top: TextureImageSpec;
  /** Id of a persistent texture element stored in the iModel to use for the bottom of the skybox cube. */
  bottom: TextureImageSpec;
  /** Id of a persistent texture element stored in the iModel to use for the right side of the skybox cube. */
  right: TextureImageSpec;
  /** Id of a persistent texture element stored in the iModel to use for the left side of the skybox cube. */
  left: TextureImageSpec;
}

export interface SkySphereImageProps {
  type: SkyBoxImageType.Spherical;
  texture: TextureImageSpec;
}

export interface SkyCubeImageProps {
  type: SkyBoxImageType.Cube;
  textures: SkyCubeProps;
}

export type SkyBoxImageProps = SkySphereImageProps | SkyCubeImageProps | { type?: SkyBoxImageType; texture?: never; textures?: never };

/** JSON representation of a [SkyBox]($frontend) that can be drawn as the background of a [ViewState3d]($frontend).
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
  /** For a [SkyGradient]($frontend), if true, a 2-color gradient skybox is used instead of a 4-color.
   * Default: false.
   */
  twoColor?: boolean;
  /** The color of the sky at the horizon. Unused unless this is a four-color [SkyGradient]($frontend).
   * Default: (143, 205, 255).
   */
  skyColor?: ColorDefProps;
  /** The color of the ground at the horizon. Unused unless this is a four-color [SkyGradient]($frontend).
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
  /** For a 4-color [SkyGradient]($frontend), controls speed of change from sky color to zenith color; otherwise unused.
   * Default: 4.0.
   */
  skyExponent?: number;
  /** For a 4-color [SkyGradient]($frontend), controls speed of change from ground color to nadir color; otherwise unused.
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
  return props ? ColorDef.fromJSON(props) : undefined;
}

export type SkyGradientProperties = NonFunctionPropertiesOf<SkyGradient>;

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

  public static readonly defaults = new SkyGradient({});

  public static create(props?: Partial<SkyGradientProperties>): SkyGradient {
    return props ? new this(props) : this.defaults;
  }

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

  public clone(changedProps: SkyGradientProperties): SkyGradient {
    return new SkyGradient({ ...this, ...changedProps });
  }

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
      props.skyExponent = defaultExponent;

    if (this.twoColor)
      props.twoColor = this.twoColor;

    return props;
  }

  public equals(other: SkyGradient): boolean {
    if (this === other)
      return true;

    return this.twoColor === other.twoColor && this.skyColor.equals(other.skyColor) && this.groundColor.equals(other.groundColor) &&
      this.zenithColor.equals(other.zenithColor) && this.nadirColor.equals(other.nadirColor);
  }
}

export type SkyBoxProperties = NonFunctionPropertiesOf<SkyBox>;

export class SkyBox {
  public readonly gradient: SkyGradient;

  protected constructor(gradient: SkyGradient) {
    this.gradient = gradient;
  }

  public static readonly defaults = new SkyBox(SkyGradient.defaults);

  public static createGradient(gradient?: SkyGradient): SkyBox {
    return gradient ? new this(gradient) : this.defaults;
  }

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
          if (tx && undefined !== tx.top && undefined !== tx.bottom && undefined !== tx.right && undefined !== tx.left && undefined !== tx.front && undefined != tx.back)
            return new SkyCube(tx, gradient);

          break;
        }
      }
    }

    return this.createGradient(gradient);
  }

  public toJSON(display?: boolean): SkyBoxProps {
    const props = this.gradient.toJSON();
    if (undefined !== display)
      props.display = display;

    return props;
  }
}

export class SkySphere extends SkyBox {
  public readonly image: TextureImageSpec;

  public constructor(image: TextureImageSpec, gradient?: SkyGradient) {
    super(gradient ?? SkyGradient.defaults);
    this.image = image;
  }

  public override toJSON(display?: boolean): SkyBoxProps {
    const props = super.toJSON(display);
    props.image = {
      type: SkyBoxImageType.Spherical,
      texture: this.image,
    };

    return props;
  }
}

export class SkyCube extends SkyBox {
  public readonly images: SkyCubeProps;

  public constructor(images: SkyCubeProps, gradient?: SkyGradient) {
    super(gradient ?? SkyGradient.defaults);
    this.images = { ...images };
  }

  public override toJSON(display?: boolean): SkyBoxProps {
    const props = super.toJSON(display);
    props.image = {
      type: SkyBoxImageType.Cube,
      textures: { ...this.images },
    };

    return props;
  }
}
