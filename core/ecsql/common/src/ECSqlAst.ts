import { asInstanceOf, Constructor, isInstanceOf } from "@itwin/core-bentley";

/**
 * Id returned by native code
 * @internal
 */
enum NativeExpIds {
  AllOrAny = "AllOrAnyExp", /** Not supported or working */
  Assignment = "AssignmentExp",
  BetweenRangeValue = "BetweenRangeValueExp",
  BinaryBoolean = "BinaryBooleanExp",
  BinaryValue = "BinaryValueExp",
  BooleanFactor = "BooleanFactorExp",
  Cast = "CastExp",
  ClassName = "ClassNameExp",
  CommonTable = "CommonTableExp",
  CommonTableBlock = "CommonTableBlockExp",
  CommonTableBlockName = "CommonTableBlockNameExp",
  CrossJoin = "CrossJoinExp",
  DeleteStatement = "DeleteStatementExp",
  DerivedProperty = "DerivedPropertyExp",
  FunctionCall = "FunctionCallExp",
  IIF = "IIFExp",
  InsertStatement = "InsertStatementExp",
  LikeRhsValue = "LikeRhsValueExp",
  LimitOffset = "LimitOffsetExp",
  LiteralValue = "LiteralValueExp",
  MemberFunctionCall = "MemberFunctionCallExp",
  NaturalJoin = "NaturalJoinExp",
  Options = "OptionsExp",
  OrderBySpec = "OrderBySpecExp",
  Parameter = "ParameterExp",
  PropertyName = "PropertyNameExp",
  QualifiedJoin = "QualifiedJoinExp",
  RowConstructor = "RowConstructor",
  SearchCaseValue = "SearchCaseValueExp",
  SelectStatement = "SelectStatementExp",
  SingleSelectStatement = "SingleSelectStatementExp",
  Subquery = "SubqueryExp",
  SubqueryRef = "SubqueryRefExp",
  SubqueryTest = "SubqueryTestExp",
  TableValuedFunction = "TableValuedFunctionExp",
  UnaryValue = "UnaryValueExp",
  UpdateStatement = "UpdateStatementExp",
  UsingRelationshipJoinExp = "UsingRelationshipJoinExp",
  NavValueCreationFunc = "NavValueCreationFuncExp",
}
/**
 * Type of literal value.
 * @alpha
 */
export enum LiteralValueType {
  Null = "NULL",
  String = "STRING",
  Date = "DATE",
  Time = "TIME",
  Timestamp = "TIMESTAMP",
  Raw = "RAW"
}
/**
 * Sort direction specified by ORDER BY spec  @see [[OrderBySpecExpr]]
 * @alpha
 */
export type FirstOrLast = "FIRST" | "LAST";

/**
 * Sort direction specified by ORDER BY spec  @see [[OrderBySpecExpr]]
 * @alpha
 */
export type SortDirection = "ASC" | "DESC";

/**
 * Describe how SELECT result is combined with another SELECT in compound select statement @see [[NextSelect]] @see [[SelectStatementExp]]
 * @alpha
 */
export type CompoundSelectOp = "UNION" | "UNION ALL" | "INTERSECT" | "EXCEPT";

/**
 * Test subquery result. @see [[SubqueryTest]]
 * @alpha
 */
export type SubqueryTestOp = "EXISTS";

/**
 * Describe JOIN/USING relationship direction when relationship is of time 1:1. @see [[UsingRelationshipJoin]]
 * @alpha
 */
export type JoinDirection = "FORWARD" | "BACKWARD";

/**
 * Join specification of a Qualified join. @see [[QualifiedJoinExpr]]
 * @alpha
 */
export type JoinSpec = BooleanExpr | string[] | undefined;

/**
 * Qualified JOIN type @see [[QualifiedJoinExpr]]
 * @alpha
 */
export enum JoinType {
  LeftOuter = "LEFT OUTER JOIN",
  RightOuter = "RIGHT OUTER JOIN",
  FullOuter = "FULL OUTER JOIN",
  Inner = "INNER JOIN",
}

/**
 * Unary operator for @see [[ValueExpr]].
 * @alpha
 */
export type UnaryValueOp = "-" | "+" | "~";

/**
 * Unary operator for @see [[BooleanExpr]]
 *  @alpha
 */
export type UnaryBooleanOp = "NOT";

/**
 * Binary boolean operators used by @see [[BinaryBooleanExpr]]
 *  @alpha
 */
export type BinaryBooleanOp = "AND" | "OR" | "=" | ">=" | ">" | "<=" | "<" | "<>" | "!=";

/**
 * Binary value operators used by  @see [[BinaryValueExpr]]
 *  @alpha
 */
export type BinaryValueOp = "&" | "|" | "<<" | "||" | "/" | "-" | "*" | "+" | "%";

/**
 * Disqualify term in ECSQL so query planner does not try to find index for it.  @see [[ClassNameExpr]]
 *  @alpha
 */
export type DisqualifyOp = "+";

/**
 * Optional recursive keyword for common table expressions @see [[CteExpr]]
 * @alpha
 */
export type RecursiveCte = "RECURSIVE";

/**
 * Polymorphic constraint for @see [[ClassNameExpr]]
 *  @alpha
 */
export type AllOrAnyOp = "ONLY" | "ALL";

/**
 * Filter rows in select clause or aggregate functions @see [[FuncCallExpr]] and @see [[SelectExpr]]
 *  @alpha
 */
export type AllOrDistinctOp = "DISTINCT" | "ALL";

/**
 * Return by native code
 * @alpha
 */
export interface NativeECSqlParseNode {
  [key: string]: any;
}

/**
 * Return by native code
 * @alpha
 */
export interface NativeECSqlParseNodeProvider {
  parseECSql: (ecsql: string) => Promise<NativeECSqlParseNode>;
}

/**
 * ECSql expr type supported @see [[Expr]]
 * @alpha
 */
export enum ExprType {
  Literal = "Literal",
  Unary = "Unary",
  Parameter = "Parameter",
  Cast = "Cast",
  BinaryValue = "BinaryValue",
  SearchCase = "SearchCase",
  IIF = "IIF",
  FuncCall = "FuncCall",
  PropertyName = "PropertyName",
  Subquery = "Subquery",

  Between = "Between",
  // Match = "Match",
  Like = "Like",
  In = "In",
  Not = "Not",
  IsOfType = "IsOfType",
  IsNull = "IsNull",
  BinaryBoolean = "BinaryBoolean",
  SubqueryTest = "SubqueryTest",

  UsingRelationshipJoin = "UsingRelationshipJoin",
  QualifiedJoin = "QualifiedJoin",
  SubqueryRef = "SubqueryRef",
  CteBlockRef = "CteBlockRef",
  ClassName = "ClassName",
  TableValuedFunc = "TableValuedFunc",

  DerivedProperty = "DerivedProperty",
  SetClause = "SetClause",
  Select = "Select",
  ECSqlOptionsClause = "ECSqlOptions",
  CteBlock = "CteBlock",
  MemberFuncCall = "MemberFuncCall",

  Cte = "Cte",
  UpdateStatement = "UpdateStatement",
  InsertStatement = "InsertStatement",
  DeleteStatement = "DeleteStatement",
  SelectStatement = "SelectStatement",
  SelectionClause = "SelectionClause",

  WhereClause = "WhereClause",
  GroupByClause = "GroupByClause",
  HavingClause = "HavingCluase",
  FromClause = "FromClause",
  OrderByClause = "OrderByClause",
  OrderBySpec = "OrderBySpec",
  LimitClause = "LimitClause",
  Assignment = "Assignment",

  NavValueCreationFunc = "NavValueCreationFunc"
}

/**
 * Allow to create statement expression tree from a ecsql
 *  @alpha
 */
export class ExprFactory {
  public constructor(public readonly provider: NativeECSqlParseNodeProvider) { }
  public async parseStatement(ecsql: string): Promise<StatementExpr> {
    return StatementExpr.deserialize(this.provider.parseECSql(ecsql));
  }
}

/**
 * Base class for all ECSql expressions.
 *  @alpha
 */
export abstract class Expr {
  public constructor(public readonly expType: ExprType) { }
  /**
   * Write expression tree to a ECSQL string
   * @param writer A instance of writer to which expression tree will output tokens.
   */
  public abstract writeTo(writer: ECSqlWriter): void;
  public abstract get children(): Expr[];
  /**
   * Find instances of expressions matching the type in sub tree.
   * @param type a subclass of Expr
   * @returns
   */
  public findInstancesOf<T extends Expr>(type: Constructor<T>): T[] {
    const listOfT: T[] = [];
    this.traverse((expr) => {
      const inst = expr.asInstanceOf<T>(type);
      if (inst)
        listOfT.push(inst);
    });
    return listOfT;
  }
  /**
   * Allow to traverse the expression tree depth first
   * @param callback this will be called for each expression traverse from first to last.
   */
  public traverse(callback: (expr: Expr, parent?: Expr) => void | boolean) {
    const list: Expr[] = [this];
    let parent: Expr | undefined;
    while (list.length > 0) {
      const current = list.pop();
      if (current) {
        const rc = callback(current, parent);
        if (typeof rc === "boolean") {
          if (!rc)
            return;
        }
        parent = current;
        list.push(...current.children.reverse());
      }
    }
  }
  /**
   * Test if class instance is of certain type
   * @param type A class that extends from Expr
   * @returns true if instances matches the type else return false.
   */
  public isInstanceOf<T extends Expr>(type: Constructor<T>) { return isInstanceOf<T>(this, type); }
  public asInstanceOf<T extends Expr>(type: Constructor<T>) { return asInstanceOf<T>(this, type); }
  /**
   * Convert expression tree to ECSQL.
   * @param args args to ecsql writer.
   * @returns ECSQL string
   */
  public toECSql(args?: ECSqlWriterArgs): string {
    if (args) {
      const customWriter = new ECSqlWriter(args);
      this.writeTo(customWriter);
      return customWriter.toString();
    }
    const defaultWriter = new ECSqlWriter();
    this.writeTo(defaultWriter);
    return defaultWriter.toString();
  }
}

/**
 * Base class for all ECSQL Statements. Here are list of subclasses @see [[CteExpr]], @see [[SelectStatement]], @see [[InsertStatement]], @see [UpdateStatement]] and @see [[DeleteStatement]]
 *  @alpha
 */
export abstract class StatementExpr extends Expr {
  public static deserialize(node: NativeECSqlParseNode): StatementExpr | InsertStatementExpr | UpdateStatementExpr | DeleteStatementExpr | CteExpr {
    if (node.id === NativeExpIds.CommonTable)
      return CteExpr.deserialize(node);
    if (node.id === NativeExpIds.InsertStatement)
      return InsertStatementExpr.deserialize(node);
    if (node.id === NativeExpIds.UpdateStatement)
      return UpdateStatementExpr.deserialize(node);
    if (node.id === NativeExpIds.DeleteStatement)
      return DeleteStatementExpr.deserialize(node);
    if (node.id === NativeExpIds.SelectStatement)
      return SelectStatementExpr.deserialize(node);
    throw new Error(`unknow node.id = ${node.id}`);
  }
}

/**
 * Base class for all computed expression like Value and Boolean.
 * @alpha
 */
export abstract class ComputedExpr extends Expr {
  public static deserialize(node: NativeECSqlParseNode) {
    if (BooleanExpr.deserializableIds.includes(node.id)) {
      return BooleanExpr.deserialize(node);
    }
    if (ValueExpr.deserializableIds.includes(node.id)) {
      return ValueExpr.deserialize(node);
    }
    throw new Error(`unknow node.id = ${node.id}`);
  }
}

/**
 * Base class for a boolean expressions. It has following subclasses
 * @see [[BooleanExpr]]
 * @see [[ubqueryTestExpr]]
 * @see [[BetweenExpr]]
 * @see [[LikeExpr]]
 * @see [[InExpr]]
 * @see [[IsNullExpr]]
 * @see [[IsOfTypeExpr]]
 * @see [[NotExpr]]
 * @see [[BinaryBooleanExpr]]
 * @alpha
 */
export abstract class BooleanExpr extends ComputedExpr {
  public static readonly deserializableIds = [NativeExpIds.BinaryBoolean, NativeExpIds.BooleanFactor, NativeExpIds.SubqueryTest, NativeExpIds.AllOrAny, NativeExpIds.BooleanFactor];
  public static override deserialize(node: NativeECSqlParseNode): BooleanExpr | SubqueryTestExpr | BetweenExpr | LikeExpr | InExpr | IsNullExpr | IsOfTypeExpr | NotExpr | BinaryBooleanExpr {
    if (node.id === NativeExpIds.BinaryBoolean) {
      const op = (node.op as string);
      // if (MatchExpr.parseOp(op)[0]) {
      //   return MatchExpr.deserialize(node);
      // }
      if (BetweenExpr.parseOp(op)[0]) {
        return BetweenExpr.deserialize(node);
      }
      if (LikeExpr.parseOp(op)[0]) {
        return LikeExpr.deserialize(node);
      }
      if (InExpr.parseOp(op)[0]) {
        return InExpr.deserialize(node);
      }
      if (IsNullExpr.parseOp(node)[0]) {
        return IsNullExpr.deserialize(node);
      }
      if (IsOfTypeExpr.parseOp(node)[0]) {
        return IsOfTypeExpr.deserialize(node);
      }
      return BinaryBooleanExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.BooleanFactor) {
      return NotExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.SubqueryTest) {
      return SubqueryTestExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.BooleanFactor) {
      return NotExpr.deserialize(node);
    }
    throw new Error(`Unknown type of native value exp ${node.id}`);
  }
}

/**
 * Base class for all value expressions. Following is list of subclasses.
 * @see [[SubqueryExpr]]
 * @see [[ValueExpr]]
 * @see [[UnaryValueExpr]]
 * @see [[FuncCallExpr]]
 * @see [[CastExpr]]
 * @see [[BinaryValueExpr]]
 * @see [[SearchCaseExpr]]
 * @see [[IIFExpr]]
 * @see [[LiteralExpr]]
 * @see [[PropertyNameExpr]]
 * @see [[NavValueCreationFunc]]
 * @alpha
 */
export abstract class ValueExpr extends ComputedExpr {
  public static readonly deserializableIds = [
    NativeExpIds.LiteralValue,
    NativeExpIds.Parameter,
    NativeExpIds.FunctionCall,
    NativeExpIds.Cast,
    NativeExpIds.BinaryValue,
    NativeExpIds.SearchCaseValue,
    NativeExpIds.IIF,
    NativeExpIds.UnaryValue,
    NativeExpIds.PropertyName,
    NativeExpIds.Subquery,
    NativeExpIds.NavValueCreationFunc,
  ];

  public static override deserialize(node: NativeECSqlParseNode): SubqueryExpr | ValueExpr | UnaryValueExpr | FuncCallExpr | CastExpr | BinaryValueExpr | SearchCaseExpr | IIFExpr | LiteralExpr | PropertyNameExpr | NavValueCreationFuncExpr {
    if (node.id === NativeExpIds.UnaryValue) {
      return UnaryValueExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.PropertyName) {
      return PropertyNameExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.Parameter) {
      return ParameterExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.FunctionCall) {
      return FuncCallExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.Cast) {
      return CastExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.Subquery) {
      return SubqueryExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.BinaryValue) {
      return BinaryValueExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.SearchCaseValue) {
      return SearchCaseExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.IIF) {
      return IIFExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.LiteralValue) {
      return LiteralExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.NavValueCreationFunc)
      return NavValueCreationFuncExpr.deserialize(node);
    throw new Error(`Unknown type of native value exp ${node.id}`);
  }
}

/**
 * Hold polymorphic information about @see [[ClassNameExp]]
 * @alpha
 */
export interface PolymorphicInfo {
  allOrAny: AllOrAnyOp;
  disqualify?: DisqualifyOp;
}

/**
 * Base class for expressions that can be used in FROM clause of a SELECT. Following list of this subclasses.
 * @see [[ClassRefExpr]]
 * @see [[ClassNameExpr]]
 * @see [[SubqueryRefExpr]]
 * @see [[UsingRelationshipJoinExpr]]
 * @see [[QualifiedJoinExpr]]
 * @see [[CteBlockRefExpr]]
 * @see [[TableValuedFuncExpr]]
 * @alpha
 */
export abstract class ClassRefExpr extends Expr {
  public static readonly deserializableIds = [
    NativeExpIds.ClassName,
    NativeExpIds.SubqueryRef,
    NativeExpIds.UsingRelationshipJoinExp,
    NativeExpIds.QualifiedJoin,
    NativeExpIds.CommonTableBlockName,
  ];

  public static deserialize(node: NativeECSqlParseNode): ClassNameExpr | SubqueryRefExpr | UsingRelationshipJoinExpr | QualifiedJoinExpr | CteBlockRefExpr | TableValuedFuncExpr {
    if (node.id === NativeExpIds.ClassName) {
      return ClassNameExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.SubqueryRef) {
      return SubqueryRefExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.UsingRelationshipJoinExp) {
      return UsingRelationshipJoinExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.QualifiedJoin) {
      return QualifiedJoinExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.CommonTableBlockName) {
      return CteBlockRefExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.TableValuedFunction) {
      return TableValuedFuncExpr.deserialize(node);
    }

    throw new Error(`Unknown type of native value exp ${node.id}`);
  }
}

/**
 * Options for @see [[ECSqlWriter]]
 * @alpha
 */
export interface ECSqlWriterArgs {
  readonly multiline: boolean;
  readonly eol: "\r\n" | "\n";
  readonly spaceAfterComma: boolean;
  readonly spaceAroundBinOp: boolean;
  readonly keywordCasing: "lower" | "UPPER";
  readonly indent: {
    readonly size: number;
    readonly char: string;
  };
}

/**
 * Keywords output by @see [[ECSqlWriter.appendKeyword]]
 * @alpha
 */
export type Keywords = "ALL" | "AND" | "AS" | "ASC" | "BACKWARD" | "BETWEEN" | "BY" | "CASE" | "CAST" | "CROSS" | "DATE" | "DELETE" | "DESC" | "DISTINCT" | "ECSQLOPTIONS" | "ELSE" | "END" | "ESCAPE" | "EXCEPT" | "EXISTS" | "FIRST" | "FORWARD" | "FROM" | "FULL" | "GROUP" | "HAVING" | "IIF" | "IN" | "INNER" | "INSERT" | "INTERSECT" | "INTO" | "IS" | "JOIN" | "LAST" | "LEFT" | "LIKE" | "LIMIT" | "NATURAL" | "NOT" | "NULL" | "NULLS" | "OFFSET" | "ON" | "ONLY" | "OR" | "ORDER" | "OUTER" | "RECURSIVE" | "RIGHT" | "SELECT" | "SET" | "THEN" | "TIME" | "TIMESTAMP" | "UNION" | "UPDATE" | "USING" | "VALUES" | "WHEN" | "WHERE" | "WITH";

/**
 * Write expression tree to string
 * @alpha
 */
export class ECSqlWriter {
  private _tokens: string[] = [];
  private _currentIndent = 0;
  private _isNewLine = false;
  public constructor(public readonly options: ECSqlWriterArgs = {
    multiline: false,
    spaceAfterComma: true,
    spaceAroundBinOp: true,
    eol: "\r\n",
    keywordCasing: "UPPER",
    indent: { size: 3, char: " " },
  }) { }
  public indent() {
    this._currentIndent++;
  }
  public unindent() {
    if (this._currentIndent > 0)
      this._currentIndent--;
  }
  public appendBinaryOp(val: string) {
    if (this.options.spaceAroundBinOp)
      return this.append(` ${val} `);
    return this.append(val);
  }
  public appendKeyword(val: Keywords) {
    if (this.options.keywordCasing === "UPPER")
      return this.append(val);
    return this.append(val.toLowerCase());
  }
  public appendComma() {
    this.append(",");
    if (this.options.spaceAfterComma)
      this.appendSpace();
  }
  public appendQuoted(val: string) {
    return this.append(`[${val}]`);
  }
  public append(val: string) {
    if (this._isNewLine) {
      if (this._currentIndent > 0 && this.options.indent.size > 0 && this.options.indent.char.length === 1) {
        this._tokens.push("".padEnd(this._currentIndent * this.options.indent.size, this.options.indent.char));
      }
      this._isNewLine = false;
    }
    this._tokens.push(val);
    return this;
  }
  public appendStringLiteral(val: string) {
    return this.append(`'${val}'`);
  }
  public appendLineOrSpace() {
    if (this.options.multiline)
      return this.appendLine();
    return this.appendSpace();
  }
  public appendSpace() {
    return this.append(" ");
  }
  public appendLine() {
    if (this.options.multiline) {
      this._isNewLine = true;
      if (this._tokens.length > 0) {
        this._tokens[this._tokens.length - 1] = this._tokens[this._tokens.length - 1].trimEnd();
      }
      this._tokens.push(this.options.eol);
    }
    return this;
  }
  public clear() {
    this._tokens = [];
    return this;
  }
  public squash() {
    if (this._tokens.length > 1) {
      this._tokens = [this.toString()];
    }
    return this;
  }
  public toString() {
    return this._tokens.join("");
  }
  public appendExp(exp: Expr) {
    exp.writeTo(this);
    return this;
  }
  public appendParenLeft(){
    return this.append("(");
  }
  public appendParenRight(){
    return this.append(")");
  }
}

/**
 * Use to describe selection clause terms in a SELECT statements @see [[SelectionClauseExpr]] @see [[SelectExpr]]
 * @alpha
 */
export class DerivedPropertyExpr extends Expr {
  public static readonly type = ExprType.DerivedProperty;
  public constructor(public readonly computedExpr: ComputedExpr, public readonly alias?: string) {
    super(DerivedPropertyExpr.type);
  }
  public override get children(): Expr[] {
    return [this.computedExpr];
  }
  public static deserialize(node: NativeECSqlParseNode): DerivedPropertyExpr {
    if (node.id !== NativeExpIds.DerivedProperty) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.DerivedProperty'. ${JSON.stringify(node)}`);
    }
    return new DerivedPropertyExpr(ComputedExpr.deserialize(node.exp as NativeECSqlParseNode), node.alias ? node.alias as string : undefined);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.computedExpr);
    if (this.alias) {
      writer.appendSpace();
      writer.appendQuoted(this.alias);
    }
  }
}

/**
 * Describes a ECSQL delete statement.
 * @alpha
 */
export class DeleteStatementExpr extends StatementExpr {
  public static readonly type = ExprType.DeleteStatement;
  public constructor(
    public readonly className: ClassNameExpr,
    public readonly where?: WhereClauseExp,
    public readonly options?: ECSqlOptionsClauseExpr) {
    super(DeleteStatementExpr.type);
  }
  public override get children(): Expr[] {
    const exprs: Expr[] = [this.className];
    if (this.where)
      exprs.push(this.where);
    if (this.options)
      exprs.push(this.options);
    return exprs;
  }
  public static override deserialize(node: NativeECSqlParseNode): DeleteStatementExpr {
    if (node.id !== NativeExpIds.DeleteStatement) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.DeleteStatement'. ${JSON.stringify(node)}`);
    }

    const className = ClassNameExpr.deserialize(node.class as NativeECSqlParseNode);
    const where = node.where ? WhereClauseExp.deserialize(node.where as NativeECSqlParseNode) : undefined;
    const options = node.options ? ECSqlOptionsClauseExpr.deserialize(node.options as NativeECSqlParseNode) : undefined;
    return new DeleteStatementExpr(className, where, options);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("DELETE");
    writer.appendSpace();
    writer.appendKeyword("FROM");
    writer.appendSpace();
    writer.appendExp(this.className);
    if (this.where) {
      writer.appendSpace();
      writer.appendExp(this.where);
    }
    if (this.options) {
      writer.appendSpace();
      writer.appendExp(this.options);
    }
  }
}

/**
 * Describe a ECSQL Insert statement.
 * @alpha
 */
export class InsertStatementExpr extends StatementExpr {
  public static readonly type = ExprType.InsertStatement;
  public constructor(
    public readonly className: ClassNameExpr,
    public readonly values: ValueExpr[],
    public readonly propertyNames?: PropertyNameExpr[]) {
    super(InsertStatementExpr.type);
  }
  public override get children(): Expr[] {
    const exprs: Expr[] = [this.className];
    exprs.push(...this.values);
    if (this.propertyNames)
      exprs.push(...this.propertyNames);
    return exprs;
  }
  public static override deserialize(node: NativeECSqlParseNode): InsertStatementExpr {
    if (node.id !== NativeExpIds.InsertStatement) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.InsertStatement'. ${JSON.stringify(node)}`);
    }

    const className = ClassNameExpr.deserialize(node.class as NativeECSqlParseNode);
    if (className.polymorphicInfo) {
      // Patch as INSERT are always ONLY but parser have issue accepting ONLY.
      if (className.polymorphicInfo.allOrAny === "ONLY") {
        className.polymorphicInfo = undefined;
      }
    }
    const values = Array.from((node.values as NativeECSqlParseNode[]).map((v) => ValueExpr.deserialize(v)));
    const properties = node.properties ? Array.from((node.properties as NativeECSqlParseNode[]).map((v) => PropertyNameExpr.deserialize(v))) : undefined;
    return new InsertStatementExpr(className, values, properties);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("INSERT");
    writer.appendSpace();
    writer.appendKeyword("INTO");
    writer.appendSpace();
    writer.appendExp(this.className);
    writer.appendSpace();
    if (this.propertyNames) {
      writer.append("(");
      this.propertyNames.forEach((v, i) => {
        if (i > 0) {
          writer.appendComma();
        }
        writer.appendExp(v);
      });
      writer.append(")");
    }
    writer.appendSpace();
    writer.appendKeyword("VALUES");
    writer.append("(");
    this.values.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
    writer.append(")");
  }
}

/**
 * Describes a JOIN clause e.g. <classNameExpr> JOIN <classNameExpr> ON <joinspec>
 * @alpha
 */
export class QualifiedJoinExpr extends ClassRefExpr {
  public static readonly type = ExprType.QualifiedJoin;
  public constructor(
    public readonly joinType: JoinType,
    public readonly from: ClassRefExpr,
    public readonly to: ClassRefExpr,
    public readonly spec: JoinSpec) {
    super(QualifiedJoinExpr.type);
  }
  public override get children(): Expr[] {
    const exprs: Expr[] = [this.from, this.to];
    if (this.spec instanceof BooleanExpr)
      exprs.push(this.spec);
    return exprs;
  }
  public static override deserialize(node: NativeECSqlParseNode): QualifiedJoinExpr {
    if (node.id !== NativeExpIds.QualifiedJoin) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.QualifiedJoin'. ${JSON.stringify(node)}`);
    }
    const type = node.type as JoinType;
    const from = ClassRefExpr.deserialize(node.from as NativeECSqlParseNode);
    const to = ClassRefExpr.deserialize(node.to as NativeECSqlParseNode);
    let spec: JoinSpec | undefined;
    if (Array.isArray(node.spec))
      spec = node.spec as string[];
    else
      spec = BooleanExpr.deserialize(node.spec as NativeECSqlParseNode);
    return new QualifiedJoinExpr(type, from, to, spec);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.from);
    writer.appendSpace();
    if (this.joinType === JoinType.LeftOuter) {
      writer.appendKeyword("LEFT").appendSpace();
      writer.appendKeyword("OUTER").appendSpace();
      writer.appendKeyword("JOIN").appendSpace();
    } else if (this.joinType === JoinType.RightOuter) {
      writer.appendKeyword("RIGHT").appendSpace();
      writer.appendKeyword("OUTER").appendSpace();
      writer.appendKeyword("JOIN").appendSpace();
    } else if (this.joinType === JoinType.FullOuter) {
      writer.appendKeyword("FULL").appendSpace();
      writer.appendKeyword("OUTER").appendSpace();
      writer.appendKeyword("JOIN").appendSpace();
    } else if (this.joinType === JoinType.Inner) {
      writer.appendKeyword("INNER").appendSpace();
      writer.appendKeyword("JOIN").appendSpace();
    } else {
      throw new Error(`not supported join type ${this.joinType}`);
    }
    writer.appendExp(this.to);
    if (this.spec) {
      writer.appendSpace();
      if (this.spec instanceof BooleanExpr) {
        writer.appendKeyword("ON");
        writer.appendSpace();
        writer.appendExp(this.spec);
      } else if (this.spec instanceof Array) {
        writer.appendKeyword("USING");
        this.spec.forEach((v, i) => {
          if (i > 0) {
            writer.appendComma();
            writer.append(v);
          }
        });
      } else {
        throw new Error("unknow join spec");
      }
    }
  }
}

/**
 * Describe a JOIN USING clause.
 * @alpha
 */
export class UsingRelationshipJoinExpr extends ClassRefExpr {
  public static readonly type = ExprType.UsingRelationshipJoin;
  public constructor(
    public readonly fromClassName: ClassRefExpr,
    public readonly toClassName: ClassNameExpr,
    public readonly toRelClassName: ClassNameExpr,
    public readonly direction?: JoinDirection) {
    super(UsingRelationshipJoinExpr.type);
  }
  public override get children(): Expr[] {
    return [this.fromClassName, this.toClassName, this.toRelClassName];
  }
  public static override deserialize(node: NativeECSqlParseNode): UsingRelationshipJoinExpr {
    if (node.id !== NativeExpIds.UsingRelationshipJoinExp) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.UsingRelationshipJoinExp'. ${JSON.stringify(node)}`);
    }
    const from = ClassRefExpr.deserialize(node.from as NativeECSqlParseNode);
    const to = ClassNameExpr.deserialize(node.to as NativeECSqlParseNode);
    const usingRel = ClassNameExpr.deserialize(node.using as NativeECSqlParseNode);
    const direction = node.direction ? node.direction as JoinDirection : undefined;
    return new UsingRelationshipJoinExpr(from, to, usingRel, direction);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.fromClassName);
    writer.appendSpace();
    writer.appendKeyword("JOIN");
    writer.appendSpace();
    writer.appendExp(this.toClassName);
    writer.appendSpace();
    writer.appendKeyword("USING");
    writer.appendSpace();
    writer.appendExp(this.toRelClassName);
    if (this.direction) {
      writer.appendSpace();
      writer.appendKeyword(this.direction);
    }
  }
}

/**
 * Describe subquery result test e.g. EXISTS(<subquery>)
 * @alpha
 */
export class SubqueryTestExpr extends BooleanExpr {
  public static readonly type = ExprType.SubqueryTest;
  public constructor(public readonly op: SubqueryTestOp, public readonly query: SubqueryExpr) {
    super(SubqueryTestExpr.type);
  }
  public override get children(): Expr[] {
    return [this.query];
  }
  public static override deserialize(node: NativeECSqlParseNode): SubqueryTestExpr {
    if (node.id !== NativeExpIds.SubqueryTest) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SubqueryTest'. ${JSON.stringify(node)}`);
    }
    const query = SubqueryExpr.deserialize(node.query as NativeECSqlParseNode);
    const op = node.op as SubqueryTestOp;
    return new SubqueryTestExpr(op, query);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword(this.op);
    writer.appendExp(this.query);
  }
}

/**
 * Describe a subquery when used in FROM clause.
 * @alpha
 */
export class SubqueryRefExpr extends ClassRefExpr {
  public static readonly type = ExprType.SubqueryRef;
  public constructor(public readonly query: SubqueryExpr, public readonly polymorphicInfo?: PolymorphicInfo, public readonly alias?: string) {
    super(SubqueryRefExpr.type);
  }
  public override get children(): Expr[] {
    return [this.query];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.SubqueryRef) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SubqueryRef'. ${JSON.stringify(node)}`);
    }
    const query = SubqueryExpr.deserialize(node.query as NativeECSqlParseNode);
    const polymorphicInfo = node.polymorphicInfo ? node.polymorphicInfo as PolymorphicInfo : undefined;
    const alias = node.alias ? node.alias as string : undefined;
    return new SubqueryRefExpr(query, polymorphicInfo, alias);
  }
  public override writeTo(writer: ECSqlWriter): void {
    if (this.polymorphicInfo) {
      if (this.polymorphicInfo.disqualify) {
        writer.append(this.polymorphicInfo.disqualify);
      }
      writer.appendKeyword(this.polymorphicInfo.allOrAny);
      writer.appendSpace();
    }
    writer.appendExp(this.query);
    if (this.alias) {
      writer.appendSpace();
      writer.appendQuoted(this.alias);
    }
  }
}

/**
 * Describe next select statement in a compound select statement. @see [[SelectStatementExp]]
 * @alpha
 */
export interface NextSelect {
  op: CompoundSelectOp;
  select: SelectStatementExpr;
}

/**
 * Describe a optionally compound SELECT statement.
 * @alpha
 */
export class SelectStatementExpr extends StatementExpr {
  public static readonly type = ExprType.SelectStatement;
  public constructor(public readonly singleSelect: SelectExpr, public readonly nextSelect?: NextSelect) {
    super(SelectStatementExpr.type);
  }
  public override get children(): Expr[] {
    const exprs: Expr[] = [this.singleSelect];
    if (this.nextSelect)
      exprs.push(this.nextSelect.select);
    return exprs;
  }
  public static override deserialize(node: NativeECSqlParseNode): SelectStatementExpr {
    if (node.id !== NativeExpIds.SelectStatement) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SelectStatement'. ${JSON.stringify(node)}`);
    }
    const singleSelect = SelectExpr.deserialize(node.select as NativeECSqlParseNode);
    let nextSelect: NextSelect | undefined;
    if (node.nextBlock) {
      nextSelect = {
        op: node.nextBlock.combineOp as CompoundSelectOp,
        select: SelectStatementExpr.deserialize(node.nextBlock.select as NativeECSqlParseNode),
      };
    }
    return new SelectStatementExpr(singleSelect, nextSelect);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.singleSelect);
    if (this.nextSelect) {
      writer.appendSpace();
      if (this.nextSelect.op === "UNION ALL") {
        writer.appendKeyword("UNION");
        writer.appendSpace();
        writer.appendKeyword("ALL");
      } else {
        writer.append(this.nextSelect.op);
      }
      writer.appendSpace();
      writer.appendExp(this.nextSelect.select);
    }
  }
}

/**
 * Describe selection in a SELECT query
 * @alpha
 */
export class SelectionClauseExpr extends Expr {
  public static readonly type = ExprType.SelectionClause;
  public constructor(public readonly derivedPropertyList: DerivedPropertyExpr[]) {
    super(SelectionClauseExpr.type);
  }
  public override get children(): Expr[] {
    return [...this.derivedPropertyList];
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (!Array.isArray(node)) {
      throw new Error(`Expect node to be array of NativeECSqlParseNode[] ${JSON.stringify(node)}`);
    }
    return new SelectionClauseExpr(Array.from(node.map((v) => DerivedPropertyExpr.deserialize(v))));
  }
  public writeTo(writer: ECSqlWriter): void {
    this.derivedPropertyList.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
  }
}

/**
 * Describe a GROUP BY clause in a SELECT statement.
 * @alpha
 */
export class GroupByClauseExpr extends Expr {
  public static readonly type = ExprType.GroupByClause;
  public constructor(public readonly exprList: ValueExpr[]) {
    super(GroupByClauseExpr.type);
  }
  public override get children(): Expr[] {
    return [...this.exprList];
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (!Array.isArray(node)) {
      throw new Error(`Expect node to be array of NativeECSqlParseNode[] ${JSON.stringify(node)}`);
    }
    return new GroupByClauseExpr(Array.from(node.map((v) => ValueExpr.deserialize(v))));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("GROUP");
    writer.appendSpace();
    writer.appendKeyword("BY");
    writer.appendSpace();
    this.exprList.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
  }
}

/**
 * Describe a HAVING clause in a SELECT statement.
 * @alpha
 */
export class HavingClauseExpr extends Expr {
  public static readonly type = ExprType.HavingClause;
  public constructor(public readonly filterExpr: ComputedExpr) {
    super(HavingClauseExpr.type);
  }
  public override get children(): Expr[] {
    return [this.filterExpr];
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (typeof node !== "object") {
      throw new Error(`Expect node to be array of NativeECSqlParseNode ${JSON.stringify(node)}`);
    }
    return new HavingClauseExpr(BooleanExpr.deserialize(node));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("HAVING");
    writer.appendSpace();
    writer.appendExp(this.filterExpr);
  }
}

/**
 * Describe a FROM clause in a SELECT statement.
 * @alpha
 */
export class FromClauseExpr extends Expr {
  public static readonly type = ExprType.FromClause;
  public constructor(public readonly classRefs: ClassRefExpr[]) {
    super(FromClauseExpr.type);
  }
  public override get children(): Expr[] {
    return [...this.classRefs];
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (!Array.isArray(node)) {
      throw new Error(`Expect node to be array of NativeECSqlParseNode[] ${JSON.stringify(node)}`);
    }
    return new FromClauseExpr(Array.from(node.map((v) => ClassRefExpr.deserialize(v))));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("FROM");
    writer.appendSpace();
    this.classRefs.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
  }
}

/**
 * Describe a WHERE clause in a SELECT, UPDATE and DELETE statement.
 * @alpha
 */
export class WhereClauseExp extends Expr {
  public static readonly type = ExprType.WhereClause;
  public constructor(public readonly filterExpr: ComputedExpr) {
    super(WhereClauseExp.type);
  }
  public override get children(): Expr[] {
    return [this.filterExpr];
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (typeof node !== "object") {
      throw new Error(`Expect node to be array of NativeECSqlParseNode ${JSON.stringify(node)}`);
    }
    return new WhereClauseExp(BooleanExpr.deserialize(node));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("WHERE");
    writer.appendSpace();
    writer.appendExp(this.filterExpr);
  }
}

/**
 * Describe a single sorted term in a ORDER BY clause of a SELECT statement.
 * @alpha
 */
export class OrderBySpecExpr extends Expr {
  public static readonly type = ExprType.OrderBySpec;
  public constructor(public readonly term: ValueExpr, public readonly sortDirection?: SortDirection, public readonly nulls?: FirstOrLast) {
    super(OrderBySpecExpr.type);
  }
  public override get children(): Expr[] {
    return [this.term];
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (typeof node !== "object") {
      throw new Error(`Expect node to be array of NativeECSqlParseNode ${JSON.stringify(node)}`);
    }
    return new OrderBySpecExpr(ValueExpr.deserialize(node.exp), node.direction ? node.direction as SortDirection : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.term);
    if (this.sortDirection) {
      writer.appendSpace();
      writer.appendKeyword(this.sortDirection);
    }
    if (this.nulls) {
      writer.appendSpace();
      writer.appendKeyword("NULLS");
      writer.appendSpace();
      writer.appendKeyword(this.nulls);
    }
  }
}

/**
 * Describe a ORDER BY clause in a SELECT statement.
 * @alpha
 */
export class OrderByClauseExpr extends Expr {
  public static readonly type = ExprType.OrderByClause;
  public constructor(public readonly terms: OrderBySpecExpr[]) {
    super(OrderByClauseExpr.type);
  }
  public override get children(): Expr[] {
    return [...this.terms.map((v) => v.term)];
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (!Array.isArray(node)) {
      throw new Error(`Expect node to be array of NativeECSqlParseNode[] ${JSON.stringify(node)}`);
    }
    return new OrderByClauseExpr(Array.from(node.map((v) => OrderBySpecExpr.deserialize(v))));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("ORDER");
    writer.appendSpace();
    writer.appendKeyword("BY");
    writer.appendSpace();
    this.terms.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
  }
}
/**
 * Describe a LIMIT clause in a SELECT statement.
 * @alpha
 */
export class LimitClauseExpr extends Expr {
  public static readonly type = ExprType.LimitClause;
  public constructor(public readonly limit: ValueExpr, public readonly offset?: ValueExpr) {
    super(LimitClauseExpr.type);
  }
  public override get children(): Expr[] {
    const exprs: Expr[] = [this.limit];
    if (this.offset)
      exprs.push(this.offset);
    return exprs;
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (typeof node !== "object") {
      throw new Error(`Expect node to be array of NativeECSqlParseNode ${JSON.stringify(node)}`);
    }
    return new LimitClauseExpr(ValueExpr.deserialize(node.exp), node.offset ? ValueExpr.deserialize(node.offset as NativeECSqlParseNode) : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("LIMIT");
    writer.appendSpace();
    writer.appendExp(this.limit);
    if (this.offset) {
      writer.appendSpace();
      writer.appendKeyword("OFFSET");
      writer.appendSpace();
      writer.appendExp(this.offset);
    }
  }
}

/**
 * Describe a single select statement.
 * @alpha
 */
export class SelectExpr extends Expr {
  public static readonly type = ExprType.Select;
  public constructor(
    public readonly selection: SelectionClauseExpr,
    public readonly rowQuantifier?: AllOrDistinctOp,
    public readonly from?: FromClauseExpr,
    public readonly where?: WhereClauseExp,
    public readonly groupBy?: GroupByClauseExpr,
    public readonly having?: HavingClauseExpr,
    public readonly orderBy?: OrderByClauseExpr,
    public readonly limit?: LimitClauseExpr,
    public readonly options?: ECSqlOptionsClauseExpr) {
    super(SelectExpr.type);
  }
  public override get children(): Expr[] {
    const exprs: Expr[] = [this.selection];
    if (this.from)
      exprs.push(this.from);
    if (this.where)
      exprs.push(this.where);
    if (this.groupBy)
      exprs.push(this.groupBy);
    if (this.having)
      exprs.push(this.having);
    if (this.orderBy)
      exprs.push(this.orderBy);
    if (this.limit)
      exprs.push(this.limit);
    if (this.options)
      exprs.push(this.options);
    return exprs;
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.SingleSelectStatement && node.id !== NativeExpIds.RowConstructor) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SingleSelectStatement/RowConstructor'. ${JSON.stringify(node)}`);
    }
    if (node.id === NativeExpIds.RowConstructor) {
      const values = SelectionClauseExpr.deserialize(node.values);
      return new SelectExpr(values);
    }
    const selection = SelectionClauseExpr.deserialize(node.selection);
    const from = node.from ? FromClauseExpr.deserialize(node.from) : undefined;
    const where = node.where ? WhereClauseExp.deserialize(node.where) : undefined;
    const groupBy = node.groupBy ? GroupByClauseExpr.deserialize(node.groupBy) : undefined;
    const having = node.having ? HavingClauseExpr.deserialize(node.having) : undefined;
    const orderBy = node.orderBy ? OrderByClauseExpr.deserialize(node.orderBy) : undefined;
    const options = node.options ? ECSqlOptionsClauseExpr.deserialize(node.options) : undefined;
    const limitSpec = node.limit ? LimitClauseExpr.deserialize(node.limit) : undefined;
    const rowQuantifier = node.selectionType ? node.selectionType as AllOrDistinctOp : undefined;
    return new SelectExpr(selection, rowQuantifier, from, where, groupBy, having, orderBy, limitSpec, options);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("SELECT");
    writer.appendSpace();
    if (this.rowQuantifier) {
      writer.appendKeyword(this.rowQuantifier);
      writer.appendSpace();
    }
    writer.appendExp(this.selection);

    if (this.from) {
      writer.appendSpace();
      writer.appendExp(this.from);
    }
    if (this.where) {
      writer.appendSpace();
      writer.appendExp(this.where);
    }
    if (this.groupBy) {
      writer.appendSpace();
      writer.appendExp(this.groupBy);
    }
    if (this.having) {
      writer.appendSpace();
      writer.appendExp(this.having);
    }
    if (this.orderBy) {
      writer.appendSpace();
      writer.appendExp(this.orderBy);
    }
    if (this.limit) {
      writer.appendSpace();
      writer.appendExp(this.limit);
    }
    if (this.options) {
      writer.appendSpace();
      writer.appendExp(this.options);
    }
  }
}

/**
 * Describe a subquery when used as value. This kind of query expect to return one column and one one value.
 * @alpha
 */
export class SubqueryExpr extends ValueExpr {
  public static readonly type = ExprType.Subquery;
  public constructor(public readonly query: SelectStatementExpr) {
    super(SubqueryExpr.type);
  }
  public override get children(): Expr[] {
    return [this.query];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.Subquery) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.Subquery'. ${JSON.stringify(node)}`);
    }
    return new SubqueryExpr(SelectStatementExpr.deserialize(node.query as NativeECSqlParseNode));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append("(");
    writer.appendExp(this.query);
    writer.append(")");
  }
}

/**
 * Describe a binary boolean expression in ECSQL.
 * @alpha
 */
export class BinaryBooleanExpr extends BooleanExpr {
  public static readonly type = ExprType.BinaryBoolean;
  public constructor(public readonly op: BinaryBooleanOp, public readonly lhsExpr: ComputedExpr, public readonly rhsExpr: ComputedExpr, public readonly not?: UnaryBooleanOp) {
    super(BinaryBooleanExpr.type);
  }
  public override get children(): Expr[] {
    return [this.lhsExpr, this.rhsExpr];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
    }
    const op = node.op as BinaryBooleanOp;
    return new BinaryBooleanExpr(op, ComputedExpr.deserialize(node.lhs as NativeECSqlParseNode), ComputedExpr.deserialize(node.rhs as NativeECSqlParseNode));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append("(");
    writer.appendExp(this.lhsExpr);
    writer.appendBinaryOp(this.op);
    writer.appendExp(this.rhsExpr);
    writer.append(")");
  }
}

/**
 * Describe a <expr> IS NULL boolean expression
 * @alpha
 */
export class IsNullExpr extends BooleanExpr {
  public static readonly type = ExprType.IsNull;
  public constructor(public readonly operandExpr: ValueExpr, public readonly not?: UnaryBooleanOp) {
    super(IsNullExpr.type);
  }
  public override get children(): Expr[] {
    return [this.operandExpr];
  }
  public static parseOp(node: NativeECSqlParseNode) {
    const op = node.op as string;
    const isLiteral = node.rhs.op === NativeExpIds.LiteralValue;
    if (!isLiteral) {
      return [false, false];
    }
    const isNull = LiteralExpr.deserialize(node.rhs as NativeECSqlParseNode).rawValue === "NULL";
    return [op.startsWith("IS"), isNull];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
    }
    const [isNullExp, isNull] = this.parseOp(node);
    if (!isNullExp) {
      throw new Error(`Parse node has 'node.op !== IS NULL'. ${JSON.stringify(node)}`);
    }
    const exp = ValueExpr.deserialize(node.lhs as NativeECSqlParseNode);
    return new IsNullExpr(exp, isNull ? "NOT" : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.operandExpr);
    writer.appendSpace();
    writer.appendKeyword("IS");
    writer.appendSpace();
    if (this.not) {
      writer.appendKeyword("NOT");
      writer.appendSpace();
    }
    writer.appendKeyword("NULL");
  }
}

/**
 * Describe a <expr> IS (type1[, type2]) in ECSQL.
 * @alpha
 */
export class IsOfTypeExpr extends BooleanExpr {
  public static readonly type = ExprType.IsOfType;
  public constructor(public readonly lhsExpr: ValueExpr, public readonly typeNames: ClassNameExpr[], public readonly not?: UnaryBooleanOp) {
    super(IsOfTypeExpr.type);
  }
  public override get children(): Expr[] {
    return [this.lhsExpr, ...this.typeNames];
  }
  public static parseOp(node: NativeECSqlParseNode) {
    const op = node.op as string;
    return [op.startsWith("IS") && Array.isArray(node.rhs), op.endsWith("NOT")];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
    }
    const [isTypeOf, isNull] = this.parseOp(node);
    if (!isTypeOf) {
      throw new Error(`Parse node has 'node.op !== IS (type....)'. ${JSON.stringify(node)}`);
    }
    const exp = ValueExpr.deserialize(node.lhs as NativeECSqlParseNode);
    const classNames = Array.from((node.rhs as NativeECSqlParseNode[]).map((v) => ClassNameExpr.deserialize(v)));
    return new IsOfTypeExpr(exp, classNames, isNull ? "NOT" : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.lhsExpr);
    writer.appendSpace();
    writer.appendKeyword("IS");
    writer.appendSpace();
    if (this.not) {
      writer.appendKeyword("NOT");
      writer.appendSpace();
    }
    writer.append("(");
    this.typeNames.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
    writer.append(")");
  }
}

/**
 * Describe a NOT <expr>  boolean expression
 * @alpha
 */
export class NotExpr extends BooleanExpr {
  public static readonly type = ExprType.Not;
  public constructor(public readonly operandExpr: ComputedExpr) {
    super(NotExpr.type);
  }
  public override get children(): Expr[] {
    return [this.operandExpr];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BooleanFactor) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BooleanFactor'. ${JSON.stringify(node)}`);
    }
    const exp = ComputedExpr.deserialize(node.exp as NativeECSqlParseNode);
    return new NotExpr(exp);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append("(");
    writer.appendKeyword("NOT");
    writer.appendSpace();
    writer.appendExp(this.operandExpr);
    writer.append(")");
  }
}

/**
 * Describe a <expr> IN subquery|(val1[,val2...]) boolean expression
 * @alpha
 */
export class InExpr extends BooleanExpr {
  public static readonly type = ExprType.In;
  public constructor(public readonly lhsExpr: ValueExpr, public readonly rhsExpr: ValueExpr[] | SubqueryExpr, public readonly not?: UnaryBooleanOp) {
    super(InExpr.type);
  }
  public override get children(): Expr[] {
    const exprs: Expr[] = [this.lhsExpr];
    if (this.rhsExpr instanceof SubqueryExpr)
      exprs.push(this.rhsExpr);
    else {
      exprs.push(...this.rhsExpr);
    }
    return exprs;
  }
  public static parseOp(op: string) {
    return [op.endsWith("IN"), op.startsWith("NOT ")];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
    }
    const [isIn, isNull] = this.parseOp(node.op as string);
    if (!isIn) {
      throw new Error(`Parse node has 'node.op !== IN'. ${JSON.stringify(node)}`);
    }
    const lhs = ValueExpr.deserialize(node.lhs as NativeECSqlParseNode);
    if (Array.isArray(node.rhs))
      return new InExpr(lhs, Array.from((node.rhs as NativeECSqlParseNode[]).map((v) => ValueExpr.deserialize(v))), isNull ? "NOT" : undefined);
    else if (node.rhs.id === NativeExpIds.Subquery)
      return new InExpr(lhs, SubqueryExpr.deserialize(node.rhs as NativeECSqlParseNode), isNull ? "NOT" : undefined);
    else
      throw new Error(`unknown IN rhs ${node.rhs.id}`);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.lhsExpr);
    writer.appendSpace();
    if (this.not) {
      writer.appendKeyword("NOT");
      writer.appendSpace();
    }
    writer.appendKeyword("IN");
    writer.appendSpace();

    if (this.rhsExpr instanceof SubqueryExpr) {
      writer.appendExp(this.rhsExpr);
    } else if (Array.isArray(this.rhsExpr)) {
      writer.append("(");
      this.rhsExpr.forEach((v, i) => {
        if (i > 0) {
          writer.appendComma();
        }
        writer.appendExp(v);
      });
      writer.append(")");
    } else {
      throw new Error("unknown expression on rhs of IN expr.");
    }
  }
}

/**
 * Describe a <expr> LIKE <expr> [ESCAPE <expr>] boolean expression
 * @alpha
 */
export class LikeExpr extends BooleanExpr {
  public static readonly type = ExprType.Like;
  public constructor(public readonly lhsExpr: ValueExpr, public readonly patternExpr: ValueExpr, public readonly escapeExpr?: ValueExpr, public readonly not?: UnaryBooleanOp) {
    super(LikeExpr.type);
  }
  public override get children(): Expr[] {
    const exprs: Expr[] = [this.lhsExpr, this.patternExpr];
    if (this.escapeExpr)
      exprs.push(this.escapeExpr);
    return exprs;
  }
  public static parseOp(op: string) {
    return [op.endsWith("LIKE"), op.startsWith("NOT ")];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
    }
    const [isLike, isNull] = this.parseOp(node.op as string);
    if (!isLike) {
      throw new Error(`Parse node has 'node.op !== LIKE'. ${JSON.stringify(node)}`);
    }
    const lhs = ValueExpr.deserialize(node.lhs as NativeECSqlParseNode);
    const pattren = ValueExpr.deserialize(node.rhs.pattren as NativeECSqlParseNode);
    const escape = node.rhs.escape ? ValueExpr.deserialize(node.rhs.escape as NativeECSqlParseNode) : undefined;
    return new LikeExpr(lhs, pattren, escape, isNull ? "NOT" : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.lhsExpr);
    writer.appendSpace();
    if (this.not) {
      writer.appendKeyword("NOT");
      writer.appendSpace();
    }
    writer.appendKeyword("LIKE");
    writer.appendSpace();
    writer.appendExp(this.patternExpr);
    if (this.escapeExpr) {
      writer.appendSpace();
      writer.appendKeyword("ESCAPE");
      writer.appendSpace();
      writer.appendExp(this.escapeExpr);
    }
  }
}

/**
 * Describe a <expr> BETWEEN <expr> AND <expr> boolean expression
 * @alpha
 */
export class BetweenExpr extends BooleanExpr {
  public static readonly type = ExprType.Between;
  public constructor(public readonly lhsExpr: ValueExpr, public readonly lowerBoundExpr: ValueExpr, public readonly upperBoundExpr: ValueExpr, public readonly not?: UnaryBooleanOp) {
    super(BetweenExpr.type);
  }
  public override get children(): Expr[] {
    return [this.lhsExpr, this.lowerBoundExpr, this.upperBoundExpr];
  }
  public static parseOp(op: string) {
    return [op.endsWith(" BETWEEN"), op.startsWith("NOT ")];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
    }
    const [isBetween, isNull] = this.parseOp(node.op as string);
    if (!isBetween) {
      throw new Error(`Parse node has 'node.op !== BETWEEN'. ${JSON.stringify(node)}`);
    }
    const rhs = node.rhs as NativeECSqlParseNode;
    return new BetweenExpr(
      ValueExpr.deserialize(node.lhs),
      ValueExpr.deserialize(rhs.lbound),
      ValueExpr.deserialize(rhs.ubound),
      isNull ? "NOT" : undefined,
    );
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.lhsExpr);
    writer.appendSpace();
    if (this.not) {
      writer.appendKeyword("NOT");
      writer.appendSpace();
    }
    writer.appendKeyword("BETWEEN");
    writer.appendSpace();
    writer.appendExp(this.lowerBoundExpr);
    writer.appendSpace();
    writer.appendKeyword("AND");
    writer.appendSpace();
    writer.appendExp(this.upperBoundExpr);
  }
}

/**
 * Describe a common table expression base query statement
 * @alpha
 */
export class CteExpr extends StatementExpr {
  public static readonly type = ExprType.Cte;
  public constructor(public readonly cteBlocks: CteBlockExpr[], public readonly query: SelectStatementExpr, public readonly recursive?: RecursiveCte) {
    super(CteExpr.type);
  }
  public override get children(): Expr[] {
    return [...this.cteBlocks, this.query];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.CommonTable) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.CommonTable'. ${JSON.stringify(node)}`);
    }
    const blocks = Array.from((node.blocks as NativeECSqlParseNode[]).map((v) => CteBlockExpr.deserialize(v)));
    return new CteExpr(blocks, SelectStatementExpr.deserialize(node.select as NativeECSqlParseNode), node.recursive === true ? "RECURSIVE" : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("WITH");
    writer.appendSpace();
    if (this.recursive) {
      writer.appendKeyword(this.recursive);
      writer.appendSpace();
    }
    this.cteBlocks.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
    writer.appendSpace();
    writer.appendExp(this.query);
  }
}

/**
 * Describe a single block of CTE that can be reference in FROM clause of a SELECT
 * @alpha
 */
export class CteBlockExpr extends Expr {
  public static readonly type = ExprType.CteBlock;
  public constructor(public readonly name: string, public readonly query: SelectStatementExpr, public readonly props: string[]) {
    super(CteBlockExpr.type);
  }
  public override get children(): Expr[] {
    return [this.query];
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.CommonTableBlock) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.CommonTableBlock'. ${JSON.stringify(node)}`);
    }
    return new CteBlockExpr(node.name as string, SelectStatementExpr.deserialize(node.asQuery as NativeECSqlParseNode), node.args as string[]);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendQuoted(this.name);
    writer.append("(");
    this.props.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendQuoted(v);
    });
    writer.append(")");
    writer.appendSpace();
    writer.appendKeyword("AS");
    writer.appendSpace();
    writer.append("(");
    writer.appendLine();
    writer.indent();
    writer.appendExp(this.query);
    writer.unindent();
    writer.appendLine();
    writer.append(")");
  }
}

/**
 * Describe a name reference to a CTE block.
 * @alpha
 */
export class CteBlockRefExpr extends ClassRefExpr {
  public static readonly type = ExprType.CteBlockRef;
  public constructor(public readonly name: string, public readonly alias?: string) {
    super(CteBlockRefExpr.type);
  }
  public override get children(): Expr[] {
    return [];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.CommonTableBlockName) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.CommonTableBlockName'. ${JSON.stringify(node)}`);
    }
    return new CteBlockRefExpr(node.name as string, node.alias ? node.alias as string : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendQuoted(this.name);
    if (this.alias) {
      writer.appendQuoted(this.alias);
    }
  }
}

/**
 * Describe a table value function expression in ECSQL that appear in FROM clause of query.
 * @alpha
 */
export class TableValuedFuncExpr extends ClassRefExpr {
  public static readonly type = ExprType.TableValuedFunc;
  public constructor(public readonly schemaName: string, public readonly memberFunc: MemberFuncCallExpr, public readonly alias?: string) {
    super(TableValuedFuncExpr.type);
  }
  public override get children(): Expr[] {
    return [this.memberFunc];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.TableValuedFunction) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.TableValuedFunction'. ${JSON.stringify(node)}`);
    }
    return new TableValuedFuncExpr(node.schema as string, MemberFuncCallExpr.deserialize(node.func as NativeECSqlParseNode), node.alias as string);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendQuoted(this.schemaName);
    writer.append(".");
    writer.appendExp(this.memberFunc);
    if (this.alias) {
      writer.appendSpace();
      writer.appendQuoted(this.alias);
    }
  }
}

/**
 * Describe a class name reference in ECSQL that appear in FROM clause of a SELECT.
 * @alpha
 */
export class ClassNameExpr extends ClassRefExpr {
  public static readonly type = ExprType.ClassName;
  public constructor(public readonly schemaNameOrAlias: string, public readonly className: string, public readonly tablespace?: string, public readonly alias?: string, public polymorphicInfo?: PolymorphicInfo, public readonly memberFunc?: MemberFuncCallExpr) {
    super(ClassNameExpr.type);
  }
  public override get children(): Expr[] {
    return [];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.ClassName) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.ClassName'. ${JSON.stringify(node)}`);
    }
    const className = node.className as string;
    const tablespace = node.tableSpace ? node.tableSpace as string : undefined;
    const schemaName = node.schemaName as string;

    const alias = node.alias ? node.alias as string : undefined;
    const polymorphicInfo = node.polymorphicInfo ? { disqualify: node.polymorphicInfo.disqualify, allOrAny: node.polymorphicInfo.scope } as PolymorphicInfo : undefined;
    const memberFunc = node.func ? MemberFuncCallExpr.deserialize(node.func as NativeECSqlParseNode) : undefined;
    return new ClassNameExpr(schemaName, className, tablespace, alias, polymorphicInfo, memberFunc);
  }
  public writeTo(writer: ECSqlWriter): void {
    if (this.polymorphicInfo) {
      if (this.polymorphicInfo.disqualify) {
        writer.append(this.polymorphicInfo.disqualify);
      }
      writer.appendKeyword(this.polymorphicInfo.allOrAny);
      writer.appendSpace();
    }
    if (this.tablespace) {
      writer.append("[").append(this.tablespace).append("]");
      writer.append(".");
    }
    writer.append("[").append(this.schemaNameOrAlias).append("]");
    writer.append(".");
    writer.append("[").append(this.className).append("]");

    if (this.memberFunc) {
      writer.append(".");
      writer.appendExp(this.memberFunc);
    }
    if (this.alias) {
      writer.appendSpace();
      writer.appendQuoted(this.alias);
    }
  }
  public static fromECSql(ecsql: string) {
    const regex = /\s*((\+)?\s*(ALL|ONLY)\s+)?(\[?(\w+)\]?[\.:])?\[?(\w+)\]?[\.:]\[?(\w+)\]?(\s+(AS)?(\s+(\w+)))?/i;
    const match = ecsql.match(regex);
    if (!match) {
      throw new Error("ECSQL className must follow syntax: [+][ALL|ONLY] [tablespace.][.|:][schemaOrAlias]][.|:][className] [AS] [alias");
    }
    const plus = match[2];
    const allOrOnlyStr = match[3];
    const tablespace = match[5];
    const schemaOrAlias = match[6];
    const className = match[7];
    const alias = match[11];
    if (!schemaOrAlias || !className)
      throw new Error("ECSQL className must follow syntax: [+][ALL|ONLY] [tablespace.][.|:][schemaOrAlias]][.|:][className] [AS] [alias");
    let polyInfo: PolymorphicInfo | undefined;
    if (allOrOnlyStr) {
      const allOrAny = allOrOnlyStr.toUpperCase() as AllOrAnyOp;
      polyInfo = { disqualify: plus as DisqualifyOp, allOrAny };
    }
    return new ClassNameExpr(schemaOrAlias, className, tablespace, alias, polyInfo);
  }
}

/**
 * Describe a UPDATE statement in ECSQL.
 * @alpha
 */
export class UpdateStatementExpr extends StatementExpr {
  public static readonly type = ExprType.UpdateStatement;
  public constructor(public readonly className: ClassNameExpr, public readonly assignement: SetClauseExpr, public readonly where?: WhereClauseExp, public readonly options?: ECSqlOptionsClauseExpr) {
    super(UpdateStatementExpr.type);
  }
  public override get children(): Expr[] {
    const exprs: Expr[] = [this.className, this.assignement];
    if (this.where)
      exprs.push(this.where);
    if (this.options)
      exprs.push(this.options);
    return exprs;
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.UpdateStatement) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.UpdateStatement'. ${JSON.stringify(node)}`);
    }
    const className = ClassNameExpr.deserialize(node.className);
    const assignment = SetClauseExpr.deserialize(node.assignment as NativeECSqlParseNode[]);
    const where = node.where ? WhereClauseExp.deserialize(node.where as NativeECSqlParseNode) : undefined;
    const options = node.options ? ECSqlOptionsClauseExpr.deserialize(node.options as NativeECSqlParseNode) : undefined;
    return new UpdateStatementExpr(className, assignment, where, options);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("UPDATE");
    writer.appendSpace();
    writer.appendExp(this.className);
    writer.appendSpace();
    writer.appendExp(this.assignement);
    if (this.where) {
      writer.appendSpace();
      writer.appendExp(this.where);
    }
    if (this.options) {
      writer.appendSpace();
      writer.appendExp(this.options);
    }
  }
}

/**
 * Supported options in ECSQL option clause
 * @alpha
 */
export type ECSqlSupportedOptions = "NoECClassIdFilter" | "ReadonlyPropertiesAreUpdatable";

/**
 * ECSql option name and optionally value pair.
 * @alpha
 */
export interface ECSqlOption {
  name: ECSqlSupportedOptions;
  value?: string;
}

/**
 * Describe ECSQL option clause.
 * @alpha
 */
export class ECSqlOptionsClauseExpr extends Expr {
  public static readonly type = ExprType.ECSqlOptionsClause;
  public constructor(public readonly options: ECSqlOption[]) {
    super(ECSqlOptionsClauseExpr.type);
  }
  public override get children(): Expr[] {
    return [];
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.Options) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.Options'. ${JSON.stringify(node)}`);
    }
    return new ECSqlOptionsClauseExpr(node.options as ECSqlOption[]);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("ECSQLOPTIONS");
    writer.appendSpace();
    this.options.forEach((v, i) => {
      if (i > 0) {
        writer.appendSpace();
      }
      writer.append(v.name);
      if (v.value) {
        writer.appendBinaryOp("=");
        writer.append(v.value);
      }
    });
  }
}

/**
 * A single property value assignment for update clause
 * @alpha
 */
export class AssignmentExpr extends Expr {
  public static readonly type = ExprType.Assignment;
  public constructor(public readonly propertyName: PropertyNameExpr, public readonly valueExpr: ValueExpr) {
    super(SetClauseExpr.type);
  }
  public override get children(): Expr[] {
    return [this.propertyName, this.valueExpr];
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.Assignment) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.Assignment'. ${JSON.stringify(node)}`);
    }
    return new AssignmentExpr(PropertyNameExpr.deserialize(node.propertyName), ValueExpr.deserialize(node.value));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.propertyName);
    writer.appendBinaryOp("=");
    writer.appendExp(this.valueExpr);
  }
}

/**
 * Describe a set clause in a UPDATE statement
 * @alpha
 */
export class SetClauseExpr extends Expr {
  public static readonly type = ExprType.SetClause;
  public constructor(public readonly assignments: AssignmentExpr[]) {
    super(SetClauseExpr.type);
  }
  public override get children(): Expr[] {
    return [...this.assignments];
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (!Array.isArray(node)) {
      throw new Error(`AssignmentClause expect array of NativeECSqlParseNode. ${JSON.stringify(node)}`);
    }
    const setClause = node as NativeECSqlParseNode[];
    const assignments: AssignmentExpr[] = [];
    setClause.forEach((v) => {
      assignments.push(AssignmentExpr.deserialize(v));
    });
    return new SetClauseExpr(assignments);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("SET");
    writer.appendSpace();
    this.assignments.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
  }
}
/**
 * Describe a strong typed IIF function in ECSQL
 * @alpha
 */
export class IIFExpr extends ValueExpr {
  public static readonly type = ExprType.IIF;
  public constructor(public readonly whenExpr: BooleanExpr, public readonly thenExpr: ValueExpr, public readonly elseExpr: ValueExpr) {
    super(IIFExpr.type);
  }
  public override get children(): Expr[] {
    return [this.whenExpr, this.thenExpr, this.elseExpr];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.IIF) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.IIF'. ${JSON.stringify(node)}`);
    }
    return new IIFExpr(BooleanExpr.deserialize(node.when as NativeECSqlParseNode), ValueExpr.deserialize(node.then as NativeECSqlParseNode), ValueExpr.deserialize(node.else as NativeECSqlParseNode));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("IIF");
    writer.append("(");
    writer.appendExp(this.whenExpr);
    writer.appendComma();
    writer.appendExp(this.thenExpr);
    writer.appendComma();
    writer.appendExp(this.elseExpr);
    writer.append(")");
  }
}
/**
 * When then block in CASE-WHEN-THEN expression
 * @alpha
 */
export interface WhenThenBlock {
  whenExpr: BooleanExpr;
  thenExpr: ValueExpr;
}

/**
 * Describe a CASE-WHEN-THEN expression in ECSQL
 * @alpha
 */
export class SearchCaseExpr extends ValueExpr {
  public static readonly type = ExprType.SearchCase;
  public constructor(public readonly whenThenList: WhenThenBlock[], public readonly elseExpr?: ValueExpr) {
    super(SearchCaseExpr.type);
  }
  public override get children(): Expr[] {
    const exprs: Expr[] = [];
    this.whenThenList.forEach((v) => {
      exprs.push(v.whenExpr, v.thenExpr);
    });
    if (this.elseExpr)
      exprs.push(this.elseExpr);
    return exprs;
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.SearchCaseValue) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SearchCaseValue'. ${JSON.stringify(node)}`);
    }
    const whenThenList: WhenThenBlock[] = [];
    for (const whenThenProps of node.whenThenList as NativeECSqlParseNode[]) {
      whenThenList.push({
        whenExpr: BooleanExpr.deserialize(whenThenProps.when as NativeECSqlParseNode),
        thenExpr: ValueExpr.deserialize(whenThenProps.then as NativeECSqlParseNode),
      });
    }
    const elseExp = node.elseExp ? ValueExpr.deserialize(node.elseExp as NativeECSqlParseNode) : undefined;
    return new SearchCaseExpr(whenThenList, elseExp);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("CASE");
    this.whenThenList.forEach((v) => {
      writer.appendSpace();
      writer.appendKeyword("WHEN");
      writer.appendSpace();
      writer.appendExp(v.whenExpr);
      writer.appendSpace();
      writer.appendKeyword("THEN");
      writer.appendSpace();
      writer.appendExp(v.thenExpr);
    });
    if (this.elseExpr) {
      writer.appendSpace();
      writer.appendKeyword("ELSE");
      writer.appendSpace();
      writer.appendExp(this.elseExpr);
    }
    writer.appendSpace();
    writer.appendKeyword("END");
  }
}
/**
 * Describe a binary value expression
 * @alpha
 */
export class BinaryValueExpr extends ValueExpr {
  public static readonly type = ExprType.BinaryValue;
  public constructor(public readonly op: BinaryValueOp, public readonly lhsExpr: ValueExpr, public readonly rhsExpr: ValueExpr) {
    super(BinaryValueExpr.type);
  }
  public override get children(): Expr[] {
    return [this.lhsExpr, this.rhsExpr];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryValue && node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryValue' . ${JSON.stringify(node)}`);
    }
    return new BinaryValueExpr(node.op as BinaryValueOp, ValueExpr.deserialize(node.lhs as NativeECSqlParseNode), ValueExpr.deserialize(node.rhs as NativeECSqlParseNode));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append("(");
    writer.appendExp(this.lhsExpr);
    writer.appendBinaryOp(this.op);
    writer.appendExp(this.rhsExpr);
    writer.append(")");
  }
}

/**
 * Cast a expression into a target time e.g. CAST(<expr> AS STRING)
 * @alpha
 */
export class CastExpr extends ValueExpr {
  public static readonly type = ExprType.Cast;
  public constructor(public readonly valueExpr: ValueExpr, public readonly targetType: string) {
    super(CastExpr.type);
  }
  public override get children(): Expr[] {
    return [this.valueExpr];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.Cast) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.CastExp'. ${JSON.stringify(node)}`);
    }
    return new CastExpr(ValueExpr.deserialize(node.exp as NativeECSqlParseNode), node.as as string);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("CAST");
    writer.append("(");
    writer.appendExp(this.valueExpr);
    writer.appendSpace();
    writer.appendKeyword("AS");
    writer.appendSpace();
    writer.append(this.targetType);
    writer.append(")");
  }
}
/**
 * Represent a member function called w.r.t a ClassNameExpr
 * @alpha
 */
export class MemberFuncCallExpr extends Expr {
  public static readonly type = ExprType.MemberFuncCall;
  public constructor(public readonly functionName: string, public readonly args: ValueExpr[]) {
    super(MemberFuncCallExpr.type);
  }
  public override get children(): Expr[] {
    return [...this.args];
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.MemberFunctionCall) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.MemberFunctionCall'. ${JSON.stringify(node)}`);
    }

    const args = Array.from((node.args as NativeECSqlParseNode[]).map((v) => ValueExpr.deserialize(v)));
    return new MemberFuncCallExpr(node.name as string, args);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendQuoted(this.functionName);
    writer.append("(");
    this.args.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
    writer.append(")");
  }
}

/**
 * Represent a function call in ecsql
 * @alpha
 */
export class FuncCallExpr extends ValueExpr {
  public static readonly type = ExprType.FuncCall;
  public constructor(public readonly functionName: string, public readonly args: ValueExpr[], public readonly allOrDistinct?: AllOrDistinctOp) {
    super(FuncCallExpr.type);
  }
  public override get children(): Expr[] {
    return [...this.args];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.FunctionCall) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.FunctionCall'. ${JSON.stringify(node)}`);
    }

    const args = Array.from((node.args as NativeECSqlParseNode[]).map((v) => ValueExpr.deserialize(v)));
    const rowQuantifier = node.quantifier ? node.quantifier as AllOrDistinctOp : undefined;
    return new FuncCallExpr(node.name as string, args, rowQuantifier);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append(this.functionName);
    writer.append("(");
    if (this.allOrDistinct) {
      writer.appendKeyword(this.allOrDistinct);
      writer.appendSpace();
    }
    this.args.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
    writer.append(")");
  }
  public static makeAbs(arg: ValueExpr) {
    return new FuncCallExpr("ABS", [arg]);
  }
  public static makeLower(arg: ValueExpr) {
    return new FuncCallExpr("LOWER", [arg]);
  }
  public static makeUpper(arg: ValueExpr) {
    return new FuncCallExpr("UPPER", [arg]);
  }
  public static makeLTrim(arg0: ValueExpr, arg1?: ValueExpr) {
    return new FuncCallExpr("LTRIM", arg1 ? [arg0, arg1] : [arg0]);
  }
  public static makeRTrim(arg0: ValueExpr, arg1?: ValueExpr) {
    return new FuncCallExpr("RTRIM", arg1 ? [arg0, arg1] : [arg0]);
  }
  public static makeLHex(arg: ValueExpr) {
    return new FuncCallExpr("HEX", [arg]);
  }
  public static makeLIfNull(arg0: ValueExpr, arg1: ValueExpr) {
    return new FuncCallExpr("IFNULL", [arg0, arg1]);
  }
  public static makeInstr(arg0: ValueExpr, arg1: ValueExpr) {
    return new FuncCallExpr("INSTR", [arg0, arg1]);
  }
  public static makeLength(arg0: ValueExpr) {
    return new FuncCallExpr("LENGTH", [arg0]);
  }
  public static makeLike(arg0: ValueExpr, arg1: ValueExpr, arg2?: ValueExpr) {
    return new FuncCallExpr("LIKE", arg2 ? [arg0, arg1, arg2] : [arg0, arg1]);
  }
  public static makeLikelihood(arg0: ValueExpr, arg1: ValueExpr) {
    return new FuncCallExpr("LIKELIHOOD", [arg0, arg1]);
  }
  public static makeMax(arg: ValueExpr, ...optionalArgs: ValueExpr[]) {
    return new FuncCallExpr("MAX", [arg, ...optionalArgs]);
  }
  public static makeMin(arg: ValueExpr, ...optionalArgs: ValueExpr[]) {
    return new FuncCallExpr("MIN", [arg, ...optionalArgs]);
  }
  public static makePrintf(arg: ValueExpr, ...optionalArgs: ValueExpr[]) {
    return new FuncCallExpr("PRINTF", [arg, ...optionalArgs]);
  }
  public static makeRandom() {
    return new FuncCallExpr("RANDOM", []);
  }
  public static makeQuote(arg: ValueExpr) {
    return new FuncCallExpr("QUOTE", [arg]);
  }
  public static makeRandomBlob(arg: ValueExpr) {
    return new FuncCallExpr("RANDOMBLOB", [arg]);
  }
  public static makeReplace(arg0: ValueExpr, arg1: ValueExpr, arg2: ValueExpr) {
    return new FuncCallExpr("REPLACE", [arg0, arg1, arg2]);
  }
  public static makeRound(arg0: ValueExpr, arg1?: ValueExpr) {
    return new FuncCallExpr("ROUND", arg1 ? [arg0, arg1] : [arg0]);
  }
  public static makeSign(arg0: ValueExpr) {
    return new FuncCallExpr("SIGN", [arg0]);
  }
  public static makeUnhex(arg0: ValueExpr) {
    return new FuncCallExpr("UNHEX", [arg0]);
  }
  public static makeSoundex(arg0: ValueExpr) {
    return new FuncCallExpr("SOUNDEX", [arg0]);
  }
  public static makeTrim(arg0: ValueExpr, arg1?: ValueExpr) {
    return new FuncCallExpr("TRIM", arg1 ? [arg0, arg1] : [arg0]);
  }
  public static makeTypeOf(arg0: ValueExpr) {
    return new FuncCallExpr("TYPEOF", [arg0]);
  }
  public static makeZeroBlob(arg0: ValueExpr) {
    return new FuncCallExpr("ZEROBLOB", [arg0]);
  }
  public static makeUnlikely(arg0: ValueExpr) {
    return new FuncCallExpr("UNLIKELY", [arg0]);
  }
  public static makeSubstring(arg0: ValueExpr, arg1: ValueExpr, arg2: ValueExpr) {
    return new FuncCallExpr("SUBSTR", [arg0, arg1, arg2]);
  }
  public static makeStrToGuid(arg0: ValueExpr) {
    return new FuncCallExpr("STRTOGUID", [arg0]);
  }
  public static makeGuidToStr(arg0: ValueExpr) {
    return new FuncCallExpr("GUIDTOSTR", [arg0]);
  }
  public static makeIdToHex(arg0: ValueExpr) {
    return new FuncCallExpr("IDTOHEX", [arg0]);
  }
  public static makeHexToId(arg0: ValueExpr) {
    return new FuncCallExpr("HEXTOID", [arg0]);
  }
  public static makeEcClassName(arg0: ValueExpr, fmt: "s:c" | "a:c" | "s" | "a" | "c" | "s.c" | "a.c" = "s:c") {
    return new FuncCallExpr("EC_CLASSNAME", [arg0, new LiteralExpr(LiteralValueType.String, fmt)]);
  }
  public static makeEcClassId(arg0: ValueExpr) {
    return new FuncCallExpr("EC_CLASSId", [arg0]);
  }
  public static makeInstanceOf(arg0: ValueExpr, arg1: ValueExpr) {
    return new FuncCallExpr("EC_INSTANCEOF", [arg0, arg1]);
  }
}

/**
 * Represent positional or named parameter
 * @alpha
 */
export class ParameterExpr extends ValueExpr {
  public static readonly type = ExprType.Parameter;
  public constructor(public readonly name?: string) {
    super(ParameterExpr.type);
  }
  public override get children(): Expr[] {
    return [];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.Parameter) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.Parameter'. ${JSON.stringify(node)}`);
    }
    return new ParameterExpr(node.name as string);
  }
  public writeTo(writer: ECSqlWriter): void {
    if (this.name && this.name !== "")
      writer.append(`:${this.name}`);
    else
      writer.append(`?`);
  }
}

/**
 * Unary value with operator e.g. [+|-|~]<number>
 * @alpha
 */
export class UnaryValueExpr extends ValueExpr {
  public static readonly type = ExprType.Unary;
  public constructor(public readonly op: UnaryValueOp, public readonly valueExpr: ValueExpr) {
    super(UnaryValueExpr.type);
  }
  public override get children(): Expr[] {
    return [this.valueExpr];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.UnaryValue && node.id !== NativeExpIds.BooleanFactor) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.UnaryValue  && node.id !== NativeExpIds.BooleanFactor'. ${JSON.stringify(node)}`);
    }
    if (node.op !== "+" && node.op !== "-" && node.op !== "~") {
      throw new Error(`Unrecognized operator in .node.op'. Must me on of UnaryOp. ${JSON.stringify(node)}`);
    }
    return new UnaryValueExpr(node.op as UnaryValueOp, ValueExpr.deserialize(node.exp as NativeECSqlParseNode));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append(this.op);
    writer.appendExp(this.valueExpr);
  }
}

/**
 * Represent constant literal like string, data, time, timestamp, number or null
 * @alpha
 */
export class LiteralExpr extends ValueExpr {
  public static readonly type = ExprType.Literal;
  public constructor(public readonly valueType: LiteralValueType, public readonly rawValue: string) {
    super(LiteralExpr.type);
  }
  public override get children(): Expr[] {
    return [];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.LiteralValue) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.LiteralValue'. ${JSON.stringify(node)}`);
    }
    return new LiteralExpr(node.kind as LiteralValueType, node.value as string);
  }
  public writeTo(writer: ECSqlWriter): void {
    if (this.valueType === LiteralValueType.String)
      writer.appendStringLiteral(this.rawValue);
    else if (this.valueType === LiteralValueType.Date)
      writer.appendKeyword("DATE").appendSpace().appendStringLiteral(this.rawValue);
    else if (this.valueType === LiteralValueType.Time)
      writer.appendKeyword("TIME").appendSpace().appendStringLiteral(this.rawValue);
    else if (this.valueType === LiteralValueType.Timestamp)
      writer.appendKeyword("TIMESTAMP").appendSpace().appendStringLiteral(this.rawValue);
    else if (this.valueType === LiteralValueType.Null)
      writer.appendKeyword("NULL");
    else
      writer.append(this.rawValue);
  }
  public static makeRaw(val: string) { return new LiteralExpr(LiteralValueType.Raw, val); }
  public static makeString(val: string) { return new LiteralExpr(LiteralValueType.String, val); }
  public static makeNumber(val: number) { return new LiteralExpr(LiteralValueType.Raw, val.toString()); }
  public static makeDate(val: Date) { return new LiteralExpr(LiteralValueType.Date, val.toDateString()); }
  public static makeTime(val: Date) { return new LiteralExpr(LiteralValueType.String, val.toTimeString()); }
  public static makeTimestamp(val: Date) { return new LiteralExpr(LiteralValueType.String, val.toTimeString()); }
  public static makeNull() { return new LiteralExpr(LiteralValueType.Null, ""); }
}

/**
 * Represent property name identifier
 * @alpha
 */
export class PropertyNameExpr extends ValueExpr {
  public static readonly type = ExprType.PropertyName;
  public constructor(public readonly propertyPath: string) {
    super(PropertyNameExpr.type);
  }
  public override get children(): Expr[] {
    return [];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.PropertyName) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.PropertyNameExp'. ${JSON.stringify(node)}`);
    }
    return new PropertyNameExpr(node.path as string);
  }
  public writeTo(writer: ECSqlWriter): void {
    // donot quote $
    const str = this.propertyPath.split("->");
    if (str.length === 2) {
      writer.append(str[0].split(".").map((v) => v.startsWith("[") || v === "$" ? v : `[${v}]`).join("."));
      writer.append("->");
    }
    writer.append(str[str.length - 1].split(".").map((v) => v.startsWith("[") || v === "$" ? v : `[${v}]`).join("."));
  }
}

/**
 * Represent navigation value creation function
 * @alpha
 */
export class NavValueCreationFuncExpr extends ValueExpr {
  public static readonly type = ExprType.NavValueCreationFunc;
  public static readonly navValueCreationFuncExprName = "NAVIGATION_VALUE";
  public constructor(
    public readonly columnRefExp: DerivedPropertyExpr,
    public readonly idArgExp: ValueExpr,
    public readonly classNameExp: ClassNameExpr,
    public readonly relECClassIdExp?: ValueExpr,
  ) {
    super(NavValueCreationFuncExpr.type);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.append(NavValueCreationFuncExpr.navValueCreationFuncExprName)
      .appendParenLeft()
      .appendExp(this.classNameExp)
      .append(".")
      .appendExp(this.columnRefExp)
      .appendComma();

    writer.appendExp(this.idArgExp);
    if (this.relECClassIdExp) {
      writer.appendComma();
      writer.appendExp(this.relECClassIdExp);
    }
    writer.appendParenRight();
  }
  public override get children(): Expr[] {
    const arr = [this.columnRefExp, this.idArgExp, this.classNameExp];
    if (this.relECClassIdExp)
      arr.push(this.relECClassIdExp);

    return arr;
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.NavValueCreationFunc) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.NavValueCreationFuncExp'. ${JSON.stringify(node)}`);
    }
    return new NavValueCreationFuncExpr(
      DerivedPropertyExpr.deserialize(node.ColumnRefExp as DerivedPropertyExpr),
      ValueExpr.deserialize(node.IdArgExp as ValueExpr),
      ClassNameExpr.deserialize(node.ClassNameExp as ClassNameExpr),
      node.RelECClassIdExp ? ValueExpr.deserialize(node.RelECClassIdExp) : undefined,
    );
  }
}
