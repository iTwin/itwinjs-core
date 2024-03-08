/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { CompressedId64Set, DbResult, Id64String, IModelStatus } from "@itwin/core-bentley";
import { Matrix3d, Matrix3dProps, Point3d, Range3d, Range3dProps, Transform, TransformProps } from "@itwin/core-geometry";
import { GeometricElement, IModelDb } from "@itwin/core-backend";
import { BRepEntity, EcefLocation, EcefLocationProps, ElementGeometry, ElementGeometryBuilderParams, ElementGeometryFunction, ElementGeometryInfo, ElementGeometryRequest, FilePropertyProps, GeometricElementProps, GeometryPartProps, IModelError } from "@itwin/core-common";
import { BasicManipulationCommandIpc, editorBuiltInCmdIds, FlatBufferGeometryFilter } from "@itwin/editor-common";
import { EditCommand } from "./EditCommand";

/** Implementation for a EditCommand command that provides basic creation and modification operations.
 * @beta
 */
export class BasicManipulationCommand extends EditCommand implements BasicManipulationCommandIpc {
  public static override commandId = editorBuiltInCmdIds.cmdBasicManipulation;

  public constructor(iModel: IModelDb, protected _str: string) { super(iModel); }

  public override async onStart() { return BasicManipulationCommand.commandId; }

  public async deleteElements(ids: CompressedId64Set): Promise<IModelStatus> {
    const idSet = CompressedId64Set.decompressSet(ids);
    await this.iModel.locks.acquireLocks({ exclusive: idSet });

    for (const id of idSet)
      this.iModel.elements.deleteElement(id);

    return IModelStatus.Success;
  }

  public async transformPlacement(ids: CompressedId64Set, transProps: TransformProps): Promise<IModelStatus> {
    const idSet = CompressedId64Set.decompressSet(ids);
    await this.iModel.locks.acquireLocks({ exclusive: idSet });

    const transform = Transform.fromJSON(transProps);

    for (const id of idSet) {
      const element = this.iModel.elements.getElement<GeometricElement>(id);

      if (!element.placement.isValid)
        continue; // Ignore assembly parents w/o geometry, etc...

      element.placement.multiplyTransform(transform);
      this.iModel.elements.updateElement(element.toJSON());
    }

    return IModelStatus.Success;
  }

  public async rotatePlacement(ids: CompressedId64Set, matrixProps: Matrix3dProps, aboutCenter: boolean): Promise<IModelStatus> {
    const idSet = CompressedId64Set.decompressSet(ids);
    await this.iModel.locks.acquireLocks({ exclusive: idSet });

    const matrix = Matrix3d.fromJSON(matrixProps);

    for (const id of idSet) {
      const element = this.iModel.elements.getElement<GeometricElement>(id);

      if (!element.placement.isValid)
        continue; // Ignore assembly parents w/o geometry, etc...

      const fixedPoint = aboutCenter ? element.placement.calculateRange().center : Point3d.createFrom(element.placement.origin);
      const transform = Transform.createFixedPointAndMatrix(fixedPoint, matrix);

      element.placement.multiplyTransform(transform);
      this.iModel.elements.updateElement(element.toJSON());
    }

    return IModelStatus.Success;
  }

  public async insertGeometricElement(props: GeometricElementProps): Promise<Id64String> {
    await this.iModel.locks.acquireLocks({ shared: props.model });

    return this.iModel.elements.insertElement(props);
  }

  public async insertGeometryPart(props: GeometryPartProps): Promise<Id64String> {
    await this.iModel.locks.acquireLocks({ shared: props.model });

    return this.iModel.elements.insertElement(props);
  }

  public async updateGeometricElement(propsOrId: GeometricElementProps | Id64String, data?: ElementGeometryBuilderParams): Promise<void> {
    let props: GeometricElementProps;
    if (typeof propsOrId === "string") {
      if (undefined === data)
        throw new IModelError(DbResult.BE_SQLITE_ERROR, "Flatbuffer data required for update by id");
      props = this.iModel.elements.getElementProps<GeometricElementProps>(propsOrId);
    } else {
      props = propsOrId;
    }

    if (undefined === props.id)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Element id required for update");

    await this.iModel.locks.acquireLocks({ exclusive: props.id });

    if (undefined !== data)
      props.elementGeometryBuilderParams = { entryArray: data.entryArray, viewIndependent: data.viewIndependent };

    this.iModel.elements.updateElement(props);
  }

  public async requestElementGeometry(elementId: Id64String, filter?: FlatBufferGeometryFilter): Promise<ElementGeometryInfo | undefined> {
    let accepted: ElementGeometryInfo | undefined;

    const onGeometry: ElementGeometryFunction = (info: ElementGeometryInfo): void => {
      accepted = info;

      if (undefined !== filter) {
        let numDisplayable = 0;

        for (const entry of info.entryArray) {
          if (!ElementGeometry.isDisplayableEntry(entry))
            continue;

          numDisplayable++;
          if (filter.maxDisplayable && numDisplayable > filter.maxDisplayable) {
            accepted = undefined;
            break;
          }

          if (filter.reject && filter.reject.some((opcode) => entry.opcode === opcode)) {
            accepted = undefined;
            break;
          }

          if (filter.accept && !filter.accept.some((opcode) => entry.opcode === opcode)) {
            accepted = undefined;
            break;
          }

          if (undefined === filter.geometry)
            continue;

          let entityType;
          if (filter.geometry.curves && !(filter.geometry.surfaces || filter.geometry.solids))
            entityType = ElementGeometry.isCurve(entry) ? BRepEntity.Type.Wire : undefined; // skip surface/solid opcodes...
          else
            entityType = ElementGeometry.getBRepEntityType(entry);

          switch (entityType) {
            case BRepEntity.Type.Wire:
              if (!filter.geometry.curves)
                accepted = undefined;
              break;
            case BRepEntity.Type.Sheet:
              if (!filter.geometry.surfaces)
                accepted = undefined;
              break;
            case BRepEntity.Type.Solid:
              if (!filter.geometry.solids)
                accepted = undefined;
              break;
            default:
              accepted = undefined;
              break;
          }

          if (undefined === accepted)
            break;
        }
      }
    };

    const requestProps: ElementGeometryRequest = {
      onGeometry,
      elementId,
    };

    if (IModelStatus.Success !== this.iModel.elementGeometryRequest(requestProps))
      return undefined;

    return accepted;
  }

  public async updateProjectExtents(extents: Range3dProps): Promise<void> {
    const newExtents = new Range3d();
    newExtents.setFromJSON(extents);

    if (newExtents.isNull)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Invalid project extents");

    await this.iModel.acquireSchemaLock();

    this.iModel.updateProjectExtents(newExtents);

    // Set source from calculated to user so connectors preserve the change.
    const unitsProps: FilePropertyProps = { name: "Units", namespace: "dgn_Db" };
    const unitsStr = this.iModel.queryFilePropertyString(unitsProps);

    if (undefined !== unitsStr) {
      const unitsVal = JSON.parse(unitsStr);
      const calculated = 1;

      if (calculated !== unitsVal.extentsSource) {
        unitsVal.extentsSource = calculated;
        this.iModel.saveFileProperty(unitsProps, JSON.stringify(unitsVal));
      }
    }
  }

  public async updateEcefLocation(ecefLocation: EcefLocationProps): Promise<void> {
    await this.iModel.acquireSchemaLock();

    // Clear GCS that caller already determined was invalid...
    this.iModel.deleteFileProperty({ name: "DgnGCS", namespace: "dgn_Db" });

    const newEcefLocation = new EcefLocation(ecefLocation);
    this.iModel.updateEcefLocation(newEcefLocation);
  }
}
