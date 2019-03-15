// @public (undocumented)
class ArrayProperty extends Property {
  // (undocumented)
  protected _maxOccurs?: number;
  // (undocumented)
  protected _minOccurs: number;
  // (undocumented)
  readonly maxOccurs: number | undefined;
  // (undocumented)
  readonly minOccurs: number;
}

// @public
class BaseDiagnostic<TYPE extends AnyECType, ARGS extends any[]> implements IDiagnostic<TYPE, ARGS> {
  constructor(ecDefinition: TYPE, messageArgs: ARGS);
  readonly category: DiagnosticCategory;
  readonly code: string;
  readonly diagnosticType: DiagnosticType;
  ecDefinition: TYPE;
  messageArgs: ARGS;
  readonly messageText: string;
}

// @public
class ClassDiagnostic<ARGS extends any[]> extends SchemaItemDiagnostic<AnyClass, ARGS> {
  constructor(ecClass: AnyClass, messageArgs: ARGS);
}

// @public
export function classModifierToString(modifier: ECClassModifier): string;

// @public
class Constant extends SchemaItem {
  constructor(schema: Schema, name: string);
  // (undocumented)
  protected _definition: string;
  // (undocumented)
  protected _denominator: number;
  // (undocumented)
  protected _numerator: number;
  // (undocumented)
  protected _phenomenon?: LazyLoadedPhenomenon;
  // (undocumented)
  readonly definition: string;
  // (undocumented)
  readonly denominator: number;
  // WARNING: The type "ConstantProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(constantProps: ConstantProps): Promise<void>;
  // WARNING: The type "ConstantProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(constantProps: ConstantProps): void;
  // (undocumented)
  readonly numerator: number;
  // (undocumented)
  readonly phenomenon: LazyLoadedPhenomenon | undefined;
  // WARNING: The type "SchemaItemType.Constant" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.Constant;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
}

// @public
export function containerTypeToString(type: CustomAttributeContainerType): string;

// @public
export function createClassDiagnosticClass<ARGS extends any[]>(code: string, messageText: string, category?: DiagnosticCategory): {
    new (ecClass: AnyClass, messageArgs: ARGS): {
        readonly code: string;
        readonly category: DiagnosticCategory;
        readonly messageText: string;
        readonly diagnosticType: DiagnosticType;
        ecDefinition: AnyClass;
        messageArgs: ARGS;
    };
    diagnosticType: DiagnosticType;
};

// @public
export function createCustomAttributeContainerDiagnosticClass<ARGS extends any[]>(code: string, messageText: string, category?: DiagnosticCategory): {
    new (container: CustomAttributeContainerProps, messageArgs: ARGS): {
        readonly code: string;
        readonly category: DiagnosticCategory;
        readonly messageText: string;
        readonly diagnosticType: DiagnosticType;
        ecDefinition: CustomAttributeContainerProps;
        messageArgs: ARGS;
    };
};

// @public
export function createPropertyDiagnosticClass<ARGS extends any[]>(code: string, messageText: string, category?: DiagnosticCategory): {
    new (property: AnyProperty, messageArgs: ARGS): {
        readonly code: string;
        readonly category: DiagnosticCategory;
        readonly messageText: string;
        readonly diagnosticType: DiagnosticType;
        ecDefinition: AnyProperty;
        messageArgs: ARGS;
    };
};

// @public
export function createRelationshipConstraintDiagnosticClass<ARGS extends any[]>(code: string, messageText: string, category?: DiagnosticCategory): {
    new (constraint: RelationshipConstraint, messageArgs: ARGS): {
        readonly code: string;
        readonly category: DiagnosticCategory;
        readonly messageText: string;
        readonly diagnosticType: DiagnosticType;
        ecDefinition: RelationshipConstraint;
        messageArgs: ARGS;
    };
};

// @public
export function createSchemaDiagnosticClass<ARGS extends any[]>(code: string, messageText: string, category?: DiagnosticCategory): {
    new (schema: Schema, messageArgs: ARGS): {
        readonly code: string;
        readonly category: DiagnosticCategory;
        readonly messageText: string;
        readonly diagnosticType: DiagnosticType;
        ecDefinition: Schema;
        messageArgs: ARGS;
    };
    diagnosticType: DiagnosticType;
};

// @public
export function createSchemaItemDiagnosticClass<ITEM extends SchemaItem, ARGS extends any[]>(code: string, messageText: string, category?: DiagnosticCategory): {
    new (ecDefinition: ITEM, messageArgs: ARGS): {
        readonly code: string;
        readonly category: DiagnosticCategory;
        readonly messageText: string;
        readonly diagnosticType: DiagnosticType;
        ecDefinition: ITEM;
        messageArgs: ARGS;
    };
    diagnosticType: DiagnosticType;
};

// @public
class CustomAttributeClass extends ECClass {
  constructor(schema: Schema, name: string, modifier?: ECClassModifier);
  // (undocumented)
  protected _containerType?: CustomAttributeContainerType;
  // (undocumented)
  readonly containerType: CustomAttributeContainerType;
  // WARNING: The type "CustomAttributeClassProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(customAttributeProps: CustomAttributeClassProps): Promise<void>;
  // WARNING: The type "CustomAttributeClassProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(customAttributeProps: CustomAttributeClassProps): void;
  // WARNING: The type "SchemaItemType.CustomAttributeClass" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.CustomAttributeClass;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
}

// WARNING: The type "CustomAttributeContainerProps" needs to be exported by the package (e.g. added to index.ts)
// @public
class CustomAttributeContainerDiagnostic<ARGS extends any[]> extends BaseDiagnostic<CustomAttributeContainerProps, ARGS> {
  // WARNING: The type "CustomAttributeContainerProps" needs to be exported by the package (e.g. added to index.ts)
  constructor(container: CustomAttributeContainerProps, messageArgs: ARGS);
  // (undocumented)
  readonly diagnosticType: DiagnosticType;
}

// @public
enum CustomAttributeContainerType {
  // (undocumented)
  Any = 4095,
  // (undocumented)
  AnyClass = 30,
  // (undocumented)
  AnyProperty = 992,
  // (undocumented)
  AnyRelationshipConstraint = 3072,
  // (undocumented)
  CustomAttributeClass = 4,
  // (undocumented)
  EntityClass = 2,
  // (undocumented)
  NavigationProperty = 512,
  // (undocumented)
  PrimitiveArrayProperty = 128,
  // (undocumented)
  PrimitiveProperty = 32,
  // (undocumented)
  RelationshipClass = 16,
  // (undocumented)
  Schema = 1,
  // (undocumented)
  SourceRelationshipConstraint = 1024,
  // (undocumented)
  StructArrayProperty = 256,
  // (undocumented)
  StructClass = 8,
  // (undocumented)
  StructProperty = 64,
  // (undocumented)
  TargetRelationshipConstraint = 2048
}

// @public (undocumented)
enum DecimalPrecision {
  // (undocumented)
  Eight = 8,
  // (undocumented)
  Eleven = 11,
  // (undocumented)
  Five = 5,
  // (undocumented)
  Four = 4,
  // (undocumented)
  Nine = 9,
  // (undocumented)
  One = 1,
  // (undocumented)
  Seven = 7,
  // (undocumented)
  Six = 6,
  // (undocumented)
  Ten = 10,
  // (undocumented)
  Three = 3,
  // (undocumented)
  Twelve = 12,
  // (undocumented)
  Two = 2,
  // (undocumented)
  Zero = 0
}

// @public
class DelayedPromise<T> implements Promise<T> {
  // WARNING: The name "__@toStringTag" contains unsupported characters; API names should use only letters, numbers, and underscores
  // (undocumented)
  readonly __@toStringTag: "Promise";
  constructor(startCallback: () => Promise<T>);
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
  start: () => Promise<T>;
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
}

// @public (undocumented)
interface DelayedPromiseWithPropsConstructor {
  new <TProps extends NoDelayedPromiseMethods, TPayload>(props: TProps, startCallback: () => Promise<TPayload>): Readonly<TProps> & DelayedPromise<TPayload>;
}

// @public
enum DiagnosticCategory {
  // (undocumented)
  Error = 1,
  // (undocumented)
  Message = 3,
  // (undocumented)
  Suggestion = 2,
  // (undocumented)
  Warning = 0
}

// @public (undocumented)
export function diagnosticCategoryToString(category: DiagnosticCategory): "Error" | "Warning" | "Message" | "Suggestion";

// @public
class DiagnosticReporterBase implements IDiagnosticReporter {
  constructor(i18n?: I18N);
  protected formatStringFromArgs(text: string, args: ArrayLike<string>, baseIndex?: number): string;
  i18N?: I18N;
  report(diagnostic: AnyDiagnostic): void;
  protected abstract reportDiagnostic(diagnostic: AnyDiagnostic, messageText: string): void;
}

// @public
enum DiagnosticType {
  // (undocumented)
  CustomAttributeContainer = 4,
  // (undocumented)
  None = 0,
  // (undocumented)
  Property = 3,
  // (undocumented)
  RelationshipConstraint = 5,
  // (undocumented)
  Schema = 1,
  // (undocumented)
  SchemaItem = 2
}

// @public (undocumented)
export function diagnosticTypeToString(type: DiagnosticType): "Schema" | "None" | "CustomAttributeContainer" | "Property" | "RelationshipConstraint" | "SchemaItem";

// @public
class ECClass extends SchemaItem, implements CustomAttributeContainerProps {
  constructor(schema: Schema, name: string, modifier?: ECClassModifier);
  // (undocumented)
  protected _baseClass?: LazyLoadedECClass;
  // (undocumented)
  protected _modifier: ECClassModifier;
  // (undocumented)
  protected _properties?: Property[];
  // WARNING: The type "CustomAttribute" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected addCustomAttribute(customAttribute: CustomAttribute): void;
  protected addProperty<T extends Property>(prop: T): T;
  // (undocumented)
  baseClass: LazyLoadedECClass | undefined;
  // (undocumented)
  protected buildPropertyCache(result: Property[], existingValues?: Map<string, number>, resetBaseCaches?: boolean): Promise<void>;
  // (undocumented)
  protected buildPropertyCacheSync(result: Property[], existingValues?: Map<string, number>, resetBaseCaches?: boolean): void;
  protected createPrimitiveArrayProperty(name: string, primitiveType: PrimitiveType): Promise<PrimitiveArrayProperty>;
  protected createPrimitiveArrayPropertySync(name: string, primitiveType: PrimitiveType): PrimitiveArrayProperty;
  protected createPrimitiveProperty(name: string, primitiveType: PrimitiveType): Promise<PrimitiveProperty>;
  protected createPrimitivePropertySync(name: string, primitiveType: PrimitiveType): PrimitiveProperty;
  // (undocumented)
  protected createStructArrayProperty(name: string, structType: string | StructClass): Promise<StructArrayProperty>;
  // (undocumented)
  protected createStructArrayPropertySync(name: string, structType: string | StructClass): StructArrayProperty;
  // (undocumented)
  protected createStructProperty(name: string, structType: string | StructClass): Promise<StructProperty>;
  // (undocumented)
  protected createStructPropertySync(name: string, structType: string | StructClass): StructProperty;
  // WARNING: The type "CustomAttributeSet" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly customAttributes: CustomAttributeSet | undefined;
  // WARNING: The type "ClassProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(classProps: ClassProps): Promise<void>;
  // WARNING: The type "ClassProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(classProps: ClassProps): void;
  getAllBaseClasses(): AsyncIterableIterator<ECClass>;
  // (undocumented)
  getAllBaseClassesSync(): Iterable<AnyClass>;
  // (undocumented)
  getBaseClassSync(): ECClass | undefined;
  getInheritedProperty(name: string): Promise<Property | undefined>;
  getInheritedPropertySync(name: string): Property | undefined;
  getProperties(resetCache?: boolean): Promise<Property[]>;
  getPropertiesSync(resetCache?: boolean): Property[];
  getProperty(name: string, includeInherited?: boolean): Promise<Property | undefined>;
  getPropertySync(name: string, includeInherited?: boolean): Property | undefined;
  is(targetClass: string, schemaName: string): Promise<boolean>;
  isSync(targetClass: ECClass): boolean;
  // (undocumented)
  protected loadPrimitiveType(primitiveType: string | PrimitiveType | Enumeration | undefined, schema: Schema): Promise<PrimitiveType | Enumeration>;
  // (undocumented)
  protected loadPrimitiveTypeSync(primitiveType: string | PrimitiveType | Enumeration | undefined, schema: Schema): PrimitiveType | Enumeration;
  // (undocumented)
  protected loadStructType(structType: string | StructClass | undefined, schema: Schema): Promise<StructClass>;
  // (undocumented)
  protected loadStructTypeSync(structType: string | StructClass | undefined, schema: Schema): StructClass;
  // (undocumented)
  protected static mergeProperties(target: Property[], existingValues: Map<string, number>, propertiesToMerge: Property[], overwriteExisting: boolean): void;
  // (undocumented)
  readonly modifier: ECClassModifier;
  // (undocumented)
  readonly properties: Property[] | undefined;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
  traverseBaseClasses(callback: (ecClass: ECClass, arg?: any) => boolean, arg?: any): Promise<boolean>;
  traverseBaseClassesSync(callback: (ecClass: ECClass, arg?: any) => boolean, arg?: any): boolean;
}

// @public (undocumented)
enum ECClassModifier {
  // (undocumented)
  Abstract = 1,
  // (undocumented)
  None = 0,
  // (undocumented)
  Sealed = 2
}

// @public
class ECName {
  constructor(name: string);
  // (undocumented)
  readonly name: string;
  // (undocumented)
  static validate(newName: string): boolean;
}

// @public (undocumented)
class ECObjectsError extends BentleyError {
  constructor(errorNumber: number, message?: string);
  // (undocumented)
  readonly errorNumber: number;
  // (undocumented)
  toDebugString(): string;
}

// @public (undocumented)
enum ECObjectsStatus {
  // (undocumented)
  ClassNotFound = 35074,
  // (undocumented)
  DifferentSchemaContexts = 35076,
  // (undocumented)
  DuplicateItem = 35053,
  // (undocumented)
  DuplicateProperty = 35054,
  // (undocumented)
  DuplicateSchema = 35055,
  // (undocumented)
  ECOBJECTS_ERROR_BASE = 35052,
  // (undocumented)
  ImmutableSchema = 35056,
  // (undocumented)
  InvalidContainerType = 35057,
  // (undocumented)
  InvalidECJson = 35058,
  // (undocumented)
  InvalidECName = 35059,
  // (undocumented)
  InvalidECVersion = 35060,
  // (undocumented)
  InvalidEnumValue = 35061,
  // (undocumented)
  InvalidModifier = 35062,
  // (undocumented)
  InvalidMultiplicity = 35063,
  // (undocumented)
  InvalidPrimitiveType = 35064,
  // (undocumented)
  InvalidRelationshipEnd = 35068,
  // (undocumented)
  InvalidSchemaItemType = 35065,
  // (undocumented)
  InvalidSchemaString = 35073,
  // (undocumented)
  InvalidSchemaXML = 35072,
  // (undocumented)
  InvalidStrength = 35066,
  // (undocumented)
  InvalidStrengthDirection = 35067,
  // (undocumented)
  InvalidType = 35069,
  // (undocumented)
  MissingSchemaUrl = 35070,
  // (undocumented)
  SchemaContextUndefined = 35075,
  // (undocumented)
  Success = 0,
  // (undocumented)
  UnableToLocateSchema = 35071
}

// @public (undocumented)
class ECStringConstants {
  // (undocumented)
  static readonly CONTAINERTYPE_ANY: string;
  // (undocumented)
  static readonly CONTAINERTYPE_ANYCLASS: string;
  // (undocumented)
  static readonly CONTAINERTYPE_ANYPROPERTY: string;
  // (undocumented)
  static readonly CONTAINERTYPE_ANYRELATIONSHIPCONSTRAINT: string;
  // (undocumented)
  static readonly CONTAINERTYPE_CUSTOMATTRIBUTECLASS: string;
  // (undocumented)
  static readonly CONTAINERTYPE_ENTITYCLASS: string;
  // (undocumented)
  static readonly CONTAINERTYPE_NAVIGATIONPROPERTY: string;
  // (undocumented)
  static readonly CONTAINERTYPE_PRIMITIVEARRAYPROPERTY: string;
  // (undocumented)
  static readonly CONTAINERTYPE_PRIMITIVEPROPERTY: string;
  // (undocumented)
  static readonly CONTAINERTYPE_RELATIONSHIPCLASS: string;
  // (undocumented)
  static readonly CONTAINERTYPE_SCHEMA: string;
  // (undocumented)
  static readonly CONTAINERTYPE_SOURCERELATIONSHIPCONSTRAINT: string;
  // (undocumented)
  static readonly CONTAINERTYPE_STRUCTARRAYPROPERTY: string;
  // (undocumented)
  static readonly CONTAINERTYPE_STRUCTCLASS: string;
  // (undocumented)
  static readonly CONTAINERTYPE_STRUCTPROPERTY: string;
  // (undocumented)
  static readonly CONTAINERTYPE_TARGETRELATIONSHIPCONSTRAINT: string;
  // (undocumented)
  static readonly RELATIONSHIP_END_SOURCE: string;
  // (undocumented)
  static readonly RELATIONSHIP_END_TARGET: string;
}

// @public (undocumented)
class ECVersion {
  constructor(read?: number, write?: number, minor?: number);
  compare(rhv: ECVersion): number;
  static fromString(versionString: string): ECVersion;
  // (undocumented)
  readonly minor: number;
  // (undocumented)
  readonly read: number;
  toString(padZeroes?: boolean): string;
  // (undocumented)
  readonly write: number;
}

// @public
class EntityClass extends ECClass {
  constructor(schema: Schema, name: string, modifier?: ECClassModifier);
  // (undocumented)
  protected _mixins?: LazyLoadedMixin[];
  // (undocumented)
  protected addMixin(mixin: Mixin): void;
  // (undocumented)
  protected buildPropertyCache(result: Property[], existingValues?: Map<string, number>, resetBaseCaches?: boolean): Promise<void>;
  // (undocumented)
  protected buildPropertyCacheSync(result: Property[], existingValues?: Map<string, number>, resetBaseCaches?: boolean): void;
  // (undocumented)
  protected createNavigationProperty(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty>;
  // (undocumented)
  protected createNavigationPropertySync(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty;
  // WARNING: The type "EntityClassProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(entityClassProps: EntityClassProps): Promise<void>;
  // WARNING: The type "EntityClassProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(entityClassProps: EntityClassProps): void;
  getInheritedProperty(name: string): Promise<AnyProperty | undefined>;
  getInheritedPropertySync(name: string): Property | undefined;
  // (undocumented)
  getMixinsSync(): Iterable<Mixin>;
  // (undocumented)
  readonly mixins: LazyLoadedMixin[];
  // WARNING: The type "SchemaItemType.EntityClass" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.EntityClass;
  // (undocumented)
  toJson(standalone: boolean, includeSchemaVersion: boolean): any | void;
}

// @public
class Enumeration extends SchemaItem {
  // WARNING: The type "PrimitiveType.Integer" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "PrimitiveType.String" needs to be exported by the package (e.g. added to index.ts)
  constructor(schema: Schema, name: string, primitiveType?: PrimitiveType.Integer | PrimitiveType.String);
  // (undocumented)
  protected _enumerators: AnyEnumerator[];
  // (undocumented)
  protected _isStrict: boolean;
  // WARNING: The type "PrimitiveType.Integer" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "PrimitiveType.String" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected _type?: PrimitiveType.Integer | PrimitiveType.String;
  protected addEnumerator(enumerator: AnyEnumerator): void;
  createEnumerator(name: string, value: string | number, label?: string, description?: string): AnyEnumerator;
  // WARNING: The type "EnumerationProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(enumerationProps: EnumerationProps): Promise<void>;
  // WARNING: The type "EnumerationProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(enumerationProps: EnumerationProps): void;
  // (undocumented)
  readonly enumerators: Enumerator<string | number>[];
  getEnumerator(value: string): Enumerator<string> | undefined;
  getEnumeratorByName(name: string): AnyEnumerator | undefined;
  // (undocumented)
  readonly isInt: boolean;
  // (undocumented)
  readonly isStrict: boolean;
  // (undocumented)
  readonly isString: boolean;
  // WARNING: The type "SchemaItemType.Enumeration" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.Enumeration;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
  // WARNING: The type "PrimitiveType.Integer" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "PrimitiveType.String" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly type: PrimitiveType.Integer | PrimitiveType.String | undefined;
}

// @public (undocumented)
class EnumerationArrayProperty extends EnumerationArrayProperty_base {
  constructor(ecClass: ECClass, name: string, type: LazyLoadedEnumeration);
}

// @public (undocumented)
class EnumerationProperty extends PrimitiveOrEnumPropertyBase {
  constructor(ecClass: ECClass, name: string, type: LazyLoadedEnumeration);
  // (undocumented)
  protected _enumeration?: LazyLoadedEnumeration;
  // WARNING: The type "EnumerationPropertyProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(enumerationPropertyProps: EnumerationPropertyProps): Promise<void>;
  // WARNING: The type "EnumerationPropertyProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(enumerationPropertyProps: EnumerationPropertyProps): void;
  // (undocumented)
  readonly enumeration: LazyLoadedEnumeration | undefined;
  // (undocumented)
  toJson(): any;
}

// @public (undocumented)
interface Enumerator<T> {
  // (undocumented)
  readonly description?: string;
  // (undocumented)
  readonly label?: string;
  // (undocumented)
  readonly name: string;
  // (undocumented)
  readonly value: T;
}

// @public
class FileSchemaKey extends SchemaKey {
  constructor(key: SchemaKey, fileName: string, schemaJson?: string);
  // (undocumented)
  fileName: string;
  // (undocumented)
  schemaText?: string;
}

// @public (undocumented)
class Format extends SchemaItem {
  constructor(schema: Schema, name: string);
  // (undocumented)
  protected _decimalSeparator: string;
  // (undocumented)
  protected _formatTraits: FormatTraits;
  // (undocumented)
  protected _includeZero: boolean;
  // (undocumented)
  protected _minWidth?: number;
  // (undocumented)
  protected _precision: number;
  // (undocumented)
  protected _roundFactor: number;
  // (undocumented)
  protected _scientificType?: ScientificType;
  // (undocumented)
  protected _showSignOption: ShowSignOption;
  // (undocumented)
  protected _spacer: string;
  // (undocumented)
  protected _stationOffsetSize?: number;
  // (undocumented)
  protected _stationSeparator: string;
  // (undocumented)
  protected _thousandSeparator: string;
  // (undocumented)
  protected _type: FormatType;
  // (undocumented)
  protected _units?: Array<[Unit | InvertedUnit, string | undefined]>;
  // (undocumented)
  protected _uomSeparator: string;
  protected addUnit(unit: Unit | InvertedUnit, label?: string): void;
  // (undocumented)
  readonly decimalSeparator: string;
  // WARNING: The type "FormatProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(formatProps: FormatProps): Promise<void>;
  // WARNING: The type "FormatProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(formatProps: FormatProps): void;
  // (undocumented)
  readonly formatTraits: FormatTraits;
  // (undocumented)
  hasFormatTrait(formatTrait: FormatTraits): boolean;
  // (undocumented)
  readonly includeZero: boolean | undefined;
  // (undocumented)
  readonly minWidth: number | undefined;
  // (undocumented)
  readonly precision: DecimalPrecision | FractionalPrecision;
  // (undocumented)
  readonly roundFactor: number;
  // WARNING: The type "SchemaItemType.Format" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.Format;
  // (undocumented)
  readonly scientificType: ScientificType | undefined;
  // (undocumented)
  protected setPrecision(precision: number): void;
  // (undocumented)
  readonly showSignOption: ShowSignOption;
  // (undocumented)
  readonly spacer: string | undefined;
  // (undocumented)
  readonly stationOffsetSize: number | undefined;
  // (undocumented)
  readonly stationSeparator: string;
  // (undocumented)
  readonly thousandSeparator: string;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
  // (undocumented)
  readonly type: FormatType;
  // (undocumented)
  readonly units: Array<[Unit | InvertedUnit, string | undefined]> | undefined;
  // (undocumented)
  readonly uomSeparator: string;
}

// @public (undocumented)
enum FormatTraits {
  // (undocumented)
  ApplyRounding = 16,
  // (undocumented)
  ExponentOnlyNegative = 512,
  // (undocumented)
  FractionDash = 32,
  // (undocumented)
  KeepDecimalPoint = 8,
  // (undocumented)
  KeepSingleZero = 2,
  // (undocumented)
  PrependUnitLabel = 128,
  // (undocumented)
  ShowUnitLabel = 64,
  // (undocumented)
  TrailZeroes = 1,
  // (undocumented)
  Use1000Separator = 256,
  // (undocumented)
  ZeroEmpty = 4
}

// @public (undocumented)
export function formatTraitsToArray(currentFormatTrait: FormatTraits): string[];

// @public (undocumented)
enum FormatType {
  // (undocumented)
  Decimal = 0,
  // (undocumented)
  Fractional = 1,
  // (undocumented)
  Scientific = 2,
  // (undocumented)
  Station = 3
}

// @public (undocumented)
export function formatTypeToString(type: FormatType): string;

// @public (undocumented)
enum FractionalPrecision {
  // (undocumented)
  Eight = 8,
  // (undocumented)
  Four = 4,
  // (undocumented)
  One = 1,
  // (undocumented)
  OneHundredTwentyEight = 128,
  // (undocumented)
  Sixteen = 16,
  // (undocumented)
  SixtyFour = 64,
  // (undocumented)
  ThirtyTwo = 32,
  // (undocumented)
  Two = 2,
  // (undocumented)
  TwoHundredFiftySix = 256
}

// @public (undocumented)
export function getItemNamesFromFormatString(formatString: string): Iterable<string>;

// @public
interface IDiagnostic<TYPE extends AnyECType, ARGS extends any[]> {
  category: DiagnosticCategory;
  code: string;
  diagnosticType: DiagnosticType;
  ecDefinition: TYPE;
  messageArgs: ARGS;
  messageText: string;
}

// @public
interface IDiagnosticReporter {
  i18N?: I18N;
  report(diagnostic: AnyDiagnostic): void;
}

// @public
class InvertedUnit extends SchemaItem {
  constructor(schema: Schema, name: string);
  // (undocumented)
  protected _invertsUnit?: LazyLoadedUnit;
  // (undocumented)
  protected _unitSystem?: LazyLoadedUnitSystem;
  // WARNING: The type "InvertedUnitProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(invertedUnitProps: InvertedUnitProps): Promise<void>;
  // WARNING: The type "InvertedUnitProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(invertedUnitProps: InvertedUnitProps): void;
  // (undocumented)
  readonly invertsUnit: LazyLoadedUnit | undefined;
  // WARNING: The type "SchemaItemType.InvertedUnit" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.InvertedUnit;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
  // (undocumented)
  readonly unitSystem: LazyLoadedUnitSystem | undefined;
}

// @public
interface IRuleSet {
  classRules?: Array<IRule<AnyClass>>;
  constantRules?: Array<IRule<Constant>>;
  customAttributeClassRules?: Array<IRule<CustomAttributeClass>>;
  customAttributeContainerRules?: Array<IRule<CustomAttributeContainerProps>>;
  customAttributeInstanceRules?: Array<BaseRule<CustomAttributeContainerProps, CustomAttribute>>;
  entityClassRules?: Array<IRule<EntityClass>>;
  enumerationRules?: Array<IRule<Enumeration>>;
  formatRules?: Array<IRule<Format>>;
  invertedUnitRules?: Array<IRule<InvertedUnit>>;
  kindOfQuantityRules?: Array<IRule<KindOfQuantity>>;
  mixinRules?: Array<IRule<Mixin>>;
  name: string;
  phenomenonRules?: Array<IRule<Phenomenon>>;
  propertyCategoryRules?: Array<IRule<PropertyCategory>>;
  propertyRules?: Array<IRule<AnyProperty>>;
  relationshipConstraintRules?: Array<IRule<RelationshipConstraint>>;
  relationshipRules?: Array<IRule<RelationshipClass>>;
  schemaItemRules?: Array<IRule<SchemaItem>>;
  schemaRules?: Array<IRule<Schema>>;
  structClassRules?: Array<IRule<StructClass>>;
  unitRules?: Array<IRule<Unit>>;
  unitSystemRules?: Array<IRule<UnitSystem>>;
}

// @public (undocumented)
interface ISchemaItemLocater {
  // (undocumented)
  getSchemaItem<T extends SchemaItem>(schemaItemKey: SchemaItemKey): Promise<T | undefined>;
}

// @public
interface ISchemaLocater {
  getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext): Promise<T | undefined>;
  getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext): T | undefined;
}

// @public
interface ISchemaPartVisitor {
  visitClass?: (ecClass: AnyClass) => Promise<void>;
  visitClassSync?: (ecClass: AnyClass) => void;
  visitConstant?: (constant: Constant) => Promise<void>;
  visitConstantSync?: (constant: Constant) => void;
  visitCustomAttributeClass?: (customAttributeClass: CustomAttributeClass) => Promise<void>;
  visitCustomAttributeClassSync?: (customAttributeClass: CustomAttributeClass) => void;
  visitCustomAttributeContainer?: (customAttributeContainer: CustomAttributeContainerProps) => Promise<void>;
  visitCustomAttributeContainerSync?: (customAttributeContainer: CustomAttributeContainerProps) => void;
  visitEmptySchema?: (schema: Schema) => Promise<void>;
  visitEmptySchemaSync?: (schema: Schema) => void;
  visitEntityClass?: (entityClass: EntityClass) => Promise<void>;
  visitEntityClassSync?: (entityClass: EntityClass) => void;
  visitEnumeration?: (enumeration: Enumeration) => Promise<void>;
  visitEnumerationSync?: (enumeration: Enumeration) => void;
  visitFormat?: (format: Format) => Promise<void>;
  visitFormatSync?: (format: Format) => void;
  visitFullSchema?: (schema: Schema) => Promise<void>;
  visitFullSchemaSync?: (schema: Schema) => void;
  visitInvertedUnit?: (invertedUnit: InvertedUnit) => Promise<void>;
  visitInvertedUnitSync?: (invertedUnit: InvertedUnit) => void;
  visitKindOfQuantity?: (koq: KindOfQuantity) => Promise<void>;
  visitKindOfQuantitySync?: (koq: KindOfQuantity) => void;
  visitMixin?: (mixin: Mixin) => Promise<void>;
  visitMixinSync?: (mixin: Mixin) => void;
  visitPhenomenon?: (phenomena: Phenomenon) => Promise<void>;
  visitPhenomenonSync?: (phenomena: Phenomenon) => void;
  visitProperty?: (property: AnyProperty) => Promise<void>;
  visitPropertyCategory?: (category: PropertyCategory) => Promise<void>;
  visitPropertyCategorySync?: (category: PropertyCategory) => void;
  visitPropertySync?: (property: AnyProperty) => void;
  visitRelationshipClass?: (relationshipClass: RelationshipClass) => Promise<void>;
  visitRelationshipClassSync?: (relationshipClass: RelationshipClass) => void;
  visitRelationshipConstraint?: (relationshipConstraint: RelationshipConstraint) => Promise<void>;
  visitRelationshipConstraintSync?: (relationshipConstraint: RelationshipConstraint) => void;
  visitSchemaItem?: (schemaItem: SchemaItem) => Promise<void>;
  visitSchemaItemSync?: (schemaItem: SchemaItem) => void;
  visitStructClass?: (structClass: StructClass) => Promise<void>;
  visitStructClassSync?: (structClass: StructClass) => void;
  visitUnit?: (unit: Unit) => Promise<void>;
  visitUnitSync?: (unit: Unit) => void;
  visitUnitSystem?: (unitSystem: UnitSystem) => Promise<void>;
  visitUnitSystemSync?: (unitSystem: UnitSystem) => void;
}

// @public
class KindOfQuantity extends SchemaItem {
  constructor(schema: Schema, name: string);
  // (undocumented)
  protected _persistenceUnit?: LazyLoadedUnit | LazyLoadedInvertedUnit;
  // (undocumented)
  protected _presentationUnits: Array<Format | OverrideFormat>;
  // (undocumented)
  protected _relativeError: number;
  // (undocumented)
  protected addPresentationFormat(format: Format | OverrideFormat, isDefault?: boolean): void;
  // (undocumented)
  protected createFormatOverride(parent: Format, name: string, precision?: number, unitLabelOverrides?: Array<[Unit | InvertedUnit, string | undefined]>): OverrideFormat;
  // (undocumented)
  readonly defaultPresentationFormat: undefined | Format | OverrideFormat;
  // WARNING: The type "KindOfQuantityProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(kindOfQuantityProps: KindOfQuantityProps): Promise<void>;
  // WARNING: The type "KindOfQuantityProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(kindOfQuantityProps: KindOfQuantityProps): void;
  // (undocumented)
  persistenceUnit: LazyLoadedUnit | LazyLoadedInvertedUnit | undefined;
  // (undocumented)
  readonly presentationUnits: Array<Format | OverrideFormat> | undefined;
  // (undocumented)
  readonly relativeError: number;
  // WARNING: The type "SchemaItemType.KindOfQuantity" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.KindOfQuantity;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
}

// @public
class LoggingDiagnosticReporter extends DiagnosticReporterBase {
  // (undocumented)
  reportDiagnostic(diagnostic: AnyDiagnostic, messageText: string): void;
}

// @public
class Mixin extends ECClass {
  constructor(schema: Schema, name: string);
  // (undocumented)
  protected _appliesTo?: LazyLoadedEntityClass;
  // (undocumented)
  applicableTo(entityClass: EntityClass): Promise<boolean>;
  // (undocumented)
  readonly appliesTo: LazyLoadedEntityClass | undefined;
  // (undocumented)
  protected createNavigationProperty(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty>;
  // (undocumented)
  protected createNavigationPropertySync(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty;
  // WARNING: The type "MixinProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(mixinProps: MixinProps): Promise<void>;
  // WARNING: The type "MixinProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(mixinProps: MixinProps): void;
  // WARNING: The type "SchemaItemType.Mixin" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.Mixin;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
}

// @public (undocumented)
class NavigationProperty extends Property {
  constructor(ecClass: ECClass, name: string, relationship: LazyLoadedRelationshipClass, direction?: StrengthDirection);
  // (undocumented)
  protected _direction: StrengthDirection;
  // (undocumented)
  protected _relationshipClass: LazyLoadedRelationshipClass;
  // (undocumented)
  readonly direction: StrengthDirection;
  // (undocumented)
  getRelationshipClassSync(): RelationshipClass | undefined;
  // (undocumented)
  readonly relationshipClass: LazyLoadedRelationshipClass;
  // (undocumented)
  toJson(): any;
}

// @public (undocumented)
interface NoDelayedPromiseMethods {
  // (undocumented)
  [propName: string]: any;
  // (undocumented)
  catch?: never;
  // (undocumented)
  start?: never;
  // (undocumented)
  then?: never;
}

// @public
class OverrideFormat {
  constructor(parent: Format, name: string, precision?: DecimalPrecision | FractionalPrecision, unitAndLabels?: Array<[Unit | InvertedUnit, string | undefined]>);
  // (undocumented)
  readonly decimalSeparator: string;
  // (undocumented)
  readonly formatTraits: FormatTraits;
  // (undocumented)
  readonly fullName: string;
  // (undocumented)
  hasFormatTrait(formatTrait: FormatTraits): boolean;
  // (undocumented)
  readonly includeZero: boolean | undefined;
  // (undocumented)
  readonly minWidth: number | undefined;
  readonly name: string;
  readonly parent: Format;
  // (undocumented)
  readonly precision: DecimalPrecision | FractionalPrecision;
  // (undocumented)
  readonly roundFactor: number;
  // (undocumented)
  readonly scientificType: ScientificType | undefined;
  // (undocumented)
  readonly showSignOption: ShowSignOption;
  // (undocumented)
  readonly spacer: string | undefined;
  // (undocumented)
  readonly stationOffsetSize: number | undefined;
  // (undocumented)
  readonly stationSeparator: string;
  // (undocumented)
  readonly thousandSeparator: string;
  // (undocumented)
  readonly type: FormatType;
  // (undocumented)
  readonly units: [Unit | InvertedUnit, string | undefined][] | undefined;
  // (undocumented)
  readonly uomSeparator: string;
}

// @public
export function parseClassModifier(modifier: string): ECClassModifier | undefined;

// @public
export function parseCustomAttributeContainerType(type: string): CustomAttributeContainerType | undefined;

// @public (undocumented)
export function parseDecimalPrecision(jsonObjPrecision: number): DecimalPrecision | undefined;

// @public (undocumented)
export function parseFormatTrait(formatTraitsString: string): FormatTraits | undefined;

// @public (undocumented)
export function parseFormatType(jsonObjType: string): FormatType | undefined;

// @public (undocumented)
export function parseFractionalPrecision(jsonObjPrecision: number): FractionalPrecision | undefined;

// @public (undocumented)
export function parsePrecision(precision: number, type: FormatType): DecimalPrecision | FractionalPrecision | undefined;

// @public
export function parsePrimitiveType(type: string): PrimitiveType | undefined;

// @public (undocumented)
export function parseRelationshipEnd(end: string): RelationshipEnd | undefined;

// @public
export function parseSchemaItemType(type: string): SchemaItemType | undefined;

// @public (undocumented)
export function parseScientificType(scientificType: string): ScientificType | undefined;

// @public (undocumented)
export function parseShowSignOption(showSignOption: string): ShowSignOption | undefined;

// @public
export function parseStrength(strength: string): StrengthType | undefined;

// @public (undocumented)
export function parseStrengthDirection(direction: string): StrengthDirection | undefined;

// @public (undocumented)
class Phenomenon extends SchemaItem {
  constructor(schema: Schema, name: string);
  // (undocumented)
  protected _definition: string;
  // (undocumented)
  readonly definition: string;
  // WARNING: The type "PhenomenonProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(phenomenonProps: PhenomenonProps): Promise<void>;
  // WARNING: The type "PhenomenonProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(phenomenonProps: PhenomenonProps): void;
  // WARNING: The type "SchemaItemType.Phenomenon" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.Phenomenon;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
}

// @public (undocumented)
class PrimitiveArrayProperty extends PrimitiveArrayProperty_base {
  constructor(ecClass: ECClass, name: string, primitiveType?: PrimitiveType);
}

// @public (undocumented)
class PrimitiveOrEnumPropertyBase extends Property {
  constructor(ecClass: ECClass, name: string, type: PropertyType);
  // (undocumented)
  protected _extendedTypeName?: string;
  // (undocumented)
  protected _maxLength?: number;
  // (undocumented)
  protected _maxValue?: number;
  // (undocumented)
  protected _minLength?: number;
  // (undocumented)
  protected _minValue?: number;
  // WARNING: The type "PrimitiveOrEnumPropertyBaseProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(propertyBaseProps: PrimitiveOrEnumPropertyBaseProps): Promise<void>;
  // WARNING: The type "PrimitiveOrEnumPropertyBaseProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(propertyBaseProps: PrimitiveOrEnumPropertyBaseProps): void;
  // (undocumented)
  readonly extendedTypeName: string | undefined;
  // (undocumented)
  readonly maxLength: number | undefined;
  // (undocumented)
  readonly maxValue: number | undefined;
  // (undocumented)
  readonly minLength: number | undefined;
  // (undocumented)
  readonly minValue: number | undefined;
  // (undocumented)
  toJson(): any;
}

// @public (undocumented)
class PrimitiveProperty extends PrimitiveOrEnumPropertyBase {
  constructor(ecClass: ECClass, name: string, primitiveType?: PrimitiveType);
  // WARNING: The type "PrimitivePropertyProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(primitivePropertyProps: PrimitivePropertyProps): Promise<void>;
  // WARNING: The type "PrimitivePropertyProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(primitivePropertyProps: PrimitivePropertyProps): void;
  // (undocumented)
  readonly primitiveType: PrimitiveType;
  // (undocumented)
  toJson(): any;
}

// @public
enum PrimitiveType {
  // (undocumented)
  Binary = 257,
  // (undocumented)
  Boolean = 513,
  // (undocumented)
  DateTime = 769,
  // (undocumented)
  Double = 1025,
  // (undocumented)
  IGeometry = 2561,
  // (undocumented)
  Integer = 1281,
  // (undocumented)
  Long = 1537,
  // (undocumented)
  Point2d = 1793,
  // (undocumented)
  Point3d = 2049,
  // (undocumented)
  String = 2305,
  // (undocumented)
  Uninitialized = 0
}

// @public (undocumented)
export function primitiveTypeToString(type: PrimitiveType): string;

// @public
class Property implements CustomAttributeContainerProps {
  constructor(ecClass: ECClass, name: string, type: PropertyType);
  // (undocumented)
  protected _category?: LazyLoadedPropertyCategory;
  // (undocumented)
  protected _class: AnyClass;
  // (undocumented)
  protected _description?: string;
  // (undocumented)
  protected _isReadOnly?: boolean;
  // (undocumented)
  protected _kindOfQuantity?: LazyLoadedKindOfQuantity;
  // (undocumented)
  protected _label?: string;
  // (undocumented)
  protected _name: ECName;
  // (undocumented)
  protected _priority?: number;
  // (undocumented)
  protected _type: PropertyType;
  // WARNING: The type "CustomAttribute" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected addCustomAttribute(customAttribute: CustomAttribute): void;
  // (undocumented)
  readonly category: LazyLoadedPropertyCategory | undefined;
  // (undocumented)
  readonly class: AnyClass;
  // WARNING: The type "CustomAttributeSet" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly customAttributes: CustomAttributeSet | undefined;
  // (undocumented)
  readonly description: string | undefined;
  // WARNING: The type "PropertyProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(propertyProps: PropertyProps): Promise<void>;
  // WARNING: The type "PropertyProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(propertyProps: PropertyProps): void;
  readonly fullName: string;
  // (undocumented)
  getCategorySync(): PropertyCategory | undefined;
  // (undocumented)
  getKindOfQuantitySync(): KindOfQuantity | undefined;
  // (undocumented)
  isArray(): this is AnyArrayProperty;
  // (undocumented)
  isEnumeration(): this is AnyEnumerationProperty;
  // (undocumented)
  isNavigation(): this is NavigationProperty;
  // (undocumented)
  isPrimitive(): this is AnyPrimitiveProperty;
  // (undocumented)
  readonly isReadOnly: boolean;
  // (undocumented)
  isStruct(): this is AnyStructProperty;
  // (undocumented)
  readonly kindOfQuantity: LazyLoadedKindOfQuantity | undefined;
  // (undocumented)
  readonly label: string | undefined;
  // (undocumented)
  readonly name: string;
  // (undocumented)
  readonly priority: number;
  readonly schema: Schema;
  // (undocumented)
  toJson(): any;
}

// @public (undocumented)
class PropertyCategory extends SchemaItem {
  constructor(schema: Schema, name: string);
  // (undocumented)
  protected _priority: number;
  // WARNING: The type "PropertyCategoryProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(propertyCategoryProps: PropertyCategoryProps): Promise<void>;
  // WARNING: The type "PropertyCategoryProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(propertyCategoryProps: PropertyCategoryProps): void;
  // (undocumented)
  readonly priority: number;
  // WARNING: The type "SchemaItemType.PropertyCategory" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.PropertyCategory;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
}

// @public
class PropertyDiagnostic<ARGS extends any[]> extends BaseDiagnostic<AnyProperty, ARGS> {
  constructor(property: AnyProperty, messageArgs: ARGS);
  // (undocumented)
  readonly diagnosticType: DiagnosticType;
}

// @public (undocumented)
enum PropertyType {
  // (undocumented)
  Binary = 257,
  // (undocumented)
  Binary_Array = 261,
  // (undocumented)
  Boolean = 513,
  // (undocumented)
  Boolean_Array = 517,
  // (undocumented)
  DateTime = 769,
  // (undocumented)
  DateTime_Array = 773,
  // (undocumented)
  Double = 1025,
  // (undocumented)
  Double_Array = 1029,
  // (undocumented)
  IGeometry = 2561,
  // (undocumented)
  IGeometry_Array = 2565,
  // (undocumented)
  Integer = 1281,
  // (undocumented)
  Integer_Array = 1285,
  // (undocumented)
  Integer_Enumeration = 1297,
  // (undocumented)
  Integer_Enumeration_Array = 1301,
  // (undocumented)
  Long = 1537,
  // (undocumented)
  Long_Array = 1541,
  // (undocumented)
  Navigation = 8,
  // (undocumented)
  Point2d = 1793,
  // (undocumented)
  Point2d_Array = 1797,
  // (undocumented)
  Point3d = 2049,
  // (undocumented)
  Point3d_Array = 2053,
  // (undocumented)
  String = 2305,
  // (undocumented)
  String_Array = 2309,
  // (undocumented)
  String_Enumeration = 2321,
  // (undocumented)
  String_Enumeration_Array = 2325,
  // (undocumented)
  Struct = 2,
  // (undocumented)
  Struct_Array = 6
}

// @public (undocumented)
export function propertyTypeToString(type: PropertyType): "PrimitiveProperty" | "StructProperty" | "StructArrayProperty" | "NavigationProperty" | "PrimitiveArrayProperty";

// @public (undocumented)
module PropertyTypeUtils {
  // (undocumented)
  function asArray(t: PropertyType): PropertyType;

  // (undocumented)
  function fromPrimitiveType(t: PrimitiveType): PropertyType;

  // (undocumented)
  function getPrimitiveType(t: PropertyType): PrimitiveType;

  // (undocumented)
  function isArray(t: PropertyType): boolean;

  // (undocumented)
  function isEnumeration(t: PropertyType): boolean;

  // (undocumented)
  function isNavigation(t: PropertyType): boolean;

  // (undocumented)
  function isPrimitive(t: PropertyType): boolean;

  // (undocumented)
  function isStruct(t: PropertyType): boolean;

}

// @public
class RelationshipClass extends ECClass {
  constructor(schema: Schema, name: string, modifier?: ECClassModifier);
  // (undocumented)
  protected _source: RelationshipConstraint;
  // (undocumented)
  protected _strength: StrengthType;
  // (undocumented)
  protected _strengthDirection: StrengthDirection;
  // (undocumented)
  protected _target: RelationshipConstraint;
  // (undocumented)
  protected createNavigationProperty(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty>;
  // (undocumented)
  protected createNavigationPropertySync(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty;
  // WARNING: The type "RelationshipClassProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(relationshipClassProps: RelationshipClassProps): Promise<void>;
  // WARNING: The type "RelationshipClassProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(relationshipClassProps: RelationshipClassProps): void;
  // (undocumented)
  readonly schema: Schema;
  // WARNING: The type "SchemaItemType.RelationshipClass" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.RelationshipClass;
  // (undocumented)
  readonly source: RelationshipConstraint;
  // (undocumented)
  readonly strength: StrengthType;
  // (undocumented)
  readonly strengthDirection: StrengthDirection;
  // (undocumented)
  readonly target: RelationshipConstraint;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
}

// @public
class RelationshipConstraint implements CustomAttributeContainerProps {
  constructor(relClass: RelationshipClass, relEnd: RelationshipEnd, roleLabel?: string, polymorphic?: boolean);
  // (undocumented)
  protected _abstractConstraint?: LazyLoadedRelationshipConstraintClass;
  // (undocumented)
  protected _constraintClasses?: LazyLoadedRelationshipConstraintClass[];
  // (undocumented)
  protected _multiplicity?: RelationshipMultiplicity;
  // (undocumented)
  protected _polymorphic?: boolean;
  // (undocumented)
  protected _relationshipClass: RelationshipClass;
  // (undocumented)
  protected _relationshipEnd: RelationshipEnd;
  // (undocumented)
  protected _roleLabel?: string;
  // (undocumented)
  abstractConstraint: LazyLoadedRelationshipConstraintClass | undefined;
  addClass(constraint: EntityClass | Mixin | RelationshipClass): void;
  // WARNING: The type "CustomAttribute" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected addCustomAttribute(customAttribute: CustomAttribute): void;
  static classCompatibleWithConstraint(constraintClass: ECClass, testClass: ECClass, isPolymorphic: boolean): Promise<boolean>;
  // (undocumented)
  readonly constraintClasses: LazyLoadedRelationshipConstraintClass[] | undefined;
  // WARNING: The type "CustomAttributeSet" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly customAttributes: CustomAttributeSet | undefined;
  // WARNING: The type "RelationshipConstraintProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(relationshipConstraintProps: RelationshipConstraintProps): Promise<void>;
  // WARNING: The type "RelationshipConstraintProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(relationshipConstraintProps: RelationshipConstraintProps): void;
  readonly fullName: "Source" | "Target";
  readonly isSource: boolean;
  // (undocumented)
  readonly multiplicity: RelationshipMultiplicity | undefined;
  // (undocumented)
  readonly polymorphic: boolean | undefined;
  // (undocumented)
  readonly relationshipClass: RelationshipClass;
  // (undocumented)
  readonly relationshipEnd: RelationshipEnd;
  // (undocumented)
  readonly roleLabel: string | undefined;
  readonly schema: Schema;
  supportsClass(ecClass: ECClass): Promise<boolean>;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
}

// @public
class RelationshipConstraintDiagnostic<ARGS extends any[]> extends BaseDiagnostic<RelationshipConstraint, ARGS> {
  constructor(constraint: RelationshipConstraint, messageArgs: ARGS);
  // (undocumented)
  readonly diagnosticType: DiagnosticType;
}

// @public
enum RelationshipEnd {
  // (undocumented)
  Source = 0,
  // (undocumented)
  Target = 1
}

// @public (undocumented)
export function relationshipEndToString(end: RelationshipEnd): string;

// @public (undocumented)
class RelationshipMultiplicity {
  constructor(lowerLimit: number, upperLimit: number);
  // (undocumented)
  equals(rhs: RelationshipMultiplicity): boolean;
  // (undocumented)
  static fromString(str: string): RelationshipMultiplicity | undefined;
  // (undocumented)
  readonly lowerLimit: number;
  // (undocumented)
  static readonly oneMany: RelationshipMultiplicity;
  // (undocumented)
  static readonly oneOne: RelationshipMultiplicity;
  // (undocumented)
  toString(): string;
  // (undocumented)
  readonly upperLimit: number;
  // (undocumented)
  static readonly zeroMany: RelationshipMultiplicity;
  // (undocumented)
  static readonly zeroOne: RelationshipMultiplicity;
}

// @public (undocumented)
class Schema implements CustomAttributeContainerProps {
  constructor(context: SchemaContext, name: string, readVersion: number, writeVersion: number, minorVersion: number);
  // (undocumented)
  protected _alias?: string;
  // (undocumented)
  protected _description?: string;
  // (undocumented)
  protected _label?: string;
  // (undocumented)
  protected _schemaKey?: SchemaKey;
  // WARNING: The type "CustomAttribute" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected addCustomAttribute(customAttribute: CustomAttribute): void;
  // (undocumented)
  protected addItem<T extends SchemaItem>(item: T): void;
  // (undocumented)
  protected addReference(refSchema: Schema): Promise<void>;
  // (undocumented)
  protected addReferenceSync(refSchema: Schema): void;
  // (undocumented)
  readonly alias: string | undefined;
  readonly context: SchemaContext;
  protected createConstant(name: string): Promise<Constant>;
  // (undocumented)
  protected createConstantSync(name: string): Constant;
  protected createCustomAttributeClass(name: string, modifier?: ECClassModifier): Promise<CustomAttributeClass>;
  // (undocumented)
  protected createCustomAttributeClassSync(name: string, modifier?: ECClassModifier): CustomAttributeClass;
  protected createEntityClass(name: string, modifier?: ECClassModifier): Promise<EntityClass>;
  // (undocumented)
  protected createEntityClassSync(name: string, modifier?: ECClassModifier): EntityClass;
  // WARNING: The type "PrimitiveType.Integer" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "PrimitiveType.String" needs to be exported by the package (e.g. added to index.ts)
  protected createEnumeration(name: string, primitiveType?: PrimitiveType.Integer | PrimitiveType.String): Promise<Enumeration>;
  // WARNING: The type "PrimitiveType.Integer" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "PrimitiveType.String" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected createEnumerationSync(name: string, primitiveType?: PrimitiveType.Integer | PrimitiveType.String): Enumeration;
  protected createFormat(name: string): Promise<Format>;
  // (undocumented)
  protected createFormatSync(name: string): Format;
  protected createInvertedUnit(name: string): Promise<InvertedUnit>;
  // (undocumented)
  protected createInvertedUnitSync(name: string): InvertedUnit;
  protected createKindOfQuantity(name: string): Promise<KindOfQuantity>;
  // (undocumented)
  protected createKindOfQuantitySync(name: string): KindOfQuantity;
  protected createMixinClass(name: string): Promise<Mixin>;
  // (undocumented)
  protected createMixinClassSync(name: string): Mixin;
  protected createPhenomenon(name: string): Promise<Phenomenon>;
  // (undocumented)
  protected createPhenomenonSync(name: string): Phenomenon;
  protected createPropertyCategory(name: string): Promise<PropertyCategory>;
  // (undocumented)
  protected createPropertyCategorySync(name: string): PropertyCategory;
  protected createRelationshipClass(name: string, modifier?: ECClassModifier): Promise<RelationshipClass>;
  // (undocumented)
  protected createRelationshipClassSync(name: string, modifier?: ECClassModifier): RelationshipClass;
  protected createStructClass(name: string, modifier?: ECClassModifier): Promise<StructClass>;
  // (undocumented)
  protected createStructClassSync(name: string, modifier?: ECClassModifier): StructClass;
  protected createUnit(name: string): Promise<Unit>;
  // (undocumented)
  protected createUnitSync(name: string): Unit;
  protected createUnitSystem(name: string): Promise<UnitSystem>;
  // (undocumented)
  protected createUnitSystemSync(name: string): UnitSystem;
  // WARNING: The type "CustomAttributeSet" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly customAttributes: CustomAttributeSet | undefined;
  // (undocumented)
  readonly description: string | undefined;
  // WARNING: The type "SchemaProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(schemaProps: SchemaProps): Promise<void>;
  // WARNING: The type "SchemaProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(schemaProps: SchemaProps): void;
  // (undocumented)
  static fromJson(jsonObj: object | string, context: SchemaContext): Promise<Schema>;
  // (undocumented)
  static fromJsonSync(jsonObj: object | string, context: SchemaContext): Schema;
  readonly fullName: string;
  // (undocumented)
  getClasses(): IterableIterator<ECClass>;
  getItem<T extends SchemaItem>(name: string): Promise<T | undefined>;
  // (undocumented)
  getItems<T extends AnySchemaItem>(): IterableIterator<T>;
  getItemSync<T extends SchemaItem>(name: string): T | undefined;
  // (undocumented)
  getReference<T extends Schema>(refSchemaName: string): Promise<T | undefined>;
  // (undocumented)
  getReferenceSync<T extends Schema>(refSchemaName: string): T | undefined;
  getSchemaItemKey(fullName: string): SchemaItemKey;
  // (undocumented)
  readonly label: string | undefined;
  lookupItem<T extends SchemaItem>(key: Readonly<SchemaItemKey> | string): Promise<T | undefined>;
  lookupItemSync<T extends SchemaItem>(key: Readonly<SchemaItemKey> | string): T | undefined;
  // (undocumented)
  readonly minorVersion: number;
  // (undocumented)
  readonly name: string;
  // (undocumented)
  readonly readVersion: number;
  // (undocumented)
  readonly references: Schema[];
  readonly schema: Schema;
  // (undocumented)
  readonly schemaKey: SchemaKey;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
  // (undocumented)
  readonly writeVersion: number;
}

// @public (undocumented)
class SchemaCache implements ISchemaLocater {
  constructor();
  addSchema<T extends Schema>(schema: T): Promise<void>;
  addSchemaSync<T extends Schema>(schema: T): void;
  // (undocumented)
  readonly count: number;
  getSchema<T extends Schema>(schemaKey: SchemaKey, matchType?: SchemaMatchType): Promise<T | undefined>;
  // (undocumented)
  getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType?: SchemaMatchType): T | undefined;
}

// @public
class SchemaContext implements ISchemaLocater, ISchemaItemLocater {
  constructor();
  // (undocumented)
  addLocater(locater: ISchemaLocater): void;
  addSchema(schema: Schema): Promise<void>;
  addSchemaItem(schemaItem: SchemaItem): Promise<void>;
  addSchemaSync(schema: Schema): void;
  // (undocumented)
  getSchema<T extends Schema>(schemaKey: SchemaKey, matchType?: SchemaMatchType): Promise<T | undefined>;
  // (undocumented)
  getSchemaItem<T extends SchemaItem>(schemaItemKey: SchemaItemKey): Promise<T | undefined>;
  // (undocumented)
  getSchemaItemSync<T extends SchemaItem>(schemaItemKey: SchemaItemKey): T | undefined;
  // (undocumented)
  getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType?: SchemaMatchType): T | undefined;
}

// @public
class SchemaDiagnostic<ARGS extends any[]> extends BaseDiagnostic<Schema, ARGS> {
  constructor(schema: Schema, messageArgs: ARGS);
  // (undocumented)
  static diagnosticType: DiagnosticType;
}

// @public
class SchemaFileLocater {
  constructor();
  addSchemaSearchPath(schemaPath: string): void;
  addSchemaSearchPaths(schemaPaths: string[]): void;
  compareSchemaKeyByVersion(lhs: FileSchemaKey, rhs: FileSchemaKey): number;
  // (undocumented)
  fileExists(filePath: string): Promise<boolean | undefined>;
  protected findEligibleSchemaKeys(desiredKey: SchemaKey, matchType: SchemaMatchType, format: string): FileSchemaKey[];
  // (undocumented)
  abstract getSchema<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<T | undefined>;
  // (undocumented)
  protected abstract getSchemaKey(data: string): SchemaKey;
  // (undocumented)
  readUtf8FileToString(filePath: string): Promise<string | undefined>;
  // (undocumented)
  searchPaths: string[];
}

// @public
class SchemaGraphUtil {
  static buildDependencyOrderedSchemaList(insertSchema: Schema, schemas?: Schema[]): Schema[];
}

// @public
class SchemaItem {
  constructor(schema: Schema, name: string);
  // (undocumented)
  protected _description?: string;
  // (undocumented)
  protected _key: SchemaItemKey;
  // (undocumented)
  protected _label?: string;
  // (undocumented)
  readonly description: string | undefined;
  // WARNING: The type "SchemaItemProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(schemaItemProps: SchemaItemProps): Promise<void>;
  // WARNING: The type "SchemaItemProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(schemaItemProps: SchemaItemProps): void;
  static equalByKey(thisSchemaItem: SchemaItem, thatSchemaItemOrKey?: SchemaItem | SchemaItemKey): boolean;
  // (undocumented)
  readonly fullName: string;
  // (undocumented)
  readonly key: SchemaItemKey;
  // (undocumented)
  readonly label: string | undefined;
  // (undocumented)
  readonly name: string;
  static parseFullName(fullName: string): [string, string];
  // (undocumented)
  readonly schema: Schema;
  // (undocumented)
  readonly schemaItemType: SchemaItemType;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
}

// @public
class SchemaItemDiagnostic<TYPE extends AnyECType, ARGS extends any[]> extends BaseDiagnostic<TYPE, ARGS> {
  constructor(ecDefinition: TYPE, messageArgs: ARGS);
  // (undocumented)
  static diagnosticType: DiagnosticType;
}

// @public
class SchemaItemKey {
  constructor(name: string, schema: SchemaKey);
  // (undocumented)
  protected _schemaKey: SchemaKey;
  // (undocumented)
  readonly fullName: string;
  matches(rhs: SchemaItemKey): boolean;
  // (undocumented)
  matchesFullName(rhs: string): boolean;
  // (undocumented)
  readonly name: string;
  // (undocumented)
  readonly schemaKey: SchemaKey;
  // (undocumented)
  readonly schemaName: string;
}

// @public (undocumented)
enum SchemaItemType {
  // (undocumented)
  Constant = 10,
  // (undocumented)
  CustomAttributeClass = 3,
  // (undocumented)
  EntityClass = 0,
  // (undocumented)
  Enumeration = 5,
  // (undocumented)
  Format = 13,
  // (undocumented)
  InvertedUnit = 9,
  // (undocumented)
  KindOfQuantity = 6,
  // (undocumented)
  Mixin = 1,
  // (undocumented)
  Phenomenon = 11,
  // (undocumented)
  PropertyCategory = 7,
  // (undocumented)
  RelationshipClass = 4,
  // (undocumented)
  StructClass = 2,
  // (undocumented)
  Unit = 8,
  // (undocumented)
  UnitSystem = 12
}

// @public
export function schemaItemTypeToString(value: SchemaItemType): string;

// @public
class SchemaJsonFileLocater extends SchemaFileLocater, implements ISchemaLocater {
  getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<T | undefined>;
  protected getSchemaKey(data: string): SchemaKey;
  getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): T | undefined;
}

// @public
class SchemaKey {
  constructor(name: string, version: ECVersion);
  // (undocumented)
  protected _version: ECVersion;
  // (undocumented)
  compareByName(rhs: SchemaKey | string | undefined): boolean;
  compareByVersion(rhs: SchemaKey): number;
  // (undocumented)
  matches(rhs: SchemaKey, matchType?: SchemaMatchType): boolean;
  // (undocumented)
  readonly minorVersion: number;
  // (undocumented)
  readonly name: string;
  // (undocumented)
  static parseString(fullName: string): SchemaKey;
  // (undocumented)
  readonly readVersion: number;
  toString(padZeroes?: boolean): string;
  // (undocumented)
  readonly version: ECVersion;
  // (undocumented)
  readonly writeVersion: number;
}

// @public (undocumented)
class SchemaMap extends Array<Schema> {
}

// @public
enum SchemaMatchType {
  // (undocumented)
  Exact = 1,
  // (undocumented)
  Identical = 0,
  // (undocumented)
  Latest = 3,
  // (undocumented)
  LatestReadCompatible = 4,
  // (undocumented)
  LatestWriteCompatible = 2
}

// @public
class SchemaPartVisitorDelegate {
  constructor(visitor: ISchemaPartVisitor);
  visitSchema(schema: Schema, fullSchema?: boolean): Promise<void>;
  visitSchemaPart(schemaPart: AnyECType): Promise<void>;
  visitSchemaPartSync(schemaPart: AnyECType): void;
  visitSchemaSync(schema: Schema, fullSchema?: boolean): void;
}

// @public
class SchemaValidationVisitor implements ISchemaPartVisitor {
  // (undocumented)
  applyClassRules(ecClass: AnyClass, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyConstantRules(constant: Constant, ruleSet: IRuleSet): Promise<void>;
  // WARNING: The type "CustomAttributeContainerProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  applyCustomAttributeContainerRules(container: CustomAttributeContainerProps, ruleSet: IRuleSet): Promise<void>;
  // WARNING: The type "CustomAttributeContainerProps" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "CustomAttribute" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  applyCustomAttributeInstanceRules(container: CustomAttributeContainerProps, customAttribute: CustomAttribute, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyCustomAttributeRules(customAttribute: CustomAttributeClass, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyEntityRules(entityClass: EntityClass, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyEnumerationRules(enumeration: Enumeration, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyFormatRules(format: Format, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyInvertedUnitRules(invertedUnit: InvertedUnit, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyKindOfQuantityRules(kindOfQuantity: KindOfQuantity, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyMixinRules(mixin: Mixin, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyPhenomenonRules(phenomenon: Phenomenon, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyPropertyCategoryRules(propertyCategory: PropertyCategory, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyPropertyRules(property: AnyProperty, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyRelationshipConstraintRules(constraint: RelationshipConstraint, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyRelationshipRules(relationship: RelationshipClass, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applySchemaItemRules(schemaItem: SchemaItem, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applySchemaRules(schema: Schema, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyStructRules(structClass: StructClass, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyUnitRules(unit: Unit, ruleSet: IRuleSet): Promise<void>;
  // (undocumented)
  applyUnitSystemRules(unitSystem: UnitSystem, ruleSet: IRuleSet): Promise<void>;
  readonly diagnosticReporters: IDiagnosticReporter[];
  registerReporter(...reporters: IDiagnosticReporter[]): void;
  registerRuleSet(ruleSet: IRuleSet): void;
  // WARNING: The type "RuleSetArray" needs to be exported by the package (e.g. added to index.ts)
  readonly ruleSets: RuleSetArray;
  visitClass(ecClass: AnyClass): Promise<void>;
  visitConstant(constant: Constant): Promise<void>;
  visitCustomAttributeClass(customAttribute: CustomAttributeClass): Promise<void>;
  // WARNING: The type "CustomAttributeContainerProps" needs to be exported by the package (e.g. added to index.ts)
  visitCustomAttributeContainer(container: CustomAttributeContainerProps): Promise<void>;
  visitEntityClass(entity: EntityClass): Promise<void>;
  visitEnumeration(enumeration: Enumeration): Promise<void>;
  visitFormat(format: Format): Promise<void>;
  visitFullSchema(schema: Schema): Promise<void>;
  visitInvertedUnit(invertedUnit: InvertedUnit): Promise<void>;
  visitKindOfQuantity(koq: KindOfQuantity): Promise<void>;
  visitMixin(mixin: Mixin): Promise<void>;
  visitPhenomenon(phenomenon: Phenomenon): Promise<void>;
  visitProperty(property: AnyProperty): Promise<void>;
  visitPropertyCategory(category: PropertyCategory): Promise<void>;
  visitRelationshipClass(relationship: RelationshipClass): Promise<void>;
  visitRelationshipConstraint(constraint: RelationshipConstraint): Promise<void>;
  visitSchemaItem(schemaItem: SchemaItem): Promise<void>;
  visitStructClass(struct: StructClass): Promise<void>;
  visitUnit(unit: Unit): Promise<void>;
  visitUnitSystem(unitSystem: UnitSystem): Promise<void>;
}

// @public
class SchemaWalker {
  constructor(visitor: ISchemaPartVisitor);
  traverseSchema<T extends Schema>(schema: T): Promise<T>;
}

// @public
class SchemaXmlFileLocater extends SchemaFileLocater, implements ISchemaLocater {
  addSchemaReferences(schema: Schema, context?: SchemaContext): Promise<void>;
  addSchemaReferencesSync(schema: Schema, context?: SchemaContext): void;
  getSchema<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<T | undefined>;
  getSchemaKey(data: string): SchemaKey;
  getSchemaReferenceKeys(schemaKey: FileSchemaKey): SchemaKey[];
  getSchemaSync<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): T | undefined;
  loadSchema<T extends Schema>(schemaPath: string, context: SchemaContext): Promise<T | undefined>;
}

// @public (undocumented)
enum ScientificType {
  // (undocumented)
  Normalized = 0,
  // (undocumented)
  ZeroNormalized = 1
}

// @public (undocumented)
export function scientificTypeToString(scientificType: ScientificType): string;

// @public (undocumented)
enum ShowSignOption {
  // (undocumented)
  NegativeParentheses = 3,
  // (undocumented)
  NoSign = 0,
  // (undocumented)
  OnlyNegative = 1,
  // (undocumented)
  SignAlways = 2
}

// @public (undocumented)
export function showSignOptionToString(showSign: ShowSignOption): string;

// @public (undocumented)
enum StrengthDirection {
  // (undocumented)
  Backward = 2,
  // (undocumented)
  Forward = 1
}

// @public (undocumented)
export function strengthDirectionToString(direction: StrengthDirection): string;

// @public (undocumented)
export function strengthToString(strength: StrengthType): string;

// @public (undocumented)
enum StrengthType {
  // (undocumented)
  Embedding = 2,
  // (undocumented)
  Holding = 1,
  // (undocumented)
  Referencing = 0
}

// @public (undocumented)
class StructArrayProperty extends StructArrayProperty_base {
  constructor(ecClass: ECClass, name: string, type: StructClass);
}

// @public
class StructClass extends ECClass {
  constructor(schema: Schema, name: string, modifier?: ECClassModifier);
  // WARNING: The type "SchemaItemType.StructClass" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.StructClass;
}

// @public (undocumented)
class StructProperty extends Property {
  constructor(ecClass: ECClass, name: string, type: StructClass);
  // (undocumented)
  protected _structClass: StructClass;
  // WARNING: The type "StructPropertyProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(structPropertyProps: StructPropertyProps): Promise<void>;
  // WARNING: The type "StructPropertyProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(structPropertyProps: StructPropertyProps): void;
  // (undocumented)
  readonly structClass: StructClass;
  // (undocumented)
  toJson(): any;
}

// @public
class Unit extends SchemaItem {
  constructor(schema: Schema, name: string);
  // (undocumented)
  protected _definition: string;
  // (undocumented)
  protected _denominator: number;
  // (undocumented)
  protected _numerator: number;
  // (undocumented)
  protected _offset: number;
  // (undocumented)
  protected _phenomenon?: LazyLoadedPhenomenon;
  // (undocumented)
  protected _unitSystem?: LazyLoadedUnitSystem;
  // (undocumented)
  readonly definition: string;
  // (undocumented)
  readonly denominator: number;
  // WARNING: The type "UnitProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserialize(unitProps: UnitProps): Promise<void>;
  // WARNING: The type "UnitProps" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  deserializeSync(unitProps: UnitProps): void;
  // (undocumented)
  readonly numerator: number;
  // (undocumented)
  readonly offset: number;
  // (undocumented)
  readonly phenomenon: LazyLoadedPhenomenon | undefined;
  // WARNING: The type "SchemaItemType.Unit" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.Unit;
  // (undocumented)
  toJson: {
    [value: string]: any;
  }
  // (undocumented)
  readonly unitSystem: LazyLoadedUnitSystem | undefined;
}

// @public (undocumented)
class UnitSystem extends SchemaItem {
  constructor(schema: Schema, name: string);
  // WARNING: The type "SchemaItemType.UnitSystem" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly schemaItemType: SchemaItemType.UnitSystem;
}

// WARNING: Unsupported export: AnyEnumerator
// WARNING: Unsupported export: AnyArrayProperty
// WARNING: Unsupported export: AnyEnumerationProperty
// WARNING: Unsupported export: AnyPrimitiveProperty
// WARNING: Unsupported export: AnyProperty
// WARNING: Unsupported export: AnyStructProperty
// WARNING: Unsupported export: DiagnosticCodes
// WARNING: Unsupported export: Diagnostics
// WARNING: Unsupported export: ECRuleSet
// WARNING: Unsupported export: DelayedPromiseWithProps
// WARNING: Unsupported export: DelayedPromiseWithProps
// WARNING: Unsupported export: LazyLoadedSchema
// WARNING: Unsupported export: LazyLoadedSchemaItem
// WARNING: Unsupported export: LazyLoadedECClass
// WARNING: Unsupported export: LazyLoadedEntityClass
// WARNING: Unsupported export: LazyLoadedMixin
// WARNING: Unsupported export: LazyLoadedStructClass
// WARNING: Unsupported export: LazyLoadedCustomAttributeClass
// WARNING: Unsupported export: LazyLoadedRelationshipClass
// WARNING: Unsupported export: LazyLoadedEnumeration
// WARNING: Unsupported export: LazyLoadedKindOfQuantity
// WARNING: Unsupported export: LazyLoadedPropertyCategory
// WARNING: Unsupported export: LazyLoadedRelationshipConstraintClass
// WARNING: Unsupported export: LazyLoadedUnit
// WARNING: Unsupported export: LazyLoadedInvertedUnit
// WARNING: Unsupported export: LazyLoadedConstant
// WARNING: Unsupported export: LazyLoadedPhenomenon
// WARNING: Unsupported export: LazyLoadedUnitSystem
// WARNING: Unsupported export: LazyLoadedFormat
// WARNING: Unsupported export: AnyClass
// WARNING: Unsupported export: AnySchemaItem
// WARNING: Unsupported export: AnyECType
// WARNING: Unsupported export: formatStringRgx
// WARNING: Unsupported export: AnyDiagnostic
// WARNING: Unsupported export: IRule
// WARNING: Unsupported export: BaseRule
// (No @packagedocumentation comment for this package)
