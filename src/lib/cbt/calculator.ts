export type CalculatorOperator = "+" | "-" | "*" | "/" | "^" | "mod";
export type CalculatorUnary =
  | "sqrt"
  | "cbrt"
  | "square"
  | "cube"
  | "percent"
  | "sin"
  | "cos"
  | "tan"
  | "asin"
  | "acos"
  | "atan"
  | "log"
  | "ln"
  | "exp"
  | "pow10"
  | "inv"
  | "abs"
  | "factorial"
  | "negate";

export type CalculatorConstant = "pi" | "e";

export type CalculatorState = {
  display: string;
  accumulator: number | null;
  operator: CalculatorOperator | null;
  replaceDisplay: boolean;
  degMode: boolean; // true = DEG, false = RAD
  memory: number;
};

export const INITIAL_CALCULATOR_STATE: CalculatorState = {
  display: "0",
  accumulator: null,
  operator: null,
  replaceDisplay: false,
  degMode: true,
  memory: 0,
};

export function finiteDisplay(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  // Precision limit to prevent long floating point artifacts like 0.30000000000000004
  const formatted = String(Number(value.toPrecision(12)));
  return formatted;
}

function errorState(state: CalculatorState): CalculatorState {
  return {
    ...state,
    display: "Error",
    replaceDisplay: true,
  };
}

function factorial(n: number): number | null {
  if (n < 0 || !Number.isInteger(n) || n > 170) return null;
  if (n === 0 || n === 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

function calculate(left: number, operator: CalculatorOperator, right: number): number | null {
  if (operator === "/" && right === 0) return null;
  if (operator === "mod" && right === 0) return null;
  let value: number;
  switch (operator) {
    case "+":
      value = left + right;
      break;
    case "-":
      value = left - right;
      break;
    case "*":
      value = left * right;
      break;
    case "/":
      value = left / right;
      break;
    case "^":
      value = Math.pow(left, right);
      break;
    case "mod":
      value = left % right;
      break;
  }
  return Number.isFinite(value) ? value : null;
}

export function inputDigit(state: CalculatorState, digit: string): CalculatorState {
  if (!/^\d$/.test(digit)) return state;
  if (state.display === "Error" || state.replaceDisplay) {
    return {
      ...state,
      display: digit,
      accumulator: state.display === "Error" ? null : state.accumulator,
      operator: state.display === "Error" ? null : state.operator,
      replaceDisplay: false,
    };
  }
  return {
    ...state,
    display: state.display === "0" ? digit : `${state.display}${digit}`,
  };
}

export function inputDecimal(state: CalculatorState): CalculatorState {
  if (state.display === "Error" || state.replaceDisplay) {
    return {
      ...state,
      display: "0.",
      accumulator: state.display === "Error" ? null : state.accumulator,
      operator: state.display === "Error" ? null : state.operator,
      replaceDisplay: false,
    };
  }
  if (state.display.includes(".")) return state;
  return { ...state, display: `${state.display}.` };
}

export function backspaceCalculator(state: CalculatorState): CalculatorState {
  if (state.display === "Error" || state.replaceDisplay) {
    return { ...state, display: "0", replaceDisplay: false };
  }
  return {
    ...state,
    display: state.display.length === 1 ? "0" : state.display.slice(0, -1),
  };
}

export function chooseOperator(
  state: CalculatorState,
  operator: CalculatorOperator,
): CalculatorState {
  if (state.display === "Error") return state;
  const current = Number(state.display);
  if (!Number.isFinite(current)) return errorState(state);
  if (state.accumulator !== null && state.operator) {
    if (state.replaceDisplay) return { ...state, operator };
    const result = calculate(state.accumulator, state.operator, current);
    const display = result === null ? null : finiteDisplay(result);
    if (display === null) return errorState(state);
    return { ...state, display, accumulator: result, operator, replaceDisplay: true };
  }
  return { ...state, accumulator: current, operator, replaceDisplay: true };
}

export function equalsCalculator(state: CalculatorState): CalculatorState {
  if (state.display === "Error" || state.accumulator === null || !state.operator) return state;
  const result = calculate(state.accumulator, state.operator, Number(state.display));
  const display = result === null ? null : finiteDisplay(result);
  if (display === null) return errorState(state);
  return { ...state, display, accumulator: null, operator: null, replaceDisplay: true };
}

export function applyUnary(state: CalculatorState, operation: CalculatorUnary): CalculatorState {
  if (state.display === "Error") return state;
  const current = Number(state.display);
  if (!Number.isFinite(current)) return errorState(state);

  let result: number | null = null;
  const rad = state.degMode ? (current * Math.PI) / 180 : current;

  switch (operation) {
    case "sqrt":
      result = current < 0 ? null : Math.sqrt(current);
      break;
    case "cbrt":
      result = Math.cbrt(current);
      break;
    case "square":
      result = current * current;
      break;
    case "cube":
      result = current * current * current;
      break;
    case "percent":
      result = current / 100;
      break;
    case "sin": {
      result = Math.sin(rad);
      if (Math.abs(result) < 1e-15) result = 0;
      break;
    }
    case "cos": {
      result = Math.cos(rad);
      if (Math.abs(result) < 1e-15) result = 0;
      break;
    }
    case "tan": {
      const cosVal = Math.cos(rad);
      result = Math.abs(cosVal) < 1e-15 ? null : Math.tan(rad);
      if (result !== null && Math.abs(result) < 1e-15) result = 0;
      break;
    }
    case "asin": {
      if (current < -1 || current > 1) result = null;
      else {
        const val = Math.asin(current);
        result = state.degMode ? (val * 180) / Math.PI : val;
      }
      break;
    }
    case "acos": {
      if (current < -1 || current > 1) result = null;
      else {
        const val = Math.acos(current);
        result = state.degMode ? (val * 180) / Math.PI : val;
      }
      break;
    }
    case "atan": {
      const val = Math.atan(current);
      result = state.degMode ? (val * 180) / Math.PI : val;
      break;
    }
    case "log":
      result = current <= 0 ? null : Math.log10(current);
      break;
    case "ln":
      result = current <= 0 ? null : Math.log(current);
      break;
    case "exp":
      result = Math.exp(current);
      break;
    case "pow10":
      result = Math.pow(10, current);
      break;
    case "inv":
      result = current === 0 ? null : 1 / current;
      break;
    case "abs":
      result = Math.abs(current);
      break;
    case "factorial":
      result = factorial(current);
      break;
    case "negate":
      result = -current;
      break;
  }

  const display = result === null ? null : finiteDisplay(result);
  if (display === null) return errorState(state);
  return { ...state, display, replaceDisplay: operation === "negate" ? false : true };
}

export function inputConstant(state: CalculatorState, constant: CalculatorConstant): CalculatorState {
  const value = constant === "pi" ? Math.PI : Math.E;
  const display = finiteDisplay(value) ?? String(value);
  return {
    ...state,
    display,
    replaceDisplay: true,
  };
}

export function toggleDegMode(state: CalculatorState): CalculatorState {
  return { ...state, degMode: !state.degMode };
}

export function memoryAdd(state: CalculatorState): CalculatorState {
  const current = Number(state.display);
  if (!Number.isFinite(current)) return state;
  return { ...state, memory: state.memory + current, replaceDisplay: true };
}

export function memorySubtract(state: CalculatorState): CalculatorState {
  const current = Number(state.display);
  if (!Number.isFinite(current)) return state;
  return { ...state, memory: state.memory - current, replaceDisplay: true };
}

export function memoryRecall(state: CalculatorState): CalculatorState {
  const display = finiteDisplay(state.memory) ?? "0";
  return { ...state, display, replaceDisplay: true };
}

export function memoryClear(state: CalculatorState): CalculatorState {
  return { ...state, memory: 0 };
}
