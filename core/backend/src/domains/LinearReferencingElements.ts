/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64String, assert } from "@bentley/bentleyjs-core";
import {
  ElementProps, GeometricElement3dProps, LinearlyLocatedAttributionProps, LinearlyReferencedAtLocationProps,
  LinearlyReferencedAtLocationAspectProps, LinearlyReferencedFromToLocationProps, LinearlyReferencedFromToLocationAspectProps,
  ReferentElementProps, RelatedElement, IModelError, Code,
} from "@bentley/imodeljs-common";
import { PhysicalElement, SpatialLocationElement } from "../Element";
import { ElementAspect } from "../ElementAspect";
import { IModelDb } from "../IModelDb";
import { LinearlyReferencedAtLocation, LinearlyReferencedFromToLocation } from "./LinearReferencingElementAspects";
import {
  ILinearlyLocatedAlongILinearElement, ILinearlyLocatedAttributesElement, ILinearLocationLocatesElement,
  IReferentReferencesElement,
} from "./LinearReferencingRelationships";

/** Base class for Spatial Location Element subclasses representing properties whose value is located along a Linear-Element and only applies to a portion of an Element.
 * @beta
 */
export abstract class LinearlyLocatedAttribution extends SpatialLocationElement implements LinearlyLocatedAttributionProps {
  /** @internal */
  public static get className(): string { return "LinearlyLocatedAttribution"; }

  public attributedElement?: ILinearlyLocatedAttributesElement;

  public constructor(props: LinearlyLocatedAttributionProps, iModel: IModelDb) {
    super(props, iModel);
    this.attributedElement = RelatedElement.fromJSON(props.attributedElement);
  }
}

/** Base class for Spatial Location Element implementations that are linearly located along a Linear-Element.
 * @beta
 */
export abstract class LinearLocationElement extends SpatialLocationElement {
  /** @internal */
  public static get className(): string { return "LinearLocationElement"; }

  public constructor(props: GeometricElement3dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** Linear Referencing Location attached to an Element not inherently Linearly Referenced.
 * @beta
 */
export class LinearLocation extends LinearLocationElement {
  /** @internal */
  public static get className(): string { return "LinearLocation"; }
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) {
    super(props, iModel);
  }

  private static toProps(modelId: Id64String, categoryId: Id64String): GeometricElement3dProps {
    const props: GeometricElement3dProps = {
      classFullName: LinearLocation.classFullName,
      category: categoryId,
      model: modelId,
      code: Code.createEmpty(),
    };

    return props;
  }

  public static create(iModel: IModelDb, modelId: Id64String, categoryId: Id64String): LinearLocation {
    return new LinearLocation(this.toProps(modelId, categoryId), iModel);
  }

  public static insertFromTo(iModel: IModelDb, modelId: Id64String, categoryId: Id64String, linearElementId: Id64String,
    fromToPosition: LinearlyReferencedFromToLocationProps, locatedElementId: Id64String): Id64String {
    const newId = LinearlyLocated.insertFromTo(iModel, this.toProps(modelId, categoryId), linearElementId, fromToPosition);

    ILinearLocationLocatesElement.insert(iModel, newId, locatedElementId);

    return newId;
  }

  public insertFromTo(iModel: IModelDb, linearElementId: Id64String, fromToPosition: LinearlyReferencedFromToLocationProps, locatedElementId: Id64String): Id64String {
    const newId = LinearlyLocated.insertFromTo(iModel, this, linearElementId, fromToPosition);

    ILinearLocationLocatesElement.insert(iModel, newId, locatedElementId);

    return newId;
  }

  public static insertAt(iModel: IModelDb, modelId: Id64String, categoryId: Id64String, linearElementId: Id64String,
    atPosition: LinearlyReferencedAtLocationProps, locatedElementId: Id64String): Id64String {
    const newId = LinearlyLocated.insertAt(iModel, this.toProps(modelId, categoryId), linearElementId, atPosition);

    ILinearLocationLocatesElement.insert(iModel, newId, locatedElementId);

    return newId;
  }

  public insertAt(iModel: IModelDb, linearElementId: Id64String, atPosition: LinearlyReferencedAtLocationProps, locatedElementId: Id64String): Id64String {
    const newId = LinearlyLocated.insertAt(iModel, this, linearElementId, atPosition);

    ILinearLocationLocatesElement.insert(iModel, newId, locatedElementId);

    return newId;
  }
}

/** Base class for Physical Elements that are inherintly linearly located along a Linear-Element.
 * @beta
 */
export abstract class LinearPhysicalElement extends PhysicalElement {
  /** @internal */
  public static get className(): string { return "LinearPhysicalElement"; }

  public constructor(props: GeometricElement3dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** Spatial Location Element that can play the role of a Referent (known location along a Linear-Element).
 * @beta
 */
export abstract class ReferentElement extends SpatialLocationElement implements ReferentElementProps {
  /** @internal */
  public static get className(): string { return "ReferentElement"; }

  public referencedElement?: IReferentReferencesElement;

  public constructor(props: ReferentElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.referencedElement = RelatedElement.fromJSON(props.referencedElement);
  }
}

/** Referent-implementation turning any bis:SpatialElement not inherently Linearly-Referenced into a Referent for Linear-Referencing purposes.
 * @beta
 */
export class Referent extends ReferentElement {
  /** @internal */
  public static get className(): string { return "Referent"; }
  public constructor(props: ReferentElementProps, iModel: IModelDb) {
    super(props, iModel);
  }

  private static toProps(modelId: Id64String, categoryId: Id64String, referencedElementId: Id64String): ReferentElementProps {
    const props: ReferentElementProps = {
      classFullName: LinearLocation.classFullName,
      category: categoryId,
      model: modelId,
      code: Code.createEmpty(),
      referencedElement: new IReferentReferencesElement(referencedElementId),
    };

    return props;
  }

  public static create(iModel: IModelDb, modelId: Id64String, categoryId: Id64String, referencedElementId: Id64String): Referent {
    return new Referent(this.toProps(modelId, categoryId, referencedElementId), iModel);
  }

  public static insertAt(iModel: IModelDb, modelId: Id64String, categoryId: Id64String, linearElementId: Id64String,
    atPosition: LinearlyReferencedAtLocationProps, referencedElementId: Id64String): Id64String {
    return LinearlyLocated.insertAt(iModel, this.toProps(modelId, categoryId, referencedElementId), linearElementId, atPosition);
  }

  public insertAt(iModel: IModelDb, linearElementId: Id64String, atPosition: LinearlyReferencedAtLocationProps): Id64String {
    return LinearlyLocated.insertAt(iModel, this, linearElementId, atPosition);
  }
}

/** @beta */
export class LinearLocationReference {
  public constructor(
    public readonly startDistanceAlong: number,
    public readonly stopDistanceAlong: number,
    public readonly linearlyLocatedId: Id64String,
    public readonly linearlyLocatedClassFullName: string,
    public readonly locationAspectId: Id64String) {
  }
}

/** Enum capturing range-comparison options for from/to distanceAlong in QueryParams
 * @beta
 */
export enum ComparisonOption { Inclusive, Exclusive }

/** Enum enabling LinearElement.queryLinearLocations performance optimization when the target Linearly-Located classes are all either At or FromTo.
 * @beta
 */
export enum LinearlyReferencedLocationType { At, FromTo, Any }

/** @beta */
export class QueryParams {
  public constructor(
    public fromDistanceAlong?: number,
    public fromComparisonOption?: ComparisonOption,
    public toDistanceAlong?: number,
    public toComparisonOption?: ComparisonOption,
    public linearlyReferencedLocationTypeFilter?: LinearlyReferencedLocationType,
    public linearlyLocatedClassFullNames?: string[]) {
  }
}

abstract class ECSQLGenImpl {
  public abstract genSelect(): string;
  public selectDistinct(): boolean {
    return false;
  }
  public abstract genFromJoin(): string;
  public abstract genWhere(bindVals?: any[], from?: number, inclusiveFrom?: boolean, to?: number, inclusiveTo?: boolean): string;
  public abstract genOrderBy(): string;
}

class AtAndFromToECSQLGenImpl extends ECSQLGenImpl {
  public genSelect(): string {
    return "coalesce(AtLocation.AtPosition.DistanceAlongFromStart, FromToLocation.FromPosition.DistanceAlongFromStart) StartDistanceAlong, " +
      "coalesce(AtLocation.AtPosition.DistanceAlongFromStart, FromToLocation.ToPosition.DistanceAlongFromStart) StopDistanceAlong, " +
      "coalesce(AtLocation.ECInstanceId, FromToLocation.ECInstanceId) LocationAspectId ";
  }
  public selectDistinct(): boolean {
    return true;
  }
  public genFromJoin(): string {
    return "LEFT JOIN LinearReferencing.LinearlyReferencedAtLocation AtLocation ON LinearlyLocated.InstanceId = AtLocation.Element.Id " +
      "LEFT JOIN LinearReferencing.LinearlyReferencedFromToLocation FromToLocation ON LinearlyLocated.InstanceId = FromToLocation.Element.Id ";
  }
  public genWhere(bindVals: any[], from?: number, inclusiveFrom?: boolean, to?: number, inclusiveTo?: boolean): string {
    const fromCompOp: string = (inclusiveFrom === undefined || inclusiveFrom) ? ">=" : ">";
    const toCompOp: string = (inclusiveTo === undefined || inclusiveTo) ? "<=" : "<";

    let ecSql = "";
    if (from !== undefined && to !== undefined) {
      ecSql += "(AtLocation.AtPosition.DistanceAlongFromStart "; ecSql += fromCompOp;
      ecSql += " ? AND AtLocation.AtPosition.DistanceAlongFromStart "; ecSql += toCompOp;
      ecSql += " ?) OR (FromToLocation.FromPosition.DistanceAlongFromStart "; ecSql += fromCompOp;
      ecSql += " ? AND FromToLocation.FromPosition.DistanceAlongFromStart "; ecSql += toCompOp; ecSql += " ?) " +
        "OR (FromToLocation.ToPosition.DistanceAlongFromStart ";
      ecSql += fromCompOp;
      ecSql += " ? AND FromToLocation.ToPosition.DistanceAlongFromStart "; ecSql += toCompOp;
      ecSql += " ?) OR (FromToLocation.FromPosition.DistanceAlongFromStart <= ? AND FromToLocation.ToPosition.DistanceAlongFromStart >= ?) ";

      bindVals.push(from); bindVals.push(to);
      bindVals.push(from); bindVals.push(to);
      bindVals.push(from); bindVals.push(to);
      bindVals.push(from); bindVals.push(to);
    } else if (from !== undefined) {
      ecSql += "AtLocation.AtPosition.DistanceAlongFromStart "; ecSql += fromCompOp;
      ecSql += " ? OR FromToLocation.FromPosition.DistanceAlongFromStart "; ecSql += fromCompOp;
      ecSql += " ? OR FromToLocation.ToPosition.DistanceAlongFromStart "; ecSql += fromCompOp;
      ecSql += " ? ";

      bindVals.push(from);
      bindVals.push(from);
      bindVals.push(from);
    } else if (to !== undefined) {
      ecSql += "AtLocation.AtPosition.DistanceAlongFromStart "; ecSql += toCompOp;
      ecSql += " ? OR FromToLocation.FromPosition.DistanceAlongFromStart "; ecSql += toCompOp;
      ecSql += " ? OR FromToLocation.ToPosition.DistanceAlongFromStart "; ecSql += toCompOp; ecSql += " ? ";

      bindVals.push(to);
      bindVals.push(to);
      bindVals.push(to);
    } else {
      ecSql += "(AtLocation.AtPosition.DistanceAlongFromStart IS NOT NULL) OR ";
      ecSql += "(FromToLocation.FromPosition.DistanceAlongFromStart IS NOT NULL) ";
    }

    return ecSql;
  }
  public genOrderBy(): string {
    return "coalesce(AtLocation.AtPosition.DistanceAlongFromStart, FromToLocation.FromPosition.DistanceAlongFromStart)";
  }
}

class FromToECSQLGenImpl extends ECSQLGenImpl {
  public genSelect(): string {
    return "FromToLocation.FromPosition.DistanceAlongFromStart StartDistanceAlong, FromToLocation.ToPosition.DistanceAlongFromStart StopDistanceAlong, FromToLocation.ECInstanceId LocationAspectId ";
  }
  public genFromJoin(): string {
    return "INNER JOIN LinearReferencing.LinearlyReferencedFromToLocation FromToLocation ON LinearlyLocated.InstanceId = FromToLocation.Element.Id ";
  }
  public genWhere(bindVals: any[], from?: number, inclusiveFrom?: boolean, to?: number, inclusiveTo?: boolean): string {
    const fromCompOp: string = (inclusiveFrom === undefined || inclusiveFrom) ? ">=" : ">";
    const toCompOp: string = (inclusiveTo === undefined || inclusiveTo) ? "<=" : "<";

    let ecSql = "";
    if (from !== undefined && to !== undefined) {
      ecSql += "AND ((FromToLocation.FromPosition.DistanceAlongFromStart "; ecSql += fromCompOp;
      ecSql += " ? AND FromToLocation.FromPosition.DistanceAlongFromStart "; ecSql += toCompOp;
      ecSql += " ?) OR (FromToLocation.ToPosition.DistanceAlongFromStart "; ecSql += fromCompOp;
      ecSql += " ? AND FromToLocation.ToPosition.DistanceAlongFromStart "; ecSql += toCompOp;
      ecSql += " ?) OR (FromToLocation.FromPosition.DistanceAlongFromStart <= ? AND FromToLocation.ToPosition.DistanceAlongFromStart >= ?)) ";

      bindVals.push(from); bindVals.push(to);
      bindVals.push(from); bindVals.push(to);
      bindVals.push(from); bindVals.push(to);
    } else if (from !== undefined) {
      ecSql += "AND (FromToLocation.FromPosition.DistanceAlongFromStart "; ecSql += fromCompOp;
      ecSql += " ? OR FromToLocation.ToPosition.DistanceAlongFromStart "; ecSql += fromCompOp; ecSql += " ?)";

      bindVals.push(from); bindVals.push(from);
    } else if (to !== undefined) {
      ecSql += "AND (FromToLocation.FromPosition.DistanceAlongFromStart "; ecSql += toCompOp;
      ecSql += " ? OR FromToLocation.ToPosition.DistanceAlongFromStart "; ecSql += toCompOp; ecSql += " ?) ";

      bindVals.push(to); bindVals.push(to);
    } else {
      ecSql += "FromToLocation.FromPosition.DistanceAlongFromStart IS NOT NULL ";
    }

    return ecSql;
  }
  public genOrderBy(): string {
    return "FromToLocation.FromPosition.DistanceAlongFromStart";
  }
}

class AtECSQLGenImpl extends ECSQLGenImpl {
  public genSelect(): string {
    return "AtLocation.AtPosition.DistanceAlongFromStart StartDistanceAlong, AtLocation.AtPosition.DistanceAlongFromStart StopDistanceAlong, AtLocation.ECInstanceId LocationAspectId ";
  }
  public genFromJoin(): string {
    return "INNER JOIN LinearReferencing.LinearlyReferencedAtLocation AtLocation ON LinearlyLocated.InstanceId = AtLocation.Element.Id ";
  }
  public genWhere(bindVals: any[], from?: number, inclusiveFrom?: boolean, to?: number, inclusiveTo?: boolean): string {
    const fromCompOp: string = (inclusiveFrom === undefined || inclusiveFrom) ? ">=" : ">";
    const toCompOp: string = (inclusiveTo === undefined || inclusiveTo) ? "<=" : "<";

    let ecSql = "";
    if (from !== undefined && to !== undefined) {
      ecSql += "AtLocation.AtPosition.DistanceAlongFromStart "; ecSql += fromCompOp;
      ecSql += " ? AND AtLocation.AtPosition.DistanceAlongFromStart "; ecSql += toCompOp; ecSql += " ? ";

      bindVals.push(from); bindVals.push(to);
    } else if (from !== undefined) {
      ecSql += "AtLocation.AtPosition.DistanceAlongFromStart "; ecSql += fromCompOp; ecSql += " ? ";

      bindVals.push(from);
    } else if (to !== undefined) {
      ecSql += "AtLocation.AtPosition.DistanceAlongFromStart "; ecSql += toCompOp; ecSql += " ? ";

      bindVals.push(to);
    } else
      ecSql += "AtLocation.AtPosition.DistanceAlongFromStart IS NOT NULL ";

    return ecSql;
  }
  public genOrderBy(): string {
    return "AtLocation.AtPosition.DistanceAlongFromStart";
  }
}

class QueryLinearLocationsECSQLGen {
  private readonly _params: QueryParams;
  private _ecSql: string;

  private _addSelectClause(impl: ECSQLGenImpl): void {
    let select = "SELECT ";

    if (impl.selectDistinct())
      select += "DISTINCT ";

    select += "LinearlyLocated.InstanceId LinearlyLocatedId, printf('%s:%s', meta.ECSchemaDef.Name, meta.ECClassDef.Name) LinearlyLocatedClassFullName, ";
    select += impl.genSelect();

    this._ecSql += select;
  }

  private _parseClassFullName(classFullName: string): [string, string] | undefined {
    const parts = classFullName.split(":");
    if (parts.length !== 2)
      return undefined;

    return [parts[0], parts[1]];
  }

  private _genLinearlyLocated(): string {
    return "meta.ECSchemaDef JOIN meta.ECClassDef USING meta.SchemaOwnsClasses JOIN " +
      "(SELECT coalesce(Located.TargetECInstanceId, Along.SourceECInstanceId) InstanceId, " +
      "coalesce(Located.TargetECClassId, Along.SourceECClassId) ClassId " +
      "FROM LinearReferencing.ILinearlyLocatedAlongILinearElement Along LEFT JOIN " +
      "LinearReferencing.ILinearLocationLocatesElement Located ON Along.SourceECInstanceId = Located.SourceECInstanceId " +
      "WHERE Along.TargetECInstanceId = ?) LinearlyLocated ON meta.ECClassDef.ECInstanceId = LinearlyLocated.ClassId ";
  }

  private _addFromClause(impl: ECSQLGenImpl/*bvector<double>& bindVals*/): void {
    let from = "FROM ";
    from += this._genLinearlyLocated();
    from += impl.genFromJoin();

    this._ecSql += from;
  }

  private _addWhereClause(impl: ECSQLGenImpl, bindVals: any[]) {
    let where = "WHERE ";

    where += impl.genWhere(
      bindVals,
      this._params.fromDistanceAlong,
      (this._params.fromComparisonOption === undefined ||
        this._params.fromComparisonOption === ComparisonOption.Inclusive),
      this._params.toDistanceAlong,
      (this._params.toComparisonOption === undefined ||
        this._params.toComparisonOption === ComparisonOption.Inclusive));

    if (this._params.linearlyLocatedClassFullNames !== undefined) {
      if (where.length > 6)
        where += "AND ";

      if (1 === this._params.linearlyLocatedClassFullNames.length) {
        const classFullName = this._params.linearlyLocatedClassFullNames[0];
        const schemaNameClassName = this._parseClassFullName(classFullName);
        if (schemaNameClassName === undefined)
          throw new IModelError(0, "Invalid full class name");

        where += "meta.ECSchemaDef.Name ='" + schemaNameClassName[0] + "' AND meta.ECClassDef.Name = '" + schemaNameClassName[1] + "' ";
      } else if (1 < this._params.linearlyLocatedClassFullNames.length) {
        where += "(";
        for (const classFullName in this._params.linearlyLocatedClassFullNames) {
          if (classFullName === undefined)
            continue;

          const schemaNameClassName = this._parseClassFullName(classFullName);
          if (schemaNameClassName === undefined)
            continue;

          where += "(meta.ECSchemaDef.Name ='" + schemaNameClassName[0] + "' AND meta.ECClassDef.Name = '" + schemaNameClassName[1] + "') OR ";
        }

        where = where.substr(0, where.length - 4); // Removing last OR
        where += ") ";
      }
    }

    this._ecSql += where;
  }

  private _addOrderByClause(impl: ECSQLGenImpl): void {
    let orderBy = "ORDER BY ";
    orderBy += impl.genOrderBy();

    this._ecSql += orderBy;
  }

  private _createImpl(): ECSQLGenImpl {
    if (this._params.linearlyReferencedLocationTypeFilter === undefined ||
      this._params.linearlyReferencedLocationTypeFilter === LinearlyReferencedLocationType.Any) {
      return new AtAndFromToECSQLGenImpl();
    } else if (this._params.linearlyReferencedLocationTypeFilter === LinearlyReferencedLocationType.FromTo) {
      return new FromToECSQLGenImpl();
    } else {
      return new AtECSQLGenImpl();
    }
  }

  public constructor(params: QueryParams) {
    this._params = params;
    this._ecSql = "";
  }

  public generate(linearElementId: Id64String): [string, any[]] {
    this._ecSql = "";
    const impl = this._createImpl();

    const bindVals: any[] = [linearElementId];
    this._addSelectClause(impl);
    this._addFromClause(impl);
    this._addWhereClause(impl, bindVals);
    this._addOrderByClause(impl);

    return [this._ecSql, bindVals];
  }
}

/** A class offering services for LinearlyLocated elements.
 * @beta
 */
export class LinearlyLocated {
  private static insertBasic(iModel: IModelDb, elProps: ElementProps, linearElementId: Id64String): Id64String {
    const newId = iModel.elements.insertElement(elProps);

    const linearlyLocatedAlongLinearElement =
      ILinearlyLocatedAlongILinearElement.create(iModel, newId, linearElementId);
    linearlyLocatedAlongLinearElement.insert();

    return newId;
  }

  /** Insert a new LinearlyLocated element into an iModel at a specific location along an existing Linear-Element.
   * @param iModel The iModel to insert the new element into.
   * @param elProps The properties of the new element.
   * @param linearElementId The Id of the Linear-Element along which the new LinearlyLocated will be inserted.
   * @param atPosition Linear position.
   * @returns The newly inserted element's Id.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public static insertAt(iModel: IModelDb, elProps: ElementProps, linearElementId: Id64String,
    atPosition: LinearlyReferencedAtLocationProps): Id64String {
    const newId: Id64String = this.insertBasic(iModel, elProps, linearElementId);

    LinearlyReferencedAtLocation.insert(iModel, newId, atPosition.atPosition,
      (atPosition.fromReferent === undefined) ? undefined : atPosition.fromReferent.id);

    return newId;
  }

  /** Insert a new LinearlyLocated element into an iModel at a specific from-to location along an existing Linear-Element.
   * @param iModel The iModel to insert the new element into.
   * @param elProps The properties of the new element.
   * @param linearElementId The Id of the Linear-Element along which the new LinearlyLocated will be inserted.
   * @param fromToPosition Linear position.
   * @returns The newly inserted element's Id.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public static insertFromTo(iModel: IModelDb, elProps: ElementProps, linearElementId: Id64String,
    fromToPosition: LinearlyReferencedFromToLocationProps): Id64String {
    const newId: Id64String = this.insertBasic(iModel, elProps, linearElementId);

    LinearlyReferencedFromToLocation.insert(iModel, newId,
      fromToPosition.fromPosition, fromToPosition.toPosition,
      (fromToPosition.fromPositionFromReferent === undefined) ? undefined : fromToPosition.fromPositionFromReferent.id,
      (fromToPosition.toPositionFromReferent === undefined) ? undefined : fromToPosition.toPositionFromReferent.id);

    return newId;
  }

  private static getLinearLocations<T>(iModel: IModelDb, linearlyLocatedElementId: Id64String, fullClassName: string): T[] {
    const aspects: ElementAspect[] =
      iModel.elements.getAspects(linearlyLocatedElementId, fullClassName);

    if (aspects.length === 0)
      return [];

    const retVal: T[] = [];
    for (const aspect of aspects) {
      const linearAspect = (aspect as unknown) as T;
      retVal.push(linearAspect);
    }

    return retVal;
  }

  /** Query for LinearlyReferenced AtLocation aspects owned by the specified LinearlyLocated Element.
   * @param iModel The iModel to query from.
   * @param linearlyLocatedElementId The id of the LinearlyLocated Element to query aspects about.
   * @returns Returns an array of LinearlyReferencedAtLocationProps.
   * @throws [[IModelError]]
   */
  public static getAtLocations(iModel: IModelDb, linearlyLocatedElementId: Id64String): LinearlyReferencedAtLocationProps[] {
    return this.getLinearLocations<LinearlyReferencedAtLocationProps>(
      iModel, linearlyLocatedElementId, "LinearReferencing:LinearlyReferencedAtLocation");
  }

  /** Query for the single LinearlyReferenced AtLocation aspect owned by the specified LinearlyLocated Element. If more than one aspect is expected, use [[getAtLocations]] instead.
   * @param iModel The iModel to query from.
   * @param linearlyLocatedElementId The id of the LinearlyLocated Element to query about.
   * @returns Returns an LinearlyReferencedAtLocationProps.
   * @throws [[IModelError]]
   */
  public static getAtLocation(iModel: IModelDb, linearlyLocatedElementId: Id64String): LinearlyReferencedAtLocationProps | undefined {
    const linearLocations = this.getAtLocations(iModel, linearlyLocatedElementId);
    if (linearLocations.length === 0)
      return undefined;
    else {
      assert(linearLocations.length === 1);
      return linearLocations[0];
    }
  }

  /** Update an existing LinearlyReferencedAtLocation aspect within the iModel.
   * @param iModel The iModel to update.
   * @param linearLocationProps The properties to use to update the LinearlyReferencedAtLocation aspect.
   * @throws [[IModelError]]
   */
  public static updateAtLocation(iModel: IModelDb, linearLocationProps: LinearlyReferencedAtLocationAspectProps): void {
    iModel.elements.updateAspect(linearLocationProps);
  }

  /** Update an existing LinearlyReferencedFromToLocation aspect within the iModel.
   * @param iModel The iModel to update.
   * @param linearLocationProps The properties to use to update the LinearlyReferencedFromToLocation aspect.
   * @throws [[IModelError]]
   */
  public static updateFromToLocation(iModel: IModelDb, linearLocationProps: LinearlyReferencedFromToLocationAspectProps): void {
    iModel.elements.updateAspect(linearLocationProps);
  }

  /** Query for LinearlyReferenced FromToLocation aspects owned by the specified LinearlyLocated Element.
   * @param iModel The iModel to query from.
   * @param linearlyLocatedElementId The id of the LinearlyLocated Element to query aspects about.
   * @returns Returns an array of LinearlyReferencedFromToLocationProps.
   * @throws [[IModelError]]
   */
  public static getFromToLocations(iModel: IModelDb, linearlyLocatedElementId: Id64String): LinearlyReferencedFromToLocationProps[] {
    return this.getLinearLocations<LinearlyReferencedFromToLocationProps>(
      iModel, linearlyLocatedElementId, "LinearReferencing:LinearlyReferencedFromToLocation");
  }

  /** Query for the single LinearlyReferenced FromToLocation aspect owned by the specified LinearlyLocated Element. If more than one aspect is expected, use [[getFromToLocations]] instead.
   * @param iModel The iModel to query from.
   * @param linearlyLocatedElementId The id of the LinearlyLocated Element to query about.
   * @returns Returns an LinearlyReferencedFromToLocationProps.
   * @throws [[IModelError]]
   */
  public static getFromToLocation(iModel: IModelDb, linearlyLocatedElementId: Id64String): LinearlyReferencedFromToLocationProps | undefined {
    const linearLocations = this.getFromToLocations(iModel, linearlyLocatedElementId);
    if (linearLocations.length === 0)
      return undefined;
    else {
      assert(linearLocations.length === 1);
      return linearLocations[0];
    }
  }
}

/** A class offering services for linearly-located data along a Linear-Element.
 * @beta
 */
export class LinearElement {
  /** Query for LinearLocationReferences based on specified query parameters.
   * @returns Returns an array of LinearLocationReferences.
   * @throws [[IModelError]]
   */
  public static queryLinearLocations(iModel: IModelDb, linearElementId: Id64String, queryParams: QueryParams): LinearLocationReference[] {
    const ecSqlGen = new QueryLinearLocationsECSQLGen(queryParams);
    const ecsqlAndBindVals = ecSqlGen.generate(linearElementId);

    const rows = iModel.executeQuery(ecsqlAndBindVals[0], ecsqlAndBindVals[1]);
    if (rows.length === 0) {
      return [];
    }

    const linearLocationRefs: LinearLocationReference[] = [];
    for (const row of rows) {
      const linearLocationRef: LinearLocationReference = row;
      linearLocationRefs.push(linearLocationRef);
    }

    return linearLocationRefs;
  }
}
