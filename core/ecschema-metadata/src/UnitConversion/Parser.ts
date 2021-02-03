/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chevrotain from "chevrotain";

const createToken = chevrotain.createToken;
const Lexer = chevrotain.Lexer;
const CstParser = chevrotain.CstParser;

// using the NA pattern marks this Token class as 'irrelevant' for the Lexer.
// AdditionOperator defines a Tokens hierarchy but only the leafs in this hierarchy define
// actual Tokens that can appear in the text
const unitName = createToken({
  name: "UnitName",
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
});
const integer = createToken({ name: "Power", pattern: /[+-]?[0-9]+/ });
const multiply = createToken({ name: "Multiply", pattern: /\*/ });
const whiteSpace = createToken({
  name: "Whitespace",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});
const leftBracket = createToken({ name: "LeftBracket", pattern: /\(/ });
const rightBracket = createToken({ name: "RightBracket", pattern: /\)/ });
const leftSquareBracket = createToken({
  name: "LeftSquareBracket",
  pattern: /\[/,
});
const rightSquareBracket = createToken({
  name: "RightSquareBracket",
  pattern: /\]/,
});

leftBracket.LABEL = "(";
rightBracket.LABEL = ")";
multiply.LABEL = "*";
leftSquareBracket.LABEL = "[";
rightSquareBracket.LABEL = "]";

const allTokens = [
  whiteSpace,
  leftBracket,
  rightBracket,
  leftSquareBracket,
  rightSquareBracket,
  unitName,
  integer,
  multiply,
];

export const UnitLexer = new Lexer(allTokens);

// ----------------- parser -----------------
// Note that this is a Pure grammar, it only describes the grammar
// Not any actions (semantics) to perform during parsing.
export class UnitPure extends CstParser {
  constructor() {
    super(allTokens);
    this.performSelfAnalysis();
  }

  public definition = this.RULE("definition", () => {
    this.SUBRULE(this.unitExpression, { LABEL: "lhs" });
    this.MANY(() => {
      this.CONSUME(multiply);
      this.SUBRULE2(this.unitExpression, { LABEL: "rhs" });
    });
  });

  private unitWithPower = this.RULE("unitWithPower", () => {
    this.CONSUME(unitName);
    this.OPTION(() => {
      this.CONSUME(leftBracket);
      this.CONSUME(integer);
      this.CONSUME(rightBracket);
    });
  });

  private bracketedDefinition = this.RULE("bracketedDefinition", () => {
    this.CONSUME(leftSquareBracket);
    this.SUBRULE(this.definition);
    this.CONSUME(rightSquareBracket);
    this.OPTION(() => {
      this.CONSUME(leftBracket);
      this.CONSUME(integer);
      this.CONSUME(rightBracket);
    });
  });

  private unitExpression = this.RULE("unitExpression", () =>
    this.OR([
      { ALT: () => this.SUBRULE(this.unitWithPower) },
      { ALT: () => this.SUBRULE(this.bracketedDefinition) },
    ])
  );
}

// wrapping it all together
// reuse the same parser instance.
const parser = new UnitPure();

// ----------------- Interpreter -----------------
const BaseCstVisitor = parser.getBaseCstVisitorConstructor();

export class UnitDef {
  constructor(public readonly name: string, public readonly exponent: number) {}

  multiply(power: number): UnitDef {
    return new UnitDef(this.name, this.exponent + power);
  }

  raise(power: number): UnitDef {
    return new UnitDef(this.name, this.exponent * power);
  }
}

export class UnitMap {
  unitMap: Map<string, UnitDef>;

  constructor() {
    this.unitMap = new Map<string, UnitDef>();
  }

  upsert(def: UnitDef): void {
    const existing = this.unitMap.get(def.name);
    if (!existing) {
      this.unitMap.set(def.name, def);
      return;
    }

    const raised = existing.multiply(def.exponent);
    this.unitMap.set(def.name, raised);
  }

  raise(power: number): void {
    this.unitMap.forEach((v, k) => {
      this.unitMap.set(k, v.raise(power));
    });
  }

  forEach(op: (value: UnitDef) => void): void {
    this.unitMap.forEach(op);
  }

  map<T>(op: (value: UnitDef) => T ): T[] {
    const results: T[] = [];
    this.forEach(def => {
      const result = op(def)
      results.push(result)
    })
    return results;
  }

  merge(rhs: UnitMap): void {
    rhs.forEach((v) => {
      this.upsert(v);
    });
  }

  has(unitName: string): boolean {
    return this.unitMap.has(unitName);
  }

  get(unitName: string): UnitDef | undefined {
    return this.unitMap.get(unitName);
  }

  get length(): number {
    return this.unitMap.size;
  }
}

export class UnitInterpreter extends BaseCstVisitor {
  constructor() {
    super();
    // This helper will detect any missing or redundant methods on this visitor
    this.validateVisitor();
  }

  unitWithPower(ctx: any): UnitMap {
    const name = ctx.UnitName[0].image;
    let exponent = 1;
    if (ctx.Power) {
      exponent = parseInt(ctx.Power[0].image, 10);
    }
    const result = new UnitMap();
    const unit = new UnitDef(name, exponent);
    result.upsert(unit);
    return result;
  }

  unitExpression(ctx: any): UnitMap {
    if (ctx.unitWithPower) {
      return this.visit(ctx.unitWithPower);
    }
    if (ctx.bracketedDefinition) {
      return this.visit(ctx.bracketedDefinition);
    }

    // Should not reach this code
    throw new Error("Unexpected parser input");
  }

  bracketedDefinition(ctx: any): UnitMap {
    const result = this.visit(ctx.definition);
    const exponent = ctx.Power ? parseInt(ctx.Power[0].image, 10) : 1;
    result.raise(exponent);
    return result;
  }

  definition(ctx: any): UnitMap {
    const unitMap = this.visit(ctx.lhs);
    if (ctx.rhs) {
      ctx.rhs.forEach((rhsOperand: any) => {
        const rMap = this.visit(rhsOperand);
        unitMap.merge(rMap);
      });
    }

    return unitMap;
  }
}

export class UnitPaser {
  static parse(input: string): UnitMap {
    const lexingResult = UnitLexer.tokenize(input);
    //const parser = new UnitInterpreter()
    parser.input = lexingResult.tokens;
    const cst = parser.definition();
    if (parser.errors.length > 0) {
      throw new Error(parser.errors[0].message);
    }

    const interpreter = new UnitInterpreter();
    return interpreter.visit(cst);
  }
}
