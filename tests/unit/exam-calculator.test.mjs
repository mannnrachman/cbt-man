import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  INITIAL_CALCULATOR_STATE,
  applyUnary,
  chooseOperator,
  equalsCalculator,
  inputDecimal,
  inputDigit,
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

test("calculator reports divide-by-zero and recovers on a new digit", () => {
  const error = binary("8", "/", "0");
  assert.equal(error.display, "Error");
  const recovered = inputDigit(error, "7");
  assert.deepEqual(recovered, { ...INITIAL_CALCULATOR_STATE, display: "7" });
});

test("calculator square root rejects invalid domains", () => {
  assert.equal(applyUnary(digits(INITIAL_CALCULATOR_STATE, "81"), "sqrt").display, "9");
  assert.equal(applyUnary(binary("0", "-", "1"), "sqrt").display, "Error");
});
