export type CalculatorOperator = "+" | "-" | "*" | "/" | "^";

export type CalculatorUnary =
  | "sqrt"
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
  | "reciprocal"
  | "negate"
  | "factorial";

export type AngleMode = "deg" | "rad";

export type CalculatorState = {
  display: string;
  accumulator: number | null;
  operator: CalculatorOperator | null;
  replaceDisplay: boolean;
  angleMode: AngleMode;
  memory: number;
};

export const INITIAL_CALCULATOR_STATE: CalculatorState = {
  display: "0",
  accumulator: null,
  operator: null,
  replaceDisplay: false,
  angleMode: "deg",
  memory: 0,
};

function finiteDisplay(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  // Fix precision floating point issues e.g. sin(180 deg)
  const prec = Number(value.toPrecision(12));
  if (Math.abs(prec) < 1e-12) return "0";
  return String(prec);
}

function errorState(state?: CalculatorState): CalculatorState {
  return {
    ...INITIAL_CALCULATOR_STATE,
    angleMode: state?.angleMode ?? "deg",
    memory: state?.memory ?? 0,
    display: "Error",
    replaceDisplay: true,
  };
}

function calcFactorial(n: number): number | null {
  if (n < 0 || !Number.isInteger(n) || n > 170) return null;
  if (n === 0 || n === 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) {
    res *= i;
  }
  return res;
}

function calculate(left: number, operator: CalculatorOperator, right: number): number | null {
  if (operator === "/" && right === 0) return null;
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
    default:
      return null;
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
  if (state.display === "Error" || state.replaceDisplay) return INITIAL_CALCULATOR_STATE;
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

  const isDeg = state.angleMode === "deg";
  let result: number | null = null;

  switch (operation) {
    case "sqrt":
      result = current < 0 ? null : Math.sqrt(current);
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
    case "sin":
      result = isDeg ? Math.sin((current * Math.PI) / 180) : Math.sin(current);
      break;
    case "cos":
      result = isDeg ? Math.cos((current * Math.PI) / 180) : Math.cos(current);
      break;
    case "tan":
      result = isDeg ? Math.tan((current * Math.PI) / 180) : Math.tan(current);
      break;
    case "asin":
      result =
        current < -1 || current > 1
          ? null
          : isDeg
            ? (Math.asin(current) * 180) / Math.PI
            : Math.asin(current);
      break;
    case "acos":
      result =
        current < -1 || current > 1
          ? null
          : isDeg
            ? (Math.acos(current) * 180) / Math.PI
            : Math.acos(current);
      break;
    case "atan":
      result = isDeg ? (Math.atan(current) * 180) / Math.PI : Math.atan(current);
      break;
    case "log":
      result = current <= 0 ? null : Math.log10(current);
      break;
    case "ln":
      result = current <= 0 ? null : Math.log(current);
      break;
    case "exp":
      result = Math.exp(current);
      break;
    case "reciprocal":
      result = current === 0 ? null : 1 / current;
      break;
    case "negate":
      result = -current;
      break;
    case "factorial":
      result = calcFactorial(current);
      break;
  }

  const display = result === null ? null : finiteDisplay(result);
  if (display === null) return errorState(state);
  return { ...state, display, replaceDisplay: true };
}

export function inputConstant(state: CalculatorState, constant: "pi" | "e"): CalculatorState {
  const value = constant === "pi" ? Math.PI : Math.E;
  const display = finiteDisplay(value) ?? String(value);
  return { ...state, display, replaceDisplay: true };
}

export function toggleAngleMode(state: CalculatorState): CalculatorState {
  return {
    ...state,
    angleMode: state.angleMode === "deg" ? "rad" : "deg",
  };
}

export function memoryClear(state: CalculatorState): CalculatorState {
  return { ...state, memory: 0 };
}

export function memoryRecall(state: CalculatorState): CalculatorState {
  return { ...state, display: finiteDisplay(state.memory) ?? "0", replaceDisplay: true };
}

export function memoryAdd(state: CalculatorState): CalculatorState {
  if (state.display === "Error") return state;
  const val = Number(state.display);
  if (!Number.isFinite(val)) return state;
  return { ...state, memory: state.memory + val, replaceDisplay: true };
}

export function memorySubtract(state: CalculatorState): CalculatorState {
  if (state.display === "Error") return state;
  const val = Number(state.display);
  if (!Number.isFinite(val)) return state;
  return { ...state, memory: state.memory - val, replaceDisplay: true };
}
