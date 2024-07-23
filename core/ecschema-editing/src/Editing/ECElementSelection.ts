import { CustomAttributeContainerProps, ECClass, Property, RelationshipClass, RelationshipConstraint, Schema, SchemaItemKey, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { ChangeOptions } from "./ChangeInfo/ChangeOptions";
import { AbstractConstraintId, BaseClassId, CustomAttributeId, ECClassSchemaItems, ISchemaTypeIdentifier, RelationshipConstraintId } from "./SchemaItemIdentifiers";





class RootClassSearchArgs {
  public rootClasses: Map<string, ECClass>;
  public readonly elements: ECElementSelection

  constructor(elements: ECElementSelection) {
    this.rootClasses = new Map<string, ECClass>();
    this.elements = elements;
  }
}

/**
 * @alpha
 * @internal
 */
export class ECElementSelection {
  private _schema: Schema;
  private _ecClass?: ECClass;
  private _property?: Property;
  private _options: ChangeOptions;
  public gatherProperties = true;

  private _reachedStartingClass = false;
  private _gatheredSchemas: Map<string, Schema>;
  private _gatheredBaseClasses: Map<string, ECClass>;
  private _gatheredDerivedClasses: Map<string, ECClass>;
  private _gatheredBaseProperties: Array<Property>;
  private _gatheredDerivedProperties: Array<Property>;

  constructor(public schemaEditor: SchemaContextEditor, schema: Schema, ecClass: ECClass | undefined, property: Property | undefined, options: ChangeOptions) {
    this._schema = schema;
    this._ecClass = ecClass;
    this._property = property;
    this._options = options;

    this._gatheredSchemas = new Map<string, Schema>();
    this._gatheredBaseClasses = new Map<string, ECClass>();
    this._gatheredDerivedClasses = new Map<string, ECClass>();
    this._gatheredBaseProperties = new Array<Property>();
    this._gatheredDerivedProperties = new Array<Property>();
  }

  public get schema(): Schema {
    return this._schema;
  }

  public get options(): ChangeOptions {
    return this._options;
  }

  public get ecClass(): ECClass | undefined {
    return this._ecClass;
  }

  public get property(): Property | undefined {
    return this._property;
  }

  public get gatheredSchemas(): Map<string, Schema> {
    return this._gatheredSchemas;
  }

  public get gatheredBaseClasses(): Map<string, ECClass> {
    return this._gatheredBaseClasses;
  }

  public get gatheredDerivedClasses(): Map<string, ECClass> {
    return this._gatheredDerivedClasses;
  }

  public get gatheredBaseProperties(): Array<Property> {
    return this._gatheredBaseProperties;
  }

  public get gatheredDerivedProperties(): Array<Property> {
    return this._gatheredDerivedProperties;
  }

  public static async gatherClassesAndPropertyOverrides(startingClass: ECClass, elements: ECElementSelection) {
    elements._reachedStartingClass = false;

    if (!elements.gatheredSchemas.has(startingClass.schema.name))
      elements.gatheredSchemas.set(startingClass.schema.name, startingClass.schema);

    if (elements._options.changeBase) {
      if (undefined !== elements.property && undefined === elements.property.class.getInheritedProperty(elements.property.name)) {
        startingClass.traverseDerivedClasses(ECElementSelection.gatherDerivedClasses, elements);
      } else {
        const classSearchArgs = new RootClassSearchArgs(elements);
        await startingClass.traverseBaseClasses(ECElementSelection.getRootClasses, classSearchArgs);
        for (const entry of classSearchArgs.rootClasses) {
          const rootClass = entry[1];
          const baseProperty = await ECElementSelection.tryGetBaseProperty(elements, rootClass);
          if (baseProperty)
            elements.gatheredBaseProperties.push(baseProperty);

          elements.gatheredBaseClasses.set(rootClass.fullName, rootClass);
          rootClass.traverseDerivedClasses(ECElementSelection.getClassesFromRoot, elements);
        }
      }
    } else {
      await startingClass.traverseDerivedClasses(ECElementSelection.gatherDerivedClasses, elements);
    }
  }

  private static async tryGetBaseProperty(elements: ECElementSelection, rootClass: ECClass): Promise<Property | undefined> {
    if (undefined === elements.property)
      return undefined;

    return rootClass.getProperty(elements.property.name);
  }

  private static getRootClasses(baseClass: ECClass, arg: any): boolean {
    const classSearchArgs = arg as RootClassSearchArgs;
    if (!classSearchArgs.rootClasses.has(baseClass.name) &&
      ((!baseClass.baseClass && null == classSearchArgs.elements.property) ||
        ECElementSelection.containsRootDefinitionOfProperty(baseClass, classSearchArgs.elements.property))) {
      classSearchArgs.rootClasses.set(baseClass.name, baseClass);
    }

    return true;
  }

  private static async getClassesFromRoot(derivedClass: ECClass, out: (traverseDerivedClasses: boolean) => void, arg: any): Promise<boolean> {
    const elements = arg as ECElementSelection;
    if (elements.gatheredSchemas.has(derivedClass.schema.name))
      elements.gatheredSchemas.set(derivedClass.schema.name, derivedClass.schema);

    let visitClassesDerivedFromThisClass: boolean;

    if (elements._reachedStartingClass) {
      visitClassesDerivedFromThisClass = true;
      if (!elements.gatheredDerivedClasses.has(derivedClass.fullName)) {
        elements.gatheredDerivedClasses.set(derivedClass.fullName, derivedClass);
        if (elements.gatherProperties)
          ECElementSelection.gatherLocalDerivedProperties(derivedClass, elements);
      }
    } else {
      elements._reachedStartingClass = undefined !== elements.ecClass && derivedClass.key.matches(elements.ecClass.key);
      visitClassesDerivedFromThisClass = (elements._reachedStartingClass && !elements._options.changeDerived) ? false : true;

      if (!elements._reachedStartingClass) {
        if (!elements.gatheredBaseClasses.has(derivedClass.fullName)) {
          elements.gatheredBaseClasses.set(derivedClass.fullName, derivedClass);
          if (elements.gatherProperties)
            ECElementSelection.gatherLocalBaseProperties(derivedClass, elements);
        }
      }
    }

    out(visitClassesDerivedFromThisClass);

    return false;
  }

  private static async gatherDerivedClasses(derivedClass: ECClass, out: (visitClassesDerivedFromThisClass: boolean) => void, arg: any): Promise<boolean> {
    const elements = arg as ECElementSelection;
    if (!elements.gatheredSchemas.has(derivedClass.schema.name))
      elements.gatheredSchemas.set(derivedClass.schema.name, derivedClass.schema);

    let visitClassesDerivedFromThisClass = !elements.gatheredDerivedClasses.has(derivedClass.fullName);
    if (visitClassesDerivedFromThisClass) {
      elements.gatheredDerivedClasses.set(derivedClass.fullName, derivedClass);
      if (elements.gatherProperties)
        await ECElementSelection.gatherLocalDerivedProperties(derivedClass, elements);
    }

    out(visitClassesDerivedFromThisClass);

    return false;
  }

  private static async gatherLocalDerivedProperties(derivedClass: ECClass, elements: ECElementSelection) {
    if (undefined != elements.property) {
      const localPropertyOverride = await derivedClass.getProperty(elements.property.name);
      if (undefined != localPropertyOverride) {
        elements.gatheredDerivedProperties.push(localPropertyOverride);
        return true;
      }
      return false;
    } else {
      if (!derivedClass.properties)
        return true;

      for (const localProperty of derivedClass.properties) {
        let gatherProperty = false;
        const inheritedProperty = await derivedClass.getInheritedProperty(localProperty.name);
        if (elements._options.leavePropertyOverrides) {
          gatherProperty = undefined != inheritedProperty && elements.ecClass !== undefined && inheritedProperty.class.key.matches(elements.ecClass.key);
        } else if (null != inheritedProperty) {
          gatherProperty = null != elements.ecClass?.getProperty(localProperty.name);
        }

        if (gatherProperty)
          elements.gatheredDerivedProperties.push(localProperty);
      }

      return true;
    }
  }

  private static async gatherLocalBaseProperties(baseClass: ECClass, elements: ECElementSelection): Promise<boolean> {
    if (null != elements.property) {
      const localPropertyOverride = await baseClass.getProperty(elements.property.name);
      if (null != localPropertyOverride) {
        elements.gatheredBaseProperties.push(localPropertyOverride);
        return true;
      }
      return false; // Return false because this base class does not define the property we are looking for.
      // If that is the case we know we do not need to traverse derived classes because only one of those derived classes
      // has the property we want and that derived class is where we came from.
    } else {
      let foundProperty = false;
      if (!baseClass.properties)
        return foundProperty;

      for (const localProperty of baseClass.properties) {
        if (undefined !== await elements.ecClass?.getProperty(localProperty.name)) {
          elements.gatheredBaseProperties.push(localProperty);
          foundProperty = true;
        }
      }
      return foundProperty;
    }
  }

  private static containsRootDefinitionOfProperty(baseClass: ECClass, property: Property | undefined): boolean {
    if (!property)
      return false;

    return undefined !== baseClass.getPropertySync(property.name, false);
  }

  public static gatherSchemaReferenceItems(schema: Schema, refSchema: Schema): ISchemaTypeIdentifier[] {
    const schemaTypeIdentifiers: ISchemaTypeIdentifier[] = [];
    const classes = schema.getClasses();
    for (const _class of classes) {
      ECElementSelection.matchingBaseClassSchema(refSchema, _class, schemaTypeIdentifiers);
      ECElementSelection.matchingCustomAttributesSchema(refSchema, _class, schemaTypeIdentifiers);
      ECElementSelection.matchingConstraintsSchema(refSchema, _class as RelationshipClass, schemaTypeIdentifiers);
    }

    return schemaTypeIdentifiers;
  }

  private static matchingBaseClassSchema(schema: Schema, ecClass: ECClass, schemaTypeIdentifiers: ISchemaTypeIdentifier[]) {
    if (!ecClass.baseClass || ecClass.baseClass.schemaKey.matches(schema.schemaKey))
      return;

    if (ecClass.baseClass.schemaKey.matches(schema.schemaKey)) {
      schemaTypeIdentifiers.push(new BaseClassId(ecClass.schemaItemType as ECClassSchemaItems, ecClass.key, new SchemaItemKey(ecClass.name, ecClass.baseClass.schemaKey)));
      return;
    }
  }

  private static matchingConstraintsSchema(schema: Schema, relClass: RelationshipClass, schemaTypeIdentifiers: ISchemaTypeIdentifier[]) {
    if (relClass.schemaItemType !== SchemaItemType.RelationshipClass)
      return;

    ECElementSelection.matchingConstraintSchema(schema, relClass.source, schemaTypeIdentifiers);
    ECElementSelection.matchingConstraintSchema(schema, relClass.target, schemaTypeIdentifiers);
  }

  private static matchingConstraintSchema(schema: Schema, constraint: RelationshipConstraint, schemaTypeIdentifiers: ISchemaTypeIdentifier[]) {
    if (constraint.abstractConstraint && constraint.abstractConstraint.schemaKey.matches(schema.schemaKey))
      schemaTypeIdentifiers.push(new AbstractConstraintId(constraint));

    if (constraint.constraintClasses) {
      for (const constraintClass of constraint.constraintClasses) {
        if (constraintClass.schemaKey.matches(schema.schemaKey))
          schemaTypeIdentifiers.push(new RelationshipConstraintId(constraint, undefined, new SchemaItemKey(constraintClass.name, constraintClass.schemaKey)));
      }
    }

    ECElementSelection.matchingCustomAttributesSchema(schema, constraint, schemaTypeIdentifiers);
  }

  private static matchingCustomAttributesSchema(schema: Schema, customAttributeContainer: CustomAttributeContainerProps, schemaTypeIdentifiers: ISchemaTypeIdentifier[]) {
    if (!customAttributeContainer.customAttributes)
      return;

    for (const [, customAttribute] of customAttributeContainer.customAttributes) {
      const nameParts = customAttribute.className.split(".");
      if (nameParts[0] === schema.name)
        schemaTypeIdentifiers.push(new CustomAttributeId(customAttribute.className, customAttributeContainer));
    }
  }
}

