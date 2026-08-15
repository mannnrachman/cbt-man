import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  applyUnary,
  backspaceCalculator,
  chooseOperator,
  equalsCalculator,
  INITIAL_CALCULATOR_STATE,
  inputConstant,
  inputDecimal,
  inputDigit,
  memoryAdd,
  memoryClear,
  memoryRecall,
  memorySubtract,
  toggleDegMode,
} from "../../src/lib/cbt/calculator.ts";

function digits(state, value) {
  return [...value].reduce(
    (current, character) =>
      character === "." ? inputDecimal(current) : inputDigit(current, character),
    state,
  );
}

function binary(left, operator, right) {
  let state = digits(INITIAL_CALCULATOR_STATE, left);
  state = chooseOperator(state, operator);
  state = digits(state, right);
  return equalsCalculator(state);
}

test("calculator executes chained operations in entered sequence", () => {
  let state = digits(INITIAL_CALCULATOR_STATE, "2");
  state = chooseOperator(state, "+");
  state = digits(state, "3");
  state = chooseOperator(state, "*");
  state = digits(state, "4");
  assert.equal(equalsCalculator(state).display, "20");

  let replacement = digits(INITIAL_CALCULATOR_STATE, "8");
  replacement = chooseOperator(replacement, "+");
  replacement = chooseOperator(replacement, "*");
  replacement = digits(replacement, "2");
  assert.equal(equalsCalculator(replacement).display, "16");
});

test("calculator accepts one decimal point and calculates decimal input", () => {
  let state = digits(INITIAL_CALCULATOR_STATE, "1.5");
  state = inputDecimal(state);
  assert.equal(state.display, "1.5");
  assert.equal(binary("1.5", "+", "2.25").display, "3.75");
});

test("calculator reports divide-by-zero and modulo-by-zero, recovering on a new digit", () => {
  const error = binary("8", "/", "0");
  assert.equal(error.display, "Error");
  const recovered = inputDigit(error, "7");
  assert.deepEqual(recovered, { ...INITIAL_CALCULATOR_STATE, display: "7" });

  const modError = binary("10", "mod", "0");
  assert.equal(modError.display, "Error");
});

test("calculator handles power and modulo operations", () => {
  assert.equal(binary("2", "^", "3").display, "8");
  assert.equal(binary("5", "^", "0").display, "1");
  assert.equal(binary("14", "mod", "4").display, "2");
});

test("calculator square root and cube root reject invalid domains", () => {
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "81"), "sqrt").display, "9");
  assert.equal(applyUnary(binary("0", "-", "1"), "sqrt").display, "Error");
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "27"), "cbrt").display, "3");
});

test("calculator calculates powers, reciprocals, absolute value and negation", () => {
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "5"), "square").display, "25");
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "3"), "cube").display, "27");
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "4"), "inv").display, "0.25");
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "0"), "inv").display, "Error");
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "50"), "percent").display, "0.5");
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "42"), "negate").display, "-42");

  const negativeFortyTwo = applyUnary(digits(INITIAL_CALCULATOR_STATE, "42"), "negate");
  assert.equal(inputDigit(negativeFortyTwo, "3").display, "-423");
  assert.equal(applyUnary(negativeFortyTwo, "abs").display, "42");
});

test("calculator computes factorial with proper boundary handling", () => {
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "0"), "factorial").display, "1");
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "5"), "factorial").display, "120");

  const negThree = applyUnary(digits(INITIAL_CALCULATOR_STATE, "3"), "negate");
  assert.equal(applyUnary(negThree, "factorial").display, "Error");
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "2.5"), "factorial").display, "Error");
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "200"), "factorial").display, "Error");
});

test("calculator computes logarithms and exponential operations", () => {
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "100"), "log").display, "2");

  const negTen = applyUnary(digits(INITIAL_CALCULATOR_STATE, "10"), "negate");
  assert.equal(applyUnary(negTen, "log").display, "Error");
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "0"), "exp").display, "1");
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "2"), "pow10").display, "100");
});

test("calculator performs trigonometry in Degree and Radian modes", () => {
  // DEG mode (default)
  let degState = digits(INITIAL_CALCULATOR_STATE, "30");
  assert.equal(applyUnary(degState, "sin").display, "0.5");

  degState = digits(INITIAL_CALCULATOR_STATE, "60");
  assert.equal(applyUnary(degState, "cos").display, "0.5");

  degState = digits(INITIAL_CALCULATOR_STATE, "45");
  assert.equal(applyUnary(degState, "tan").display, "1");

  degState = digits(INITIAL_CALCULATOR_STATE, "0.5");
  assert.equal(applyUnary(degState, "asin").display, "30");

  degState = digits(INITIAL_CALCULATOR_STATE, "1");
  assert.equal(applyUnary(degState, "atan").display, "45");

  // RAD mode
  let radState = toggleDegMode(INITIAL_CALCULATOR_STATE);
  assert.equal(radState.degMode, false);
  radState = digits(radState, "0");
  assert.equal(applyUnary(radState, "sin").display, "0");
  assert.equal(applyUnary(radState, "cos").display, "1");
});

test("calculator inputs constants correctly", () => {
  const piState = inputConstant(INITIAL_CALCULATOR_STATE, "pi");
  assert.ok(piState.display.startsWith("3.14159265"));

  const eState = inputConstant(INITIAL_CALCULATOR_STATE, "e");
  assert.ok(eState.display.startsWith("2.71828182"));
});

test("calculator performs memory operations correctly", () => {
  let state = digits(INITIAL_CALCULATOR_STATE, "50");
  state = memoryAdd(state);
  assert.equal(state.memory, 50);

  state = digits(state, "20");
  state = memorySubtract(state);
  assert.equal(state.memory, 30);

  state = memoryRecall({ ...INITIAL_CALCULATOR_STATE, memory: 30 });
  assert.equal(state.display, "30");

  state = memoryClear(state);
  assert.equal(state.memory, 0);
});

test("calculator handles backspace correctly", () => {
  let state = digits(INITIAL_CALCULATOR_STATE, "123");
  state = backspaceCalculator(state);
  assert.equal(state.display, "12");
  state = backspaceCalculator(state);
  assert.equal(state.display, "1");
  state = backspaceCalculator(state);
  assert.equal(state.display, "0");
});
