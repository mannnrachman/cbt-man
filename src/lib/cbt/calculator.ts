export type CalculatorOperator = "+" | "-" | "*" | "/";
export type CalculatorUnary = "sqrt" | "square" | "percent";

export type CalculatorState = {
  display: string;
  accumulator: number | null;
  operator: CalculatorOperator | null;
  replaceDisplay: boolean;
};

export const INITIAL_CALCULATOR_STATE: CalculatorState = {
  display: "0",
  accumulator: null,
  operator: null,
  replaceDisplay: false,
};

function finiteDisplay(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  return String(Number(value.toPrecision(12)));
}

function errorState(): CalculatorState {
  return {
    ...INITIAL_CALCULATOR_STATE,
    display: "Error",
    replaceDisplay: true,
  };
}

function calculate(left: number, operator: CalculatorOperator, right: number): number | null {
  if (operator === "/" && right === 0) return null;
  const value =
    operator === "+"
      ? left + right
      : operator === "-"
        ? left - right
        : operator === "*"
          ? left * right
          : left / right;
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
  if (!Number.isFinite(current)) return errorState();
  if (state.accumulator !== null && state.operator) {
    if (state.replaceDisplay) return { ...state, operator };
    const result = calculate(state.accumulator, state.operator, current);
    const display = result === null ? null : finiteDisplay(result);
    if (display === null) return errorState();
    return { display, accumulator: result, operator, replaceDisplay: true };
  }
  return { ...state, accumulator: current, operator, replaceDisplay: true };
}

export function equalsCalculator(state: CalculatorState): CalculatorState {
  if (state.display === "Error" || state.accumulator === null || !state.operator) return state;
  const result = calculate(state.accumulator, state.operator, Number(state.display));
  const display = result === null ? null : finiteDisplay(result);
  if (display === null) return errorState();
  return { display, accumulator: null, operator: null, replaceDisplay: true };
}

export function applyUnary(state: CalculatorState, operation: CalculatorUnary): CalculatorState {
  if (state.display === "Error") return state;
  const current = Number(state.display);
  const result =
    operation === "sqrt"
      ? current < 0
        ? null
        : Math.sqrt(current)
      : operation === "square"
        ? current * current
        : current / 100;
  const display = result === null ? null : finiteDisplay(result);
  if (display === null) return errorState();
  return { ...state, display, replaceDisplay: true };
}
