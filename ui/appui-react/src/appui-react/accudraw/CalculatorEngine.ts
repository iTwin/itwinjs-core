/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

/** @internal */
export enum CalculatorOperator {  // eslint-disable-line: completed-docs
  None,
  Clear,
  ClearAll,
  Backspace,
  Add,
  Subtract,
  Multiply,
  Divide,
  NegPos,
  Decimal,
  Equals,
}

/** @internal */
export enum CalculatorKeyType {
  None,
  Operator,
  Equals,
}

/** @internal */
export class CalculatorEngine {
  private _displayValue: string = "0";
  private _operator?: CalculatorOperator;
  private _previousKeyType: CalculatorKeyType = CalculatorKeyType.None;
  private _firstValue: string = "";
  private _modValue: string = "";

  constructor() {
    this.clearAll();
  }

  public clearAll(): void {
    this._displayValue = "0";
    this._previousKeyType = CalculatorKeyType.None;
    this._firstValue = "";
    this._modValue = "";
    this._operator = undefined;
  }

  public get result(): number {
    return parseFloat(this._displayValue);
  }

  public get displayValue(): string {
    return this._displayValue;
  }

  public processValue(value: string): string {
    let resultString: string;

    if (
      this._displayValue === "0" ||
      this._previousKeyType === CalculatorKeyType.Operator ||
      this._previousKeyType === CalculatorKeyType.Equals
    ) {
      resultString = value;
    } else {
      resultString = this._displayValue + value;
    }

    this._displayValue = resultString;
    this._previousKeyType = CalculatorKeyType.None;

    return resultString;
  }

  public processOperator(operator: CalculatorOperator): string {
    const displayedNum = this._displayValue;
    const resultString = this._createResultString(operator, displayedNum);

    this._displayValue = resultString;

    this._updateCalculatorState(operator, resultString, displayedNum);

    return resultString;
  }

  private _createResultString = (operator: CalculatorOperator, displayedNum: string) => {
    let resultString = displayedNum;

    if (this._isMathOperator(operator)) {
      const firstValue = this._firstValue;
      const savedOperator = this._operator;

      resultString = (firstValue && savedOperator &&
        this._previousKeyType !== CalculatorKeyType.Operator && this._previousKeyType !== CalculatorKeyType.Equals)
        ? this._calculate(firstValue, savedOperator, displayedNum)
        : displayedNum;

    } else {
      switch (operator) {
        case CalculatorOperator.Clear:
          resultString = "0";
          break;

        case CalculatorOperator.ClearAll:
          resultString = "0";
          break;

        case CalculatorOperator.Backspace:
          resultString = resultString.slice(0, -1);
          if (resultString.length === 0)
            resultString = "0";
          break;

        case CalculatorOperator.Decimal:
          if (!resultString.includes("."))
            resultString = `${displayedNum}.`;
          else if (this._previousKeyType === CalculatorKeyType.Operator || this._previousKeyType === CalculatorKeyType.Equals)
            resultString = "0.";
          break;

        case CalculatorOperator.NegPos:
          if (displayedNum.length > 0 && displayedNum[0] === "-")
            resultString = displayedNum.substr(1);
          else
            resultString = `-${displayedNum}`;
          break;

        case CalculatorOperator.Equals: {
          const firstValue = this._firstValue;
          const savedOperator = this._operator;
          const modValue = this._modValue;

          if (firstValue && savedOperator) {
            resultString = this._previousKeyType === CalculatorKeyType.Equals
              ? this._calculate(displayedNum, savedOperator, modValue)
              : this._calculate(firstValue, savedOperator, displayedNum);
          } else {
            resultString = displayedNum;
          }
          break;
        }
      }
    }

    return resultString;
  };

  private _isMathOperator = (operator: CalculatorOperator): boolean => {
    switch (operator) {
      case CalculatorOperator.Add:
      case CalculatorOperator.Subtract:
      case CalculatorOperator.Multiply:
      case CalculatorOperator.Divide:
        return true;
    }
    return false;
  };

  private _calculate = (n1Str: string, operator: CalculatorOperator, n2Str: string): string => {
    let result = 0;
    const n1 = parseFloat(n1Str);
    const n2 = parseFloat(n2Str);

    switch (operator) {
      case CalculatorOperator.Add:
        result = n1 + n2;
        break;
      case CalculatorOperator.Subtract:
        result = n1 - n2;
        break;
      case CalculatorOperator.Multiply:
        result = n1 * n2;
        break;
      case CalculatorOperator.Divide:
        const displayValue = n2;
        if (displayValue !== 0)
          result = n1 / displayValue;
        else
          result = 0;
        break;
    }

    return result.toString();
  };

  private _updateCalculatorState = (operator: CalculatorOperator, resultString: string, displayedNum: string): void => {
    let keyType = CalculatorKeyType.None;

    if (this._isMathOperator(operator)) {
      if (this._firstValue && this._operator && this._previousKeyType === CalculatorKeyType.None) {
        this._firstValue = resultString;
      } else {
        this._firstValue = displayedNum;
      }

      this._operator = operator;
      keyType = CalculatorKeyType.Operator;

    } else {
      switch (operator) {
        case CalculatorOperator.ClearAll:
          this.clearAll();
          break;

        case CalculatorOperator.Equals: {
          let secondValue = displayedNum;

          if (this._firstValue) {
            if (this._previousKeyType === CalculatorKeyType.Equals) {
              secondValue = this._modValue;
            }
          }

          this._modValue = secondValue;

          keyType = CalculatorKeyType.Equals;
        }
      }
    }

    this._previousKeyType = keyType;
  };
}
