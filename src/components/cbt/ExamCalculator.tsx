import { useState } from "react";
import {
  applyUnary,
  backspaceCalculator,
  type CalculatorOperator,
  type CalculatorUnary,
  chooseOperator,
  equalsCalculator,
  INITIAL_CALCULATOR_STATE,
  inputConstant,
  inputDecimal,
  inputDigit,
  toggleDegMode,
} from "@/lib/cbt/calculator";
import { cn } from "@/lib/utils";

export function ExamCalculator() {
  const [state, setState] = useState(INITIAL_CALCULATOR_STATE);
  const [shift, setShift] = useState(false); // 2nd function mode for inverse trig & extra functions

  const btnBase =
    "cursor-pointer flex items-center justify-center font-bold rounded-lg shadow-sm border-b-[2px] active:border-b-0 active:translate-y-[2px] transition-all select-none focus:outline-none focus:ring-1 focus:ring-primary/50 text-xs sm:text-sm";
  const numBtn = cn(
    btnBase,
    "h-9 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold"
  );
  const opBtn = cn(
    btnBase,
    "h-9 bg-indigo-600 text-white border-indigo-800 hover:bg-indigo-700 font-bold"
  );
  const sciBtn = cn(
    btnBase,
    "h-9 bg-slate-700 text-slate-100 border-slate-900 hover:bg-slate-600 font-medium text-[11px] sm:text-xs"
  );
  const shiftActiveBtn = cn(
    btnBase,
    "h-9 bg-amber-500 text-slate-950 border-amber-700 hover:bg-amber-400 font-bold text-xs"
  );
  const acBtn = cn(
    btnBase,
    "h-9 bg-rose-500 text-white border-rose-700 hover:bg-rose-600 font-bold text-xs"
  );
  const eqBtn = cn(
    btnBase,
    "h-9 bg-emerald-600 text-white border-emerald-800 hover:bg-emerald-700 font-bold text-base"
  );

  const digit = (value: string) => setState((current) => inputDigit(current, value));
  const operator = (value: CalculatorOperator) =>
    setState((current) => chooseOperator(current, value));
  const unary = (value: CalculatorUnary) => setState((current) => applyUnary(current, value));

  const renderOperator = (op: CalculatorOperator | null) => {
    if (op === "*") return "×";
    if (op === "/") return "÷";
    if (op === "-") return "−";
    if (op === "^") return "^";
    if (op === "mod") return "mod";
    return op || "";
  };

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-2.5 rounded-2xl bg-slate-900 p-3 sm:p-4 shadow-xl border border-slate-800 text-slate-100">
      
      {/* Brand & Mode Header */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black tracking-widest text-emerald-400">SCIENTIFIC</span>
          <button
            type="button"
            onClick={() => setState(toggleDegMode)}
            className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            {state.degMode ? "DEG" : "RAD"}
          </button>
        </div>
        <span className="text-[10px] font-semibold text-slate-400">CBT-MAN PRO</span>
      </div>

      {/* Calculator Display */}
      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 shadow-inner">
        <output
          aria-live="polite"
          aria-label="Hasil kalkulator"
          className="flex flex-col h-14 w-full items-end justify-between overflow-hidden rounded-lg bg-[#9ab592] dark:bg-[#7e9976] px-3 py-1 text-right font-mono tracking-tight text-slate-950 shadow-inner"
        >
          <div className="flex items-center justify-between w-full text-[10px] text-slate-800/80 font-bold tracking-wider">
            <span>{state.degMode ? "DEG" : "RAD"}</span>
            <span className="truncate">
              {state.accumulator !== null && state.operator
                ? `${state.accumulator} ${renderOperator(state.operator)}`
                : ""}
            </span>
          </div>
          <span className="w-full truncate text-2xl font-bold leading-none">{state.display}</span>
        </output>
      </div>

      {/* Grid Keypad */}
      <div className="grid grid-cols-5 gap-1.5 mt-1">
        
        {/* Row 1: Function Controls */}
        <button
          type="button"
          className={shift ? shiftActiveBtn : sciBtn}
          onClick={() => setShift(!shift)}
          title="2nd / Mode Tambahan"
        >
          2nd
        </button>
        <button
          type="button"
          className={sciBtn}
          onClick={() => unary(shift ? "asin" : "sin")}
        >
          {shift ? "sin⁻¹" : "sin"}
        </button>
        <button
          type="button"
          className={sciBtn}
          onClick={() => unary(shift ? "acos" : "cos")}
        >
          {shift ? "cos⁻¹" : "cos"}
        </button>
        <button
          type="button"
          className={sciBtn}
          onClick={() => unary(shift ? "atan" : "tan")}
        >
          {shift ? "tan⁻¹" : "tan"}
        </button>
        <button
          type="button"
          className={acBtn}
          onClick={() => setState(INITIAL_CALCULATOR_STATE)}
        >
          AC
        </button>

        {/* Row 2: Scientific Functions */}
        <button
          type="button"
          className={sciBtn}
          onClick={() => unary(shift ? "pow10" : "log")}
        >
          {shift ? "10ˣ" : "log"}
        </button>
        <button
          type="button"
          className={sciBtn}
          onClick={() => unary(shift ? "exp" : "ln")}
        >
          {shift ? "eˣ" : "ln"}
        </button>
        <button
          type="button"
          className={sciBtn}
          onClick={() => unary(shift ? "cube" : "square")}
        >
          {shift ? "x³" : "x²"}
        </button>
        <button
          type="button"
          className={sciBtn}
          onClick={() => operator("^")}
        >
          xʸ
        </button>
        <button
          type="button"
          className={acBtn}
          onClick={() => setState(backspaceCalculator)}
        >
          DEL
        </button>

        {/* Row 3: Roots, Reciprocals, Numbers */}
        <button
          type="button"
          className={sciBtn}
          onClick={() => unary(shift ? "cbrt" : "sqrt")}
        >
          {shift ? "∛x" : "√x"}
        </button>
        <button type="button" className={numBtn} onClick={() => digit("7")}>
          7
        </button>
        <button type="button" className={numBtn} onClick={() => digit("8")}>
          8
        </button>
        <button type="button" className={numBtn} onClick={() => digit("9")}>
          9
        </button>
        <button type="button" className={opBtn} onClick={() => operator("/")}>
          ÷
        </button>

        {/* Row 4: Percent, Factorial, Numbers */}
        <button
          type="button"
          className={sciBtn}
          onClick={() => unary(shift ? "factorial" : "percent")}
        >
          {shift ? "n!" : "%"}
        </button>
        <button type="button" className={numBtn} onClick={() => digit("4")}>
          4
        </button>
        <button type="button" className={numBtn} onClick={() => digit("5")}>
          5
        </button>
        <button type="button" className={numBtn} onClick={() => digit("6")}>
          6
        </button>
        <button type="button" className={opBtn} onClick={() => operator("*")}>
          ×
        </button>

        {/* Row 5: Constants & Numbers */}
        <button
          type="button"
          className={sciBtn}
          onClick={() => setState((cur) => inputConstant(cur, "pi"))}
        >
          π
        </button>
        <button type="button" className={numBtn} onClick={() => digit("1")}>
          1
        </button>
        <button type="button" className={numBtn} onClick={() => digit("2")}>
          2
        </button>
        <button type="button" className={numBtn} onClick={() => digit("3")}>
          3
        </button>
        <button type="button" className={opBtn} onClick={() => operator("-")}>
          −
        </button>

        {/* Row 6: e Constant, 0, Decimal, Equals, Plus */}
        <button
          type="button"
          className={sciBtn}
          onClick={() => unary(shift ? "abs" : "inv")}
        >
          {shift ? "|x|" : "1/x"}
        </button>
        <button type="button" className={numBtn} onClick={() => digit("0")}>
          0
        </button>
        <button type="button" className={numBtn} onClick={() => setState(inputDecimal)}>
          .
        </button>
        <button type="button" className={sciBtn} onClick={() => unary("negate")}>
          ±
        </button>
        <button type="button" className={opBtn} onClick={() => operator("+")}>
          +
        </button>

      </div>

      {/* Equal Row */}
      <button
        type="button"
        className={cn(eqBtn, "w-full mt-1 h-10 text-lg")}
        onClick={() => setState(equalsCalculator)}
      >
        =
      </button>

    </div>
  );
}
