/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Effects
 */
import { dispose } from "@itwin/core-bentley";
import { Point3d, Point2d } from "@itwin/core-geometry";
import { RenderTexture, TextureTransparency } from "@itwin/core-common";
import {
  DecorateContext, Decorator, GraphicType, imageElementFromUrl, IModelApp, IModelConnection, ParticleCollectionBuilder, ParticleProps, Tool, Viewport
} from "@itwin/core-frontend";
import { randomInteger } from "./Random";

class Marker implements ParticleProps {
  /** Current position in the particle system's local coordinate space. */
  public readonly position: Point3d;
  /** Particle size in meters. */
  public readonly size: number;

  public get x() { return this.position.x; }
  public get y() { return this.position.y; }
  public get z() { return this.position.z; }

  public constructor(position: Point3d, size: number) {
    this.position = position;
    this.size = size;
  }
}

class MarkerDecorator implements Decorator {
  /** The viewport being decorated. */
  public readonly viewport: Viewport;
  /** Invoked when this decorator is to be destroyed. */
  public readonly dispose: VoidFunction;
  /** The initial width and height of the viewport, from which we randomly select each particle's initial position. */
  private readonly _dimensions: Point2d;
  /** The list of particles being drawn. */
  private readonly _markers: Marker[] = [];
  /** The image to display for each particle. */
  private _texture?: RenderTexture;

  private constructor(viewport: Viewport, texture: RenderTexture | undefined) {
    this.viewport = viewport;
    this._dimensions = new Point2d(viewport.viewRect.width, viewport.viewRect.height);
    this._texture = texture;

    // Tell the viewport to re-render the decorations every frame so that the snow particles animate smoothly.
    const removeOnRender = viewport.onRender.addListener(() => viewport.invalidateDecorations());

    // When the viewport is resized, replace this decorator with a new one to match the new dimensions.
    const removeOnResized = viewport.onResized.addListener(() => {
      // Transfer ownership of the texture to the new decorator.
      const tex = this._texture;
      this._texture = undefined;
      this.dispose();
      new MarkerDecorator(viewport, tex);
    });

    // When the viewport is destroyed, dispose of this decorator too.
    const removeOnDispose = viewport.onDisposed.addListener(() => this.dispose());
    const removeDecorator = IModelApp.viewManager.addDecorator(this);

    this.dispose = () => {
      removeDecorator();
      removeOnRender();
      removeOnDispose();
      removeOnResized();
      this._texture = dispose(this._texture);
      MarkerDecorator._decorators.delete(viewport);
    };

    MarkerDecorator._decorators.set(viewport, this);

    // Initialize the particles.
    this._markers.push(this.emit());
    this._markers.push(this.emit());
    this._markers.push(this.emit());
  }
  
  private emit(): Marker {
    const x = randomInteger(0, this._dimensions.x);
    const y = randomInteger(0, this._dimensions.y);

    return new Marker(new Point3d(x,y,0), 1);
  }

  public readonly useCachedDecorations = true;

  public decorate(context: DecorateContext): void {
    console.log("DECORATE");
    if (context.viewport !== this.viewport || !this._texture)
      return;

    // Create particle graphics.
    const builder = ParticleCollectionBuilder.create({
      viewport: this.viewport,
      texture: this._texture,
      size: 1,
    });

    for (const marker of this._markers){
      console.log("MARKER AT: ", marker.position);
      builder.addParticle(marker);
    }

    const graphic = builder.finish();
    if (graphic){
      console.log("Adding decoration");
      context.addDecoration(GraphicType.WorldDecoration, graphic);
    }
  }

  private static readonly _decorators = new Map<Viewport, MarkerDecorator>();

  public static async placeMarkers(viewport: Viewport): Promise<void> {
    const decorator = this._decorators.get(viewport);
    if (undefined === decorator) {
      // Create a texture to use for the particles.
      // Note: the decorator takes ownership of the texture, and disposes of it when the decorator is disposed.

      const xClipStart = 0;
      const yClipStart = 0;
      const clipWidth = 128;
      const clipHeight = 128;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = clipWidth;
      canvas.height = clipHeight;

      const textureAtlas = new Image();
      textureAtlas.src = `${IModelApp.publicPath}sprites/particle_textureatlas.png`;
      if (ctx) {
        textureAtlas.onload = async () => {
          console.log("LOAD");
          ctx.drawImage(textureAtlas, xClipStart, yClipStart, clipWidth, clipHeight, clipWidth, clipHeight, clipWidth, clipHeight);

          const subTexture = await imageElementFromUrl(canvas.toDataURL());
    
          const texture = IModelApp.renderSystem.createTexture({
            ownership: "external",
            image: { source: subTexture }
          });

          new MarkerDecorator(viewport, texture);
        };
      }
    }
  }
}
/** This tool applies a marker particle.
 * @beta
 */
export class MarkerEffect extends Tool {
  public static override toolId = "MarkerEffect";

  /** This method runs the tool, applying a marker particle. */
  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      await MarkerDecorator.placeMarkers(vp);

    return true;
  }
}
