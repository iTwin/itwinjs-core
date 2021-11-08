/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { BeEvent, IDisposable, isIDisposable } from "@itwin/core-bentley";
import { QueryRowFormat } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { ClassId, Field, NestedContentField, PropertiesField } from "@itwin/presentation-common";
import { IFavoritePropertiesStorage } from "./FavoritePropertiesStorage";

/**
 * Scopes that favorite properties can be stored in.
 * @public
 */
export enum FavoritePropertiesScope {
  Global,
  ITwin,
  IModel,
}

/**
 * Format:
 * Regular property - [{path from parent class}-]{schema name}:{class name}:{property name}.
 * Nested property - [{path from parent class}-]{content class schema name}:{content class name}.
 * Primitive property - {field name}.
 * @public
 */
export type PropertyFullName = string;

/**
 * Holds the information of favorite properties ordering.
 * @public
 */
export interface FavoritePropertiesOrderInfo {
  parentClassName: string | undefined;
  name: PropertyFullName;
  priority: number;
  orderedTimestamp: Date;
}

/**
 * Properties for initializing [[FavoritePropertiesManager]]
 * @public
 */
export interface FavoritePropertiesManagerProps {
  /**
   * Implementation of a persistence layer for storing favorite properties and their order.
   * @public
   */
  storage: IFavoritePropertiesStorage;
}

/**
 * The favorite property manager which lets to store favorite properties
 * and check if field contains favorite properties.
 *
 * @public
 */
export class FavoritePropertiesManager implements IDisposable {
  /**
   * Used in tests to avoid collisions between multiple runs using the same storage
   * @internal
   */
  public static FAVORITES_IDENTIFIER_PREFIX = "";

  /** Event raised after favorite properties have changed. */
  public onFavoritesChanged = new BeEvent<() => void>();

  private _storage: IFavoritePropertiesStorage;
  private _globalProperties: Set<PropertyFullName> | undefined;
  private _iTwinProperties: Map<string, Set<PropertyFullName>>;
  private _imodelProperties: Map<string, Set<PropertyFullName>>;
  private _imodelBaseClassesByClass: Map<string, { [className: string]: string[] }>;

  /** Property order is saved only in iModel scope */
  private _propertiesOrder: Map<string, FavoritePropertiesOrderInfo[]>;

  public constructor(props: FavoritePropertiesManagerProps) {
    this._storage = props.storage;
    this._iTwinProperties = new Map<string, Set<PropertyFullName>>();
    this._imodelProperties = new Map<string, Set<PropertyFullName>>();
    this._propertiesOrder = new Map<string, FavoritePropertiesOrderInfo[]>();
    this._imodelBaseClassesByClass = new Map<string, { [className: string]: string[] }>();
  }

  public dispose() {
    // istanbul ignore else
    if (isIDisposable(this._storage))
      this._storage.dispose();
  }

  /**
   * Initialize favorite properties for the provided IModelConnection.
   */
  public initializeConnection = async (imodel: IModelConnection) => {
    const imodelId = imodel.iModelId!;
    const iTwinId = imodel.iTwinId!;

    if (this._globalProperties === undefined)
      this._globalProperties = await this._storage.loadProperties() || new Set<PropertyFullName>();

    if (!this._iTwinProperties.has(iTwinId)) {
      const iTwinProperties = await this._storage.loadProperties(iTwinId) || new Set<PropertyFullName>();
      this._iTwinProperties.set(iTwinId, iTwinProperties);
    }

    if (!this._imodelProperties.has(getiModelInfo(iTwinId, imodelId))) {
      const imodelProperties = await this._storage.loadProperties(iTwinId, imodelId) || new Set<PropertyFullName>();
      this._imodelProperties.set(getiModelInfo(iTwinId, imodelId), imodelProperties);
    }
    const propertiesOrder = await this._storage.loadPropertiesOrder(iTwinId, imodelId) || [];
    this._propertiesOrder.set(getiModelInfo(iTwinId, imodelId), propertiesOrder);
    await this._adjustPropertyOrderInfos(iTwinId, imodelId);
  };

  /**
   * Function that removes order information of properties that are no longer
   * favorited and adds missing order information for favorited properties.
   */
  private _adjustPropertyOrderInfos = async (iTwinId: string, imodelId: string) => {
    const propertiesOrder = this._propertiesOrder.get(getiModelInfo(iTwinId, imodelId))!;

    const globalProperties = this._globalProperties!;
    const iTwinProperties = this._iTwinProperties.get(iTwinId)!;
    const imodelProperties = this._imodelProperties.get(getiModelInfo(iTwinId, imodelId))!;
    // favorite property infos that need to be added to the propertiesOrder array
    const infosToAdd = new Set<string>([...globalProperties, ...iTwinProperties, ...imodelProperties]);

    for (let i = propertiesOrder.length - 1; i >= 0; i--) {
      if (infosToAdd.has(propertiesOrder[i].name))
        infosToAdd.delete(propertiesOrder[i].name);
      else
        propertiesOrder.splice(i, 1);
    }

    infosToAdd.forEach((info) => propertiesOrder.push({
      name: info,
      parentClassName: getPropertyClassName(info),
      orderedTimestamp: new Date(),
      priority: 0,
    }));

    let priority = propertiesOrder.length;
    propertiesOrder.forEach((oi) => oi.priority = priority--);
  };

  private validateInitialization(imodel: IModelConnection) {
    const iTwinId = imodel.iTwinId!;
    const imodelId = imodel.iModelId!;
    if (!this._imodelProperties.has(getiModelInfo(iTwinId, imodelId)))
      throw Error(`Favorite properties are not initialized for iModel: '${imodelId}', in iTwin: '${iTwinId}'. Call initializeConnection() with an IModelConnection to initialize.`);
  }

  /**
   * Adds favorite properties into a certain scope.
   * @param field Field that contains properties. If field contains multiple properties, all of them will be favorited.
   * @param imodel IModelConnection.
   * @param scope FavoritePropertiesScope to put the favorite properties into.
   * @note `initializeConnection` must be called with the `imodel` before calling this function.
   */
  public async add(field: Field, imodel: IModelConnection, scope: FavoritePropertiesScope): Promise<void> {
    this.validateInitialization(imodel);
    const iTwinId = imodel.iTwinId!;
    const imodelId = imodel.iModelId!;

    let favoriteProperties: Set<PropertyFullName>;
    let saveProperties: (properties: Set<PropertyFullName>) => Promise<void>;
    switch (scope) {
      case FavoritePropertiesScope.Global:
        favoriteProperties = this._globalProperties!;
        saveProperties = async (properties) => this._storage.saveProperties(properties);
        break;
      case FavoritePropertiesScope.ITwin:
        favoriteProperties = this._iTwinProperties.get(iTwinId)!;
        saveProperties = async (properties) => this._storage.saveProperties(properties, iTwinId);
        break;
      default:
        favoriteProperties = this._imodelProperties.get(getiModelInfo(iTwinId, imodelId))!;
        saveProperties = async (properties) => this._storage.saveProperties(properties, iTwinId, imodelId);
    }

    const countBefore = favoriteProperties.size;
    const fieldInfos = getFieldInfos(field);
    fieldInfos.forEach((info) => favoriteProperties.add(info));
    if (favoriteProperties.size !== countBefore) {
      const saves: Array<Promise<void>> = [];
      saves.push(saveProperties(favoriteProperties));

      const propertiesOrder = this._propertiesOrder.get(getiModelInfo(iTwinId, imodelId))!;
      addOrderInfos(propertiesOrder, createFieldOrderInfos(field));
      saves.push(this._storage.savePropertiesOrder(propertiesOrder, iTwinId, imodelId));

      await Promise.all(saves);
      this.onFavoritesChanged.raiseEvent();
    }
  }

  /**
   * Removes favorite properties from a scope specified and all the more general scopes.
   * @param field Field that contains properties. If field contains multiple properties, all of them will be un-favorited.
   * @param imodel IModelConnection.
   * @param scope FavoritePropertiesScope to remove the favorite properties from. It also removes from more general scopes.
   * @note `initializeConnection` must be called with the `imodel` before calling this function.
   */
  public async remove(field: Field, imodel: IModelConnection, scope: FavoritePropertiesScope): Promise<void> {
    this.validateInitialization(imodel);
    const iTwinId = imodel.iTwinId!;
    const imodelId = imodel.iModelId!;

    const fieldInfos = getFieldInfos(field);
    const workingScopes: Array<{ properties: Set<PropertyFullName>, save: (properties: Set<PropertyFullName>) => Promise<void> }> = [];
    workingScopes.push({
      properties: this._globalProperties!,
      save: async (properties) => this._storage.saveProperties(properties),
    });
    if (scope === FavoritePropertiesScope.ITwin || scope === FavoritePropertiesScope.IModel) {
      workingScopes.push({
        properties: this._iTwinProperties.get(iTwinId)!,
        save: async (properties) => this._storage.saveProperties(properties, iTwinId),
      });
    }
    if (scope === FavoritePropertiesScope.IModel) {
      workingScopes.push({
        properties: this._imodelProperties.get(getiModelInfo(iTwinId, imodelId))!,
        save: async (properties) => this._storage.saveProperties(properties, iTwinId, imodelId),
      });
    }

    const saves: Array<Promise<void>> = [];
    let favoritesChanged = false;
    for (const { properties, save } of workingScopes) {
      const countBefore = properties.size;
      fieldInfos.forEach((info) => properties.delete(info));
      if (properties.size !== countBefore) {
        saves.push(save(properties));
        favoritesChanged = true;
      }
    }
    if (!favoritesChanged)
      return;

    const propertiesOrder = this._propertiesOrder.get(getiModelInfo(iTwinId, imodelId))!;
    removeOrderInfos(propertiesOrder, createFieldOrderInfos(field));
    saves.push(this._storage.savePropertiesOrder(propertiesOrder, iTwinId, imodelId));

    await Promise.all(saves);
    this.onFavoritesChanged.raiseEvent();
  }

  /**
   * Removes all favorite properties from a certain scope.
   * @param imodel IModelConnection.
   * @param scope FavoritePropertiesScope to remove the favorite properties from.
   * @note `initializeConnection` must be called with the `imodel` before calling this function.
   */
  public async clear(imodel: IModelConnection, scope: FavoritePropertiesScope): Promise<void> {
    this.validateInitialization(imodel);
    const iTwinId = imodel.iTwinId!;
    const imodelId = imodel.iModelId!;

    let favoriteProperties: Set<PropertyFullName>;
    let saveProperties: () => Promise<void>;
    switch (scope) {
      case FavoritePropertiesScope.Global:
        favoriteProperties = this._globalProperties!;
        saveProperties = async () => this._storage.saveProperties(new Set<PropertyFullName>());
        break;
      case FavoritePropertiesScope.ITwin:
        favoriteProperties = this._iTwinProperties.get(iTwinId)!;
        saveProperties = async () => this._storage.saveProperties(new Set<PropertyFullName>(), iTwinId);
        break;
      default:
        favoriteProperties = this._imodelProperties.get(getiModelInfo(iTwinId, imodelId))!;
        saveProperties = async () => this._storage.saveProperties(new Set<PropertyFullName>(), iTwinId, imodelId);
    }

    if (favoriteProperties.size === 0)
      return;

    favoriteProperties.clear();
    const saves: Array<Promise<void>> = [];
    saves.push(saveProperties());
    saves.push(this._adjustPropertyOrderInfos(iTwinId, imodelId));
    await Promise.all(saves);
    this.onFavoritesChanged.raiseEvent();
  }

  /**
   * Check if field contains at least one favorite property.
   * @param field Field that contains properties.
   * @param imodel IModelConnection.
   * @param scope FavoritePropertiesScope to check for favorite properties. It also checks the more general scopes.
   * @note `initializeConnection` must be called with the `imodel` before calling this function.
   */
  public has(field: Field, imodel: IModelConnection, scope: FavoritePropertiesScope): boolean {
    this.validateInitialization(imodel);
    const iTwinId = imodel.iTwinId!;
    const imodelId = imodel.iModelId!;

    const fieldInfos = getFieldInfos(field);
    return setHasAny(this._globalProperties!, fieldInfos) ||
      (scope !== FavoritePropertiesScope.Global && setHasAny(this._iTwinProperties.get(iTwinId)!, fieldInfos)) ||
      (scope === FavoritePropertiesScope.IModel && setHasAny(this._imodelProperties.get(getiModelInfo(iTwinId, imodelId))!, fieldInfos));
  }

  /**
   * Sorts an array of fields with respect to favorite property order.
   * Non-favorited fields get sorted by their default priority and always have lower priority than favorited fields.
   * @param imodel IModelConnection.
   * @param fields Array of Field's that needs to be sorted.
   * @note `initializeConnection` must be called with the `imodel` before calling this function.
   */
  public sortFields = (imodel: IModelConnection, fields: Field[]): Field[] => {
    this.validateInitialization(imodel);
    const iTwinId = imodel.iTwinId!;
    const imodelId = imodel.iModelId!;

    const fieldPriority = new Map<Field, number>();
    fields.forEach((field) => fieldPriority.set(field, this.getFieldPriority(field, iTwinId, imodelId)));

    const sortFunction = (left: Field, right: Field): number => {
      const lp = fieldPriority.get(left)!;
      const rp = fieldPriority.get(right)!;
      return lp < rp ? 1 :
        lp > rp ? -1 :
          left.priority < right.priority ? 1 : // if favorite fields have equal priorities, sort by field priority
            left.priority > right.priority ? -1 :
              left.name.localeCompare(right.name);
    };

    return fields.sort(sortFunction);
  };

  private getFieldPriority(field: Field, iTwinId: string, imodelId: string): number {
    const orderInfos = this._propertiesOrder.get(getiModelInfo(iTwinId, imodelId))!;
    const fieldOrderInfos = getFieldOrderInfos(field, orderInfos);
    if (fieldOrderInfos.length === 0)
      return -1;
    const mostRecent = getMostRecentOrderInfo(fieldOrderInfos);
    return mostRecent.priority;
  }

  private _getBaseClassesByClass = async (imodel: IModelConnection, neededClasses: Set<string>): Promise<{ [className: string]: string[] }> => {
    const iTwinId = imodel.iTwinId!;
    const imodelId = imodel.iModelId!;

    const imodelInfo = getiModelInfo(iTwinId, imodelId);
    let baseClasses: { [className: string]: string[] };
    if (this._imodelBaseClassesByClass.has(imodelInfo))
      baseClasses = this._imodelBaseClassesByClass.get(imodelInfo)!;
    else
      this._imodelBaseClassesByClass.set(imodelInfo, baseClasses = {});

    const missingClasses = new Set<string>();
    neededClasses.forEach((className) => {
      if (!baseClasses.hasOwnProperty(className))
        missingClasses.add(className);
    });
    if (missingClasses.size === 0)
      return baseClasses;

    const query = `
    SELECT (derivedSchema.Name || ':' || derivedClass.Name) AS "ClassFullName", (baseSchema.Name || ':' || baseClass.Name) AS "BaseClassFullName"
    FROM ECDbMeta.ClassHasAllBaseClasses baseClassRels
    INNER JOIN ECDbMeta.ECClassDef derivedClass ON derivedClass.ECInstanceId = baseClassRels.SourceECInstanceId
    INNER JOIN ECDbMeta.ECSchemaDef derivedSchema ON derivedSchema.ECInstanceId = derivedClass.Schema.Id
    INNER JOIN ECDbMeta.ECClassDef baseClass ON baseClass.ECInstanceId = baseClassRels.TargetECInstanceId
    INNER JOIN ECDbMeta.ECSchemaDef baseSchema ON baseSchema.ECInstanceId = baseClass.Schema.Id
    WHERE (derivedSchema.Name || ':' || derivedClass.Name) IN (${[...missingClasses].map((className) => `'${className}'`).join(",")})`;
    for await (const row of imodel.query(query, undefined, QueryRowFormat.UseJsPropertyNames)) {
      if (!(row.classFullName in baseClasses))
        baseClasses[row.classFullName] = [];
      baseClasses[row.classFullName].push(row.baseClassFullName);
    }
    return baseClasses;
  };

  /** Changes field properties priorities to lower than another fields priority
   * @param imodel IModelConnection.
   * @param field Field that priority is being changed.
   * @param afterField Field that goes before the moved field. If undefined the moving field is changed to the highest priority (to the top).
   * @param visibleFields Array of fields to move the field in.
   * @note `initializeConnection` must be called with the `imodel` before calling this function.
   */
  public async changeFieldPriority(imodel: IModelConnection, field: Field, afterField: Field | undefined, visibleFields: Field[]) {
    /**
     * How it works:
     * 1. Gets the orderInfo's for `field` (`orderInfo`) and `afterField` (`afterOrderInfo`) by selecting the most recent order informations for each field
     * 2. Iterates all orderInfo's that are in between `afterOrderInfo` and `orderInfo` when sorted by priority
     * 3. For each iterated orderInfo it checks if it is relevant:
     * 3.1. If orderInfo belongs to a primitive property, orderInfo is relevant
     * 3.2. If orderInfo's field is visible, orderInfo is relevant
     * 3.3. If orderInfo's class has a base class or itself in previously labeled relevant orderInfo's, orderInfo is relevant
     * 3.4. If 3.1 - 3.3 don't pass, orderInfo is irrelevant
     * 4. Irrelevant orderInfos's get moved after `orderInfo` (depends on the direction)
     * 5. All `field` orderInfo's get moved after `afterOrderInfo`
     */
    this.validateInitialization(imodel);
    const iTwinId = imodel.iTwinId!;
    const imodelId = imodel.iModelId!;

    if (field === afterField)
      throw Error("`field` can not be the same as `afterField`.");

    const allOrderInfos = this._propertiesOrder.get(getiModelInfo(iTwinId, imodelId))!;

    const findFieldOrderInfoData = (f: Field) => {
      if (!visibleFields.includes(f))
        throw Error("Field is not contained in visible fields.");
      const infos = getFieldOrderInfos(f, allOrderInfos);

      if (infos.length === 0)
        throw Error("Field has no property order information.");
      const info = getMostRecentOrderInfo(infos);
      const index = allOrderInfos.indexOf(info);
      return { infos, mostRecent: { info, index } };
    };

    const { infos: movingOrderInfos, mostRecent: { index: orderInfoIndex } } = findFieldOrderInfoData(field);

    let afterOrderInfo: FavoritePropertiesOrderInfo | undefined;
    let afterOrderInfoIndex;
    if (afterField === undefined) {
      afterOrderInfo = undefined;
      afterOrderInfoIndex = -1;
    } else {
      ({ mostRecent: { info: afterOrderInfo, index: afterOrderInfoIndex } } = findFieldOrderInfoData(afterField));
    }

    let direction: Direction; // where to go from `afterOrderInfo` to `orderInfo`
    let startIndex: number;
    if (orderInfoIndex < afterOrderInfoIndex) {
      direction = Direction.Up;
      startIndex = afterOrderInfoIndex;
    } else {
      direction = Direction.Down;
      startIndex = afterOrderInfoIndex + 1;
    }

    const neededClassNames: Set<string> = allOrderInfos.reduce((classNames: Set<string>, oi) => {
      if (oi.parentClassName)
        classNames.add(oi.parentClassName);
      return classNames;
    }, new Set<string>());
    const baseClassesByClass = await this._getBaseClassesByClass(imodel, neededClassNames);

    const visibleOrderInfos = visibleFields.reduce((union: FavoritePropertiesOrderInfo[], currField) => union.concat(getFieldOrderInfos(currField, allOrderInfos)), []);
    const irrelevantOrderInfos: FavoritePropertiesOrderInfo[] = []; // orderInfos's that won't change their logical order in respect to other properties
    const relevantClasses: Set<ClassId> = new Set<ClassId>(); // currently relevant classes

    for (let i = startIndex; i !== orderInfoIndex; i += direction) {
      const currOrderInfo = allOrderInfos[i];

      // primitive properties are always relevant, because we can't determine their relevance based on the class hierarchy
      if (currOrderInfo.parentClassName === undefined)
        continue;

      const visible = visibleOrderInfos.includes(currOrderInfo);
      if (visible) {
        relevantClasses.add(currOrderInfo.parentClassName);
        continue;
      }

      const hasBaseClasses = baseClassesByClass[currOrderInfo.parentClassName].some((classId) => relevantClasses.has(classId));
      if (hasBaseClasses)
        continue;

      if (direction === Direction.Down)
        irrelevantOrderInfos.push(currOrderInfo);
      else
        irrelevantOrderInfos.unshift(currOrderInfo);
    }

    // remove irrelevantOrderInfo's to add them after the `orderInfo`
    irrelevantOrderInfos.forEach((foi) => {
      const index = allOrderInfos.findIndex((oi) => oi.parentClassName === foi.parentClassName && oi.name === foi.name);
      allOrderInfos.splice(index, 1);
    });

    // remove movingOrderInfos's to add them after the `afterOrderInfo`
    movingOrderInfos.forEach((foi) => {
      const index = allOrderInfos.findIndex((oi) => oi.parentClassName === foi.parentClassName && oi.name === foi.name);
      allOrderInfos.splice(index, 1);
    });
    movingOrderInfos.forEach((oi) => oi.orderedTimestamp = new Date());

    afterOrderInfoIndex = afterOrderInfo === undefined ? -1 : allOrderInfos.indexOf(afterOrderInfo);
    allOrderInfos.splice(afterOrderInfoIndex + 1, 0, ...movingOrderInfos);
    allOrderInfos.splice(afterOrderInfoIndex + 1 + (direction === Direction.Up ? movingOrderInfos.length : 0), 0, ...irrelevantOrderInfos);

    // reassign priority numbers
    let priority = allOrderInfos.length;
    allOrderInfos.forEach((oi) => oi.priority = priority--);

    await this._storage.savePropertiesOrder(allOrderInfos, iTwinId, imodelId);
    this.onFavoritesChanged.raiseEvent();
  }
}

enum Direction {
  Up = -1,
  Down = 1,
}

const getiModelInfo = (iTwinId: string, imodelId: string) => `${iTwinId}/${imodelId}`;

const getPropertiesFieldPropertyNames = (field: PropertiesField) => {
  const nestingPrefix = getNestingPrefix(field.parent);
  return field.properties.map((property) => `${FavoritePropertiesManager.FAVORITES_IDENTIFIER_PREFIX}${nestingPrefix}${property.property.classInfo.name}:${property.property.name}`);
};

const getNestedContentFieldPropertyName = (field: NestedContentField) => {
  const nestingPrefix = getNestingPrefix(field);
  return `${FavoritePropertiesManager.FAVORITES_IDENTIFIER_PREFIX}${nestingPrefix}${field.contentClassInfo.name}`;
};

const getNestingPrefix = (field: NestedContentField | undefined) => {
  const path: string[] = [];
  let curr = field;
  while (curr !== undefined) {
    curr.pathToPrimaryClass.forEach((rel) => {
      // Relationship directions are reversed, because we are generating a relationship list starting from the parent
      path.push(`${rel.isForwardRelationship ? "B" : "F"}:${rel.relationshipInfo.name}`);
      path.push(rel.targetClassInfo.name);
    });
    curr = curr.parent;
  }
  if (path.length === 0)
    return "";

  path.reverse();
  return `${path.join("-")}-`;
};

const getPropertyClassName = (propertyName: PropertyFullName): string | undefined => {
  const propertyNameStart = propertyName.split("-")[0];
  const parts = propertyNameStart.split(":").length;
  if (parts === 1) // primitive
    return undefined;
  if (parts === 2) // nested property OR nested property parent class OR regular property parent class
    return propertyNameStart;
  // regular property without parent class
  return propertyNameStart.substr(0, propertyName.lastIndexOf(":"));
};

/** @internal */
export const getFieldInfos = (field: Field): Set<PropertyFullName> => {
  const fieldInfos: Set<PropertyFullName> = new Set<PropertyFullName>();
  if (field.isPropertiesField())
    getPropertiesFieldPropertyNames(field).forEach((info) => fieldInfos.add(info));
  else if (field.isNestedContentField())
    fieldInfos.add(getNestedContentFieldPropertyName(field));
  else
    fieldInfos.add(`${FavoritePropertiesManager.FAVORITES_IDENTIFIER_PREFIX}${field.name}`);
  return fieldInfos;
};

const setHasAny = (set: Set<string>, lookup: Set<string>) => {
  for (const key of lookup) {
    if (set.has(key))
      return true;
  }
  return false;
};

const addOrderInfos = (dest: FavoritePropertiesOrderInfo[], source: FavoritePropertiesOrderInfo[]) => {
  source.forEach((si) => {
    const index = dest.findIndex((di) => di.name === si.name);
    if (index === -1) {
      si.orderedTimestamp = new Date();
      dest.push(si);
    }
  });
  let priority = dest.length;
  dest.forEach((info) => info.priority = priority--);
};

const removeOrderInfos = (container: FavoritePropertiesOrderInfo[], toRemove: FavoritePropertiesOrderInfo[]) => {
  toRemove.forEach((roi) => {
    const index = container.findIndex((oi) => oi.name === roi.name);
    /* istanbul ignore else */
    if (index >= 0)
      container.splice(index, 1);
  });
};

/** @internal */
export const createFieldOrderInfos = (field: Field): FavoritePropertiesOrderInfo[] => {
  if (field.isNestedContentField()) {
    const propertyName = getNestedContentFieldPropertyName(field);
    return [{
      parentClassName: getPropertyClassName(propertyName),
      name: propertyName,
      priority: 0,
      orderedTimestamp: new Date(),
    }];
  }
  if (field.isPropertiesField()) {
    return getPropertiesFieldPropertyNames(field).map((propertyName) => ({
      parentClassName: getPropertyClassName(propertyName),
      name: propertyName,
      priority: 0,
      orderedTimestamp: new Date(),
    }));
  }
  return [{
    parentClassName: undefined,
    name: field.name,
    priority: 0,
    orderedTimestamp: new Date(),
  }];
};

const getFieldOrderInfos = (field: Field, orderInfos: FavoritePropertiesOrderInfo[]): FavoritePropertiesOrderInfo[] => {
  const fieldOrderInfos: FavoritePropertiesOrderInfo[] = [];
  const tryAddOrderInfo = (name: string) => {
    const fieldOrderInfo = orderInfos.find((oi) => oi.name === name);
    if (fieldOrderInfo !== undefined)
      fieldOrderInfos.push(fieldOrderInfo);
  };

  if (field.isPropertiesField())
    getPropertiesFieldPropertyNames(field).forEach(tryAddOrderInfo);
  else if (field.isNestedContentField())
    tryAddOrderInfo(getNestedContentFieldPropertyName(field));
  else
    tryAddOrderInfo(field.name);

  return fieldOrderInfos;
};

const getMostRecentOrderInfo = (orderInfos: FavoritePropertiesOrderInfo[]) =>
  orderInfos.reduce((recent, curr) => (recent && recent.orderedTimestamp >= curr.orderedTimestamp) ? recent : curr);
