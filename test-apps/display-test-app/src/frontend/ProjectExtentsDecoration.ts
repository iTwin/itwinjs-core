/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

// copied and highly modified from itwinjs-core: editor/frontend/src/ProjectLocation/ProjectExtentsDecoration.ts
import { BeDuration, BeEvent } from "@itwin/core-bentley";
import { ColorDef } from "@itwin/core-common";
import {
  BeButtonEvent,
  DecorateContext,
  EditManipulator,
  EventHandled,
  GraphicType,
  HitDetail,
  IModelApp,
  IModelConnection,
  QuantityType,
  ScreenViewport,
  ViewClipControlArrow,
  ViewClipDecorationProvider,
  ViewClipShapeModifyTool,
  ViewClipTool,
} from "@itwin/core-frontend";
import {
  ClipShape,
  ClipVector,
  Constant,
  Point3d,
  PolygonOps,
  Range1d,
  Range3d,
  Transform,
  Vector3d,
} from "@itwin/core-geometry";

function translateMessage(key: string) {
  return `ProjectLocation:Message.${key}`;
}
function translateMessageBold(key: string) {
  return `<b>${translateMessage(key)}:</b> `;
}
function clearViewClip(vp: ScreenViewport): boolean {
  if (!ViewClipTool.doClipClear(vp)) return false;
  ViewClipDecorationProvider.create().onClearClip(vp); // Send clear event...
  ViewClipDecorationProvider.clear();
  return true;
}

function clipToProjectExtents(vp: ScreenViewport): boolean {
  clearViewClip(vp); // Clear any existing view clip and send clear event...
  ViewClipTool.enableClipVolume(vp);
  return ViewClipTool.doClipToRange(
    vp,
    vp.iModel.projectExtents,
    Transform.createIdentity()
  );
}

class ProjectExtentsControlArrow extends ViewClipControlArrow {
  public extentValid = true;
}

/** Values for [[ProjectExtentsClipDecoration.onChanged] event.
 * @beta
 */
export enum ProjectLocationChanged {
  /** Extents has been modified (unsaved changes) */
  Extents,
  /** Abandon unsaved changes to extents */
  ResetExtents,
  /** Decoration shown (unsaved changes restored) */
  Show,
}

/** Controls to modify project extents shown using view clip
 * @beta
 */
export class ProjectExtentsClipDecoration extends EditManipulator.HandleProvider {
  private static _decorator?: ProjectExtentsClipDecoration;
  protected _clip?: ClipVector;
  protected _clipId?: string;
  protected _clipShape?: ClipShape;
  protected _clipShapeExtents?: Range1d;
  protected _clipRange?: Range3d;
  protected _extentsLengthValid = true;
  protected _extentsWidthValid = true;
  protected _extentsHeightValid = true;
  protected _hasValidGCS = false;
  protected _controlIds: string[] = [];
  protected _controls: ProjectExtentsControlArrow[] = [];
  protected _suspendDecorator = false;
  protected _removeViewCloseListener?: () => void;
  protected _initialProjectExtents?: Range3d;

  /** Called when project extents or geolocation is modified */
  public readonly onChanged = new BeEvent<
    (iModel: IModelConnection, ev: ProjectLocationChanged) => void
  >();

  public constructor(public viewport: ScreenViewport) {
    super(viewport.iModel);

    if (!this.init()) return;

    this._clipId = this.iModel.transientIds.getNext();

    this.start();
  }

  protected start(): void {
    this._initialProjectExtents = this.iModel.projectExtents;
    this.updateDecorationListener(true);
    this._removeViewCloseListener =
      IModelApp.viewManager.onViewClose.addListener((vp) =>
        this.onViewClose(vp)
      );
    if (this._clipId) this.iModel.selectionSet.replace(this._clipId); // Always select decoration on create...
  }

  protected override stop(): void {
    const selectedId =
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      undefined !== this._clipId && this.iModel.selectionSet.has(this._clipId)
        ? this._clipId
        : undefined;
    this._clipId = undefined; // Invalidate id so that decorator will be dropped...
    super.stop();
    if (undefined !== selectedId) this.iModel.selectionSet.remove(selectedId); // Don't leave decorator id in selection set...
    if (undefined !== this._removeViewCloseListener) {
      this._removeViewCloseListener();
      this._removeViewCloseListener = undefined;
    }
  }

  protected init(): boolean {
    return this.getClipData();
  }

  public onViewClose(vp: ScreenViewport): void {
    if (this.viewport === vp) ProjectExtentsClipDecoration.clear();
  }

  private getClipData(): boolean {
    this._clip =
      this._clipShape =
      this._clipShapeExtents =
      this._clipRange =
        undefined;
    const clip = this.viewport.view.getViewClip();
    if (undefined === clip) return false;

    const clipShape = ViewClipTool.isSingleClipShape(clip);
    if (undefined === clipShape) return false;

    if (
      5 !== clipShape.polygon.length ||
      undefined === clipShape.zLow ||
      undefined === clipShape.zHigh
    )
      return false; // Not a box, can't be project extents clip...

    if (
      undefined !== clipShape.transformFromClip &&
      !clipShape.transformFromClip.isIdentity
    )
      return false; // Not axis aligned, can't be project extents clip...

    this._clipShapeExtents = Range1d.createXX(clipShape.zLow, clipShape.zHigh);
    this._clipShape = clipShape;
    this._clip = clip;

    this._clipRange = Range3d.create();
    const shapePtsLo = ViewClipTool.getClipShapePoints(
      this._clipShape,
      this._clipShapeExtents.low
    );
    const shapePtsHi = ViewClipTool.getClipShapePoints(
      this._clipShape,
      this._clipShapeExtents.high
    );

    this._clipRange.extendArray(shapePtsLo);
    this._clipRange.extendArray(shapePtsHi);

    return true;
  }

  private ensureNumControls(numReqControls: number): void {
    const numCurrent = this._controlIds.length;
    if (numCurrent < numReqControls) {
      const transientIds = this.iModel.transientIds;
      for (let i: number = numCurrent; i < numReqControls; i++)
        this._controlIds[i] = transientIds.getNext();
    } else if (numCurrent > numReqControls) {
      this._controlIds.length = numReqControls;
    }
  }

  private createClipShapeControls(): boolean {
    if (undefined === this._clipShape || !this._clipShapeExtents) return false;

    const shapePtsLo = ViewClipTool.getClipShapePoints(
      this._clipShape,
      this._clipShapeExtents.low
    );
    const shapePtsHi = ViewClipTool.getClipShapePoints(
      this._clipShape,
      this._clipShapeExtents.high
    );
    const shapeArea = PolygonOps.centroidAreaNormal(shapePtsLo);
    if (undefined === shapeArea) return false;

    const numControls = shapePtsLo.length + 1; // Number of edge midpoints plus zLow and zHigh...
    this.ensureNumControls(numControls);

    for (let i: number = 0; i < numControls - 2; i++) {
      const midPtLo = shapePtsLo[i].interpolate(0.5, shapePtsLo[i + 1]);
      const midPtHi = shapePtsHi[i].interpolate(0.5, shapePtsHi[i + 1]);
      const faceCenter = midPtLo.interpolate(0.5, midPtHi);
      const edgeTangent = Vector3d.createStartEnd(
        shapePtsLo[i],
        shapePtsLo[i + 1]
      );
      const faceNormal = edgeTangent.crossProduct(shapeArea.direction);
      faceNormal.normalizeInPlace();
      this._controls[i] = new ProjectExtentsControlArrow(
        faceCenter,
        faceNormal,
        0.75
      );
      this._controls[i].extentValid = faceNormal.isParallelTo(
        Vector3d.unitX(),
        true
      )
        ? this._extentsLengthValid
        : this._extentsWidthValid;
    }

    this._controls[numControls - 2] = new ProjectExtentsControlArrow(
      shapeArea.origin,
      Vector3d.unitZ(-1.0),
      0.75,
      undefined,
      undefined,
      "zLow"
    );
    this._controls[numControls - 1] = new ProjectExtentsControlArrow(
      shapeArea.origin.plusScaled(
        Vector3d.unitZ(),
        shapePtsLo[0].distance(shapePtsHi[0])
      ),
      Vector3d.unitZ(),
      0.75,
      undefined,
      undefined,
      "zHigh"
    );
    this._controls[numControls - 2].extentValid = this._extentsHeightValid;
    this._controls[numControls - 1].extentValid = this._extentsHeightValid;

    return true;
  }

  /** Allow project extents for map projections to be larger since curvature of the earth is accounted for. */
  protected get maxExtentLength(): number {
    return (!this._hasValidGCS ? 20 : 350) * Constant.oneKilometer;
  }

  /** Impose some reasonable height limit for project extents. */
  protected get maxExtentHeight(): number {
    return 2 * Constant.oneKilometer;
  }

  protected hasValidGCS(): boolean {
    if (!this.iModel.isGeoLocated || this.iModel.noGcsDefined) return false;

    const gcs = this.iModel.geographicCoordinateSystem;
    if (undefined === gcs || undefined === gcs.horizontalCRS) return false; // A valid GCS ought to have horizontalCR defined...

    // Check for approximate GCS (such as from MicroStation's "From Placemark" tool) and allow it to be replaced...
    const hasValidId =
      undefined !== gcs.horizontalCRS.id && 0 !== gcs.horizontalCRS.id.length;
    const hasValidDescr =
      undefined !== gcs.horizontalCRS.description &&
      0 !== gcs.horizontalCRS.description.length;
    const hasValidProjection =
      undefined !== gcs.horizontalCRS.projection &&
      "AzimuthalEqualArea" !== gcs.horizontalCRS.projection.method;

    return hasValidId || hasValidDescr || hasValidProjection;
  }

  protected override async createControls(): Promise<boolean> {
    // Always update to current view clip to handle post-modify, etc.
    if (undefined === this._clipId || !this.getClipData()) return false;

    this._hasValidGCS = this.hasValidGCS();

    if (undefined !== this._clipRange) {
      this._extentsLengthValid =
        this._clipRange.xLength() < this.maxExtentLength;
      this._extentsWidthValid =
        this._clipRange.yLength() < this.maxExtentLength;
      this._extentsHeightValid =
        this._clipRange.zLength() < this.maxExtentHeight;
    }

    // Note: Keeping this code commented out in case it needs to be restored but the hope is to always show the controls

    // Show controls if only range box and it's controls are selected, selection set doesn't include any other elements...
    // let showControls = false;
    // if (this.iModel.selectionSet.size <= this._controlIds.length + 1 && this.iModel.selectionSet.has(this._clipId)) {
    //   showControls = true;
    //   if (this.iModel.selectionSet.size > 1) {
    //     this.iModel.selectionSet.elements.forEach((val) => {
    //       if (this._clipId !== val && !this._controlIds.includes(val))
    //         showControls = false;
    //     });
    //   }
    // }

    // if (!showControls)
    //   return false; // Don't clear decoration on de-select...

    return this.createClipShapeControls();
  }

  protected override clearControls(): void {
    this.iModel.selectionSet.remove(this._controlIds); // Remove any selected controls as they won't continue to be displayed...
    super.clearControls();
  }

  protected async modifyControls(
    hit: HitDetail,
    _ev: BeButtonEvent
  ): Promise<boolean> {
    if (undefined === this._clip || hit.sourceId === this._clipId) return false;

    const saveQualifiers = IModelApp.toolAdmin.currentInputState.qualifiers;
    if (undefined !== this._clipShape) {
      const clipShapeModifyTool = new ViewClipShapeModifyTool(
        this,
        this._clip,
        this.viewport,
        hit.sourceId,
        this._controlIds,
        this._controls
      );
      this._suspendDecorator = await clipShapeModifyTool.run();
    }

    if (this._suspendDecorator)
      IModelApp.toolAdmin.currentInputState.qualifiers = saveQualifiers; // onInstallTool cleared qualifiers, preserve for "modify all" behavior when shift was held and drag started...

    return this._suspendDecorator;
  }

  protected override async onTouchTap(
    hit: HitDetail,
    ev: BeButtonEvent
  ): Promise<EventHandled> {
    return hit.sourceId === this._clipId
      ? EventHandled.No
      : super.onTouchTap(hit, ev);
  }

  public override onManipulatorEvent(
    eventType: EditManipulator.EventType
  ): void {
    // Note: call super.onManipulatorEvent before firing the onChanged event to ensure the modified extents are updated
    this._suspendDecorator = false;
    super.onManipulatorEvent(eventType);
    if (EditManipulator.EventType.Accept === eventType)
      this.onChanged.raiseEvent(this.iModel, ProjectLocationChanged.Extents);
  }

  protected getEditExtentsWarningMessage = (): string => {
    const warningRgbColor = `rgb(255 138 0)`;
    const alignmentStyle = `vertical-align:middle;display-inline:block`;
    const warningSvgIcon = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width="1rem" height="1rem" style="${alignmentStyle}"><path d="M15.868 13.267l-6.77-11.62a1.15 1.15 0 00-1.1-.67 1.17 1.17 0 00-1.1.69l-6.77 11.59a1.2 1.2 0 001.1 1.72h13.45a1.237 1.237 0 001.306-1.06 1.19 1.19 0 00-.116-.65zm-6.87-.29h-2v-2h2zm0-3h-2v-5h2z" fill="${warningRgbColor}"/></svg>`;
    return `${warningSvgIcon} <b style="color:${warningRgbColor};${alignmentStyle}"> ${translateMessage(
      "LargeProjectExtents"
    )}</b>`;
  };

  protected shouldWarningMessageBeShown = (
    arrowDirection: Vector3d
  ): boolean => {
    return (
      (arrowDirection.isParallelTo(Vector3d.unitX(), true) &&
        !this._extentsLengthValid) ||
      (arrowDirection.isParallelTo(Vector3d.unitY(), true) &&
        !this._extentsWidthValid) ||
      (arrowDirection.isParallelTo(Vector3d.unitZ(), true) &&
        !this._extentsHeightValid)
    );
  };

  public async getDecorationToolTip(
    hit: HitDetail
  ): Promise<HTMLElement | string> {
    const quantityFormatter = IModelApp.quantityFormatter;
    const toolTip = document.createElement("div");
    let toolTipHtml = "";
    const extentsValid =
      this._extentsLengthValid &&
      this._extentsWidthValid &&
      this._extentsHeightValid;

    if (hit.sourceId === this._clipId) {
      toolTipHtml += `${
        extentsValid
          ? translateMessage("ProjectExtents")
          : this.getEditExtentsWarningMessage()
      }<br>`;

      const distanceFormatterSpec =
        quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
      if (
        undefined !== distanceFormatterSpec &&
        undefined !== this._clipRange
      ) {
        const formattedLength = quantityFormatter.formatQuantity(
          this._clipRange.xLength(),
          distanceFormatterSpec
        );
        const formattedWidth = quantityFormatter.formatQuantity(
          this._clipRange.yLength(),
          distanceFormatterSpec
        );
        const formattedHeight = quantityFormatter.formatQuantity(
          this._clipRange.zLength(),
          distanceFormatterSpec
        );
        toolTipHtml += `${
          translateMessageBold("Length") + formattedLength
        }<br>`;
        toolTipHtml += `${translateMessageBold("Width") + formattedWidth}<br>`;
        toolTipHtml += `${
          translateMessageBold("Height") + formattedHeight
        }<br>`;
      }
    } else {
      const arrowIndex = this._controlIds.indexOf(hit.sourceId);
      if (-1 !== arrowIndex) {
        const arrowControl = this._controls[arrowIndex];
        toolTipHtml += `${
          this.shouldWarningMessageBeShown(arrowControl.direction)
            ? this.getEditExtentsWarningMessage()
            : translateMessage("ModifyProjectExtents")
        }<br>`;

        const distanceFormatterSpec =
          quantityFormatter.findFormatterSpecByQuantityType(
            QuantityType.Length
          );
        if (
          undefined !== distanceFormatterSpec &&
          undefined !== this._clipRange
        ) {
          let arrowLabel = "";
          let arrowLength = 0.0;
          let arrowLengthMax = 0.0;

          if (arrowControl.direction.isParallelTo(Vector3d.unitX(), true)) {
            arrowLabel = "Length";
            arrowLength = this._clipRange.xLength();
            if (!this._extentsLengthValid)
              arrowLengthMax = this.maxExtentLength;
          } else if (
            arrowControl.direction.isParallelTo(Vector3d.unitY(), true)
          ) {
            arrowLabel = "Width";
            arrowLength = this._clipRange.yLength();
            if (!this._extentsWidthValid) arrowLengthMax = this.maxExtentLength;
          } else {
            arrowLabel = "Height";
            arrowLength = this._clipRange.zLength();
            if (!this._extentsHeightValid)
              arrowLengthMax = this.maxExtentHeight;

            const coordFormatterSpec = this.iModel.isGeoLocated
              ? quantityFormatter.findFormatterSpecByQuantityType(
                  QuantityType.Coordinate
                )
              : undefined;
            if (undefined !== coordFormatterSpec) {
              const heightPt =
                "zLow" === arrowControl.name
                  ? this._clipRange.low
                  : this._clipRange.high;
              const cartographic =
                this.iModel.spatialToCartographicFromEcef(heightPt);
              const formattedAltitude = quantityFormatter.formatQuantity(
                cartographic.height,
                coordFormatterSpec
              );
              toolTipHtml += `${
                translateMessageBold("Altitude") + formattedAltitude
              }<br>`;
            }
          }

          const formattedLength = quantityFormatter.formatQuantity(
            arrowLength,
            distanceFormatterSpec
          );
          toolTipHtml += `${
            translateMessageBold(arrowLabel) + formattedLength
          }<br>`;

          if (0.0 !== arrowLengthMax) {
            const formattedMaxLength = quantityFormatter.formatQuantity(
              arrowLengthMax,
              distanceFormatterSpec
            );
            toolTipHtml += `${
              translateMessageBold("MaxExtent") + formattedMaxLength
            }<br>`;
          }
        }
      }
    }

    toolTip.innerHTML = toolTipHtml;
    return toolTip;
  }

  public testDecorationHit(id: string): boolean {
    return id === this._clipId || this._controlIds.includes(id);
  }
  protected override updateDecorationListener(_add: boolean): void {
    super.updateDecorationListener(undefined !== this._clipId);
  } // Decorator isn't just for resize controls...

  private getCustomArrow(
    baseStart: number = 0.0,
    baseWidth: number = 0.3,
    tipStart: number = baseWidth / 2
  ): Point3d[] {
    const shapePts: Point3d[] = [];
    shapePts[0] = Point3d.create(tipStart, 0);
    shapePts[1] = Point3d.create(baseStart, baseWidth);
    shapePts[2] = Point3d.create(tipStart * 3, 0);
    shapePts[3] = Point3d.create(baseStart, -baseWidth);
    shapePts[4] = shapePts[0].clone();
    return shapePts;
  }

  public override decorate(context: DecorateContext): void {
    if (this._suspendDecorator) return;

    if (
      undefined === this._clipId ||
      undefined === this._clipShape ||
      undefined === this._clipRange
    )
      return;

    const vp = context.viewport;
    if (this.viewport !== vp) return;

    const maxSizeInches =
      (this._clipRange.maxLength() /
        vp.viewingSpace.getPixelSizeAtPoint(this._clipRange.center) /
        vp.pixelsPerInch) *
      0.5; // Display size limit when zooming out...
    if (maxSizeInches < 0.5) return;

    if (this._clipShapeExtents)
      ViewClipTool.drawClipShape(
        context,
        this._clipShape,
        this._clipShapeExtents,
        ColorDef.white.adjustedForContrast(
          context.viewport.view.backgroundColor
        ),
        3,
        this._clipId
      );

    const outlineColor = ColorDef.white;
    const fillVisColor = ColorDef.black;
    const fillHidColor = fillVisColor.withAlpha(200);
    const fillSelColor = fillVisColor.inverse().withAlpha(75);
    const shapePts = this.getCustomArrow();

    for (let iFace = 0; iFace < this._controlIds.length; iFace++) {
      const sizeInches = Math.min(
        this._controls[iFace].sizeInches,
        maxSizeInches
      );
      if (0.0 === sizeInches) continue;

      const anchorRay = ViewClipTool.getClipRayTransformed(
        this._controls[iFace].origin,
        this._controls[iFace].direction,
        undefined !== this._clipShape
          ? this._clipShape.transformFromClip
          : undefined
      );
      const transform = EditManipulator.HandleUtils.getArrowTransform(
        vp,
        anchorRay.origin,
        anchorRay.direction,
        sizeInches
      );
      if (undefined === transform) continue;

      // deep copies because we're using a builder transform w/addLineString...
      const visPts = shapePts.map((pt) => pt.clone());
      const hidPts = shapePts.map((pt) => pt.clone());

      const arrowVisBuilder = context.createGraphicBuilder(
        GraphicType.WorldOverlay,
        transform,
        this._controlIds[iFace]
      );
      const arrowHidBuilder = context.createGraphicBuilder(
        GraphicType.WorldDecoration,
        transform
      );
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const isSelected = this.iModel.selectionSet.has(this._controlIds[iFace]);

      let outlineColorOvr = this._controls[iFace].outline;
      if (undefined !== outlineColorOvr) {
        outlineColorOvr = outlineColorOvr.adjustedForContrast(
          vp.view.backgroundColor
        );
        outlineColorOvr = outlineColorOvr.withAlpha(outlineColor.getAlpha());
      } else {
        outlineColorOvr = outlineColor;
      }

      const fillVisColorOvr = this._controls[iFace].extentValid
        ? this._controls[iFace].fill
        : EditManipulator.HandleUtils.adjustForBackgroundColor(
            ColorDef.from(255, 138, 0),
            vp
          );

      arrowVisBuilder.setSymbology(
        outlineColorOvr,
        outlineColorOvr,
        isSelected ? 10 : 6
      );
      arrowVisBuilder.addLineString(visPts);
      arrowVisBuilder.setBlankingFill(
        isSelected ? fillSelColor : fillVisColorOvr ?? fillVisColor
      );
      arrowVisBuilder.addShape(visPts);
      context.addDecorationFromBuilder(arrowVisBuilder);

      arrowHidBuilder.setSymbology(fillHidColor, fillHidColor, 1);
      arrowHidBuilder.addShape(hidPts);
      context.addDecorationFromBuilder(arrowHidBuilder);
    }
  }

  public resetViewClip(): boolean {
    if (!clearViewClip(this.viewport)) return false;

    if (undefined !== this.getModifiedExtents())
      this.onChanged.raiseEvent(
        this.iModel,
        ProjectLocationChanged.ResetExtents
      );

    return true;
  }

  public getClipRange(): Range3d | undefined {
    return this._clipRange;
  }

  public getModifiedExtents(): Range3d | undefined {
    return this._initialProjectExtents &&
      this._clipRange?.isAlmostEqual(this._initialProjectExtents)
      ? undefined
      : this._clipRange;
  }

  public fitExtents(): void {
    if (undefined === this._clipRange) return undefined;

    const options = {
      animateFrustumChange: true,
      animationTime: BeDuration.fromSeconds(2).milliseconds,
    };
    const aspect = this.viewport.viewRect.aspect;
    this.viewport.view.lookAtVolume(this._clipRange, aspect);
    this.viewport.synchWithView(options);
    this.viewport.viewCmdTargetCenter = undefined;
  }

  public static get(): ProjectExtentsClipDecoration | undefined {
    return ProjectExtentsClipDecoration._decorator;
  }

  public static show(vp: ScreenViewport, fitExtents = true): boolean {
    if (!vp.view.isSpatialView()) return false;

    if (undefined !== ProjectExtentsClipDecoration._decorator) {
      const deco = ProjectExtentsClipDecoration._decorator;
      if (
        vp === deco.viewport &&
        undefined !== deco._clipId &&
        undefined !== deco._clip
      ) {
        if (deco._clip !== vp.view.getViewClip()) {
          clearViewClip(vp);
          ViewClipTool.enableClipVolume(vp);
          ViewClipTool.setViewClip(vp, deco._clip);
        }
        if (undefined === deco._removeManipulatorToolListener) {
          deco._removeManipulatorToolListener =
            IModelApp.toolAdmin.manipulatorToolEvent.addListener(
              (tool, event) => deco.onManipulatorToolEvent(tool, event)
            );
          deco.start();
          deco.onChanged.raiseEvent(deco.iModel, ProjectLocationChanged.Show);
        }
        return true;
      }
      ProjectExtentsClipDecoration.clear();
    }

    if (!clipToProjectExtents(vp)) return false;

    ProjectExtentsClipDecoration._decorator = new ProjectExtentsClipDecoration(
      vp
    );
    if (fitExtents) ProjectExtentsClipDecoration._decorator.fitExtents();
    vp.onChangeView.addOnce(() => this.clear(false));
    return undefined !== ProjectExtentsClipDecoration._decorator._clipId;
  }

  public static clear(clearClip = true): void {
    if (undefined === ProjectExtentsClipDecoration._decorator) return;
    if (clearClip) ProjectExtentsClipDecoration._decorator.resetViewClip(); // Clear project extents view clip...
    ProjectExtentsClipDecoration._decorator.stop();
    ProjectExtentsClipDecoration._decorator = undefined;
  }
}
