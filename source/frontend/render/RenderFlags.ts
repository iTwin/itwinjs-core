/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

// Ordered list of render passes which produce a rendered frame.
export const enum RenderPass {
    None = 0xff,
    Background = 0,
    OpaqueLinear,       // Linear geometry that is opaque and needs to be written to the pick data buffers
    OpaquePlanar,       // Planar surface geometry that is opaque and needs to be written to the pick data buffers
    OpaqueGeneral,      // All other opaque geometry (including point clouds and reality meshes) which are not written to the pick data buffers
    Translucent,
    HiddenEdge,
    Hilite,
    WorldOverlay,
    ViewOverlay,
    COUNT,
}

// Defines the order in which primitives are rendered within a GLESList. This is chiefly
// used to sort primitives which originate from the same element. e.g., the blanking fill
// associated with a text field must always render behind the text; the edges of a surface
// must render in front of the surface; etc.
// An exception to the 'same element' rule is provided for planar surfaces and edges thereof
// sketched onto non-planar surfaces. When the depth test is ambiguous the planar geometry
// is always on top of the non-planar surface. This addresses z-fighting when shapes are
// sketched onto surfaces, e.g. as part of push-pull modeling workflows.
export const enum RenderOrder {
    None = 0,
    BlankingRegion = 1,
    Surface = 2,
    Linear = 3,
    Edge = 4,
    Silhouette = 5,

    PlanarBit = 8,

    PlanarSurface = Surface | PlanarBit,
    PlanarLinear = Linear | PlanarBit,
    PlanarEdge = Edge | PlanarBit,
    PlanarSilhouette = Silhouette | PlanarBit,
}

export function isPlanar(order: RenderOrder): boolean { return order >= RenderOrder.PlanarBit; }

export function isSurface(order: RenderOrder): boolean { return order <= RenderOrder.Surface || order === RenderOrder.PlanarSurface; }

// Flags indicating operations to be performed by the post-process composite step.
export const enum CompositeFlags {
    None = 0,
    Translucent = 1 << 0,
    Hilite = 1 << 1,
    All = Translucent | Hilite,
}

// Describes attributes of a MeshGeometry object. Used to conditionally execute portion of shader programs.
export const enum SurfaceFlags {
    None = 0,
    HasTexture = 1 << 0,
    ApplyLighting = 1 << 1,
    HasNormals = 1 << 2,

    // NB: In u_surfaceFlags provided to shader, indicates material color/specular/alpha should be ignored. Has no effect on texture.
    // If a given feature has the 'ignore material' override set, v_surfaceFlags will be modified to turn on IgnoreMaterial and turn off HasTexture.
    IgnoreMaterial = 1 << 3,

    // In HiddenLine and SolidFill modes, a transparency threshold is supplied; surfaces that are more transparent than the threshold are not rendered.
    TransparencyThreshold = 1 << 4,

    // For HiddenLine mode
    BackgroundFill = 1 << 5,
}

export const enum OvrFlags {
    None = 0,
    Visibility = 1 << 0,
    Rgb = 1 << 1,
    Alpha = 1 << 2,
    Weight = 1 << 3,
    Flashed = 1 << 4,
    Hilited = 1 << 5,
    LineCode = 1 << 6,
    IgnoreMaterial = 1 << 7, // ignore material color, specular properties, and texture

    Rgba = Rgb | Alpha,
}

export const enum IsTranslucent { No, Yes, Maybe }
