import { useState } from "react";
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
  toggleAngleMode,
  type CalculatorOperator,
  type CalculatorUnary,
} from "@/lib/cbt/calculator";
import { cn } from "@/lib/utils";

export function ExamCalculator() {
  const [state, setState] = useState(INITIAL_CALCULATOR_STATE);
  const [showShift, setShowShift] = useState(false);

  const btnBase =
    "cursor-pointer flex items-center justify-center font-bold rounded shadow-sm border-b-[2px] active:border-b-0 active:translate-y-[2px] transition-all select-none focus:outline-none focus:ring-2 focus:ring-primary/50";
  const numBtn = cn(
    btnBase,
    "h-7 sm:h-8 bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200 text-xs sm:text-sm font-semibold",
  );
  const opBtn = cn(
    btnBase,
    "h-7 sm:h-8 bg-indigo-500 text-white border-indigo-700 hover:bg-indigo-600 text-sm sm:text-base",
  );
  const sciBtn = cn(
    btnBase,
    "h-6 sm:h-7 bg-slate-700 text-slate-200 border-slate-900 hover:bg-slate-600 text-[10px] sm:text-[11px] font-mono",
  );
  const memBtn = cn(
    btnBase,
    "h-6 sm:h-7 bg-slate-700 text-slate-200 border-slate-900 hover:bg-slate-600 text-[10px] sm:text-[11px] font-mono",
  );
  const acBtn = cn(
    btnBase,
    "h-7 sm:h-8 bg-rose-500 text-white border-rose-700 hover:bg-rose-600 text-[11px] font-bold",
  );
  const delBtn = cn(
    btnBase,
    "h-7 sm:h-8 bg-rose-500 text-white border-rose-700 hover:bg-rose-600 text-[11px] font-bold",
  );
  const eqBtn = cn(
    btnBase,
    "h-7 sm:h-8 bg-emerald-500 text-white border-emerald-700 hover:bg-emerald-600 text-base font-black",
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
    return op || "";
  };

  return (
    <div className="mx-auto flex w-full max-w-[320px] sm:max-w-[340px] flex-col gap-1.5 sm:gap-2 rounded-xl bg-slate-800 p-2.5 sm:p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_10px_15px_-3px_rgba(0,0,0,0.3)] border border-slate-700 text-slate-100">
      {/* Brand & Indicators */}
      <div className="flex justify-between items-center px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black tracking-widest text-slate-400 italic">
            CBT-MAN
          </span>
          <span className="text-[8px] px-1 py-0.5 rounded bg-slate-900 text-slate-500 font-mono">
            SCI
          </span>
        </div>
        <div className="flex items-center gap-1 text-[9px] font-mono">
          <button
            type="button"
            onClick={() => setState(toggleAngleMode)}
            className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700 font-bold hover:bg-slate-700 cursor-pointer transition-colors"
          >
            {state.angleMode.toUpperCase()}
          </button>
          {state.memory !== 0 && (
            <span className="px-1 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/50 font-bold">
              M
            </span>
          )}
        </div>
      </div>

      {/* Screen */}
      <div className="bg-slate-900 p-1 rounded-lg border-b-2 border-slate-700 shadow-inner">
        <output
          aria-live="polite"
          aria-label="Hasil kalkulator"
          className="flex flex-col h-11 w-full items-end justify-between overflow-hidden rounded bg-[#b2c2a4] px-2 py-0.5 text-right font-mono tracking-tight text-slate-900 shadow-inner"
        >
          <div className="h-3.5 w-full text-[10px] text-slate-700/80 font-bold tracking-wider truncate">
            {state.accumulator !== null && state.operator
              ? `${state.accumulator} ${renderOperator(state.operator)}`
              : ""}
          </div>
          <span className="w-full truncate text-lg sm:text-xl font-medium leading-none">{state.display}</span>
        </output>
      </div>

      {/* Function Toggle (Shift / 2nd) */}
      <div className="flex items-center justify-between gap-1 px-0.5">
        <button
          type="button"
          onClick={() => setShowShift(!showShift)}
          className={cn(
            "h-5 px-2 rounded text-[9px] font-bold transition-all cursor-pointer border",
            showShift
              ? "bg-amber-500 text-slate-950 border-amber-400 font-extrabold"
              : "bg-slate-700 text-slate-300 border-slate-600 hover:text-white",
          )}
        >
          2nd {showShift ? "ON" : ""}
        </button>
        <span className="text-[9px] text-slate-400 font-medium">
          {showShift ? "Invers / Sekunder" : "Scientific Standar"}
        </span>
      </div>

      {/* Scientific Keys Block (5 Columns) */}
      <div className="grid grid-cols-5 gap-1">
        {/* Memory Row */}
        <button type="button" className={memBtn} onClick={() => setState(memoryClear)}>
          MC
        </button>
        <button type="button" className={memBtn} onClick={() => setState(memoryRecall)}>
          MR
        </button>
        <button type="button" className={memBtn} onClick={() => setState(memoryAdd)}>
          M+
        </button>
        <button type="button" className={memBtn} onClick={() => setState(memorySubtract)}>
          M-
        </button>
        <button
          type="button"
          className={sciBtn}
          onClick={() => setState((s) => inputConstant(s, "pi"))}
        >
          π
        </button>

        {/* Scientific Row 1 */}
        {!showShift ? (
          <>
            <button type="button" className={sciBtn} onClick={() => unary("sin")}>
              sin
            </button>
            <button type="button" className={sciBtn} onClick={() => unary("cos")}>
              cos
            </button>
            <button type="button" className={sciBtn} onClick={() => unary("tan")}>
              tan
            </button>
            <button type="button" className={sciBtn} onClick={() => unary("log")}>
              log
            </button>
            <button type="button" className={sciBtn} onClick={() => unary("ln")}>
              ln
            </button>
          </>
        ) : (
          <>
            <button type="button" className={sciBtn} onClick={() => unary("asin")}>
              sin⁻¹
            </button>
            <button type="button" className={sciBtn} onClick={() => unary("acos")}>
              cos⁻¹
            </button>
            <button type="button" className={sciBtn} onClick={() => unary("atan")}>
              tan⁻¹
            </button>
            <button type="button" className={sciBtn} onClick={() => unary("exp")}>
              eˣ
            </button>
            <button
              type="button"
              className={sciBtn}
              onClick={() => setState((s) => inputConstant(s, "e"))}
            >
              e
            </button>
          </>
        )}

        {/* Scientific Row 2 */}
        {!showShift ? (
          <>
            <button type="button" className={sciBtn} onClick={() => unary("square")}>
              x²
            </button>
            <button type="button" className={sciBtn} onClick={() => operator("^")}>
              xʸ
            </button>
            <button type="button" className={sciBtn} onClick={() => unary("sqrt")}>
              √x
            </button>
            <button type="button" className={sciBtn} onClick={() => unary("reciprocal")}>
              1/x
            </button>
            <button type="button" className={sciBtn} onClick={() => unary("percent")}>
              %
            </button>
          </>
        ) : (
          <>
            <button type="button" className={sciBtn} onClick={() => unary("cube")}>
              x³
            </button>
            <button type="button" className={sciBtn} onClick={() => unary("factorial")}>
              n!
            </button>
            <button type="button" className={sciBtn} onClick={() => unary("negate")}>
              ±
            </button>
            <button type="button" className={sciBtn} onClick={() => unary("percent")}>
              %
            </button>
            <button
              type="button"
              className={sciBtn}
              onClick={() => setState((s) => inputConstant(s, "e"))}
            >
              e
            </button>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-700 my-0.5" />

      {/* Main Keypad Grid (5 columns) */}
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
        {/* Row 1 */}
        <button type="button" className={numBtn} onClick={() => digit("7")}>
          7
        </button>
        <button type="button" className={numBtn} onClick={() => digit("8")}>
          8
        </button>
        <button type="button" className={numBtn} onClick={() => digit("9")}>
          9
        </button>
        <button type="button" className={delBtn} onClick={() => setState(backspaceCalculator)}>
          DEL
        </button>
        <button
          type="button"
          className={acBtn}
          onClick={() => setState(INITIAL_CALCULATOR_STATE)}
        >
          AC
        </button>

        {/* Row 2 */}
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
        <button type="button" className={opBtn} onClick={() => operator("/")}>
          ÷
        </button>

        {/* Row 3 */}
        <button type="button" className={numBtn} onClick={() => digit("1")}>
          1
        </button>
        <button type="button" className={numBtn} onClick={() => digit("2")}>
          2
        </button>
        <button type="button" className={numBtn} onClick={() => digit("3")}>
          3
        </button>
        <button type="button" className={opBtn} onClick={() => operator("+")}>
          +
        </button>
        <button type="button" className={opBtn} onClick={() => operator("-")}>
          −
        </button>

        {/* Row 4 */}
        <button type="button" className={numBtn} onClick={() => digit("0")}>
          0
        </button>
        <button type="button" className={numBtn} onClick={() => setState(inputDecimal)}>
          .
        </button>
        <button type="button" className={numBtn} onClick={() => unary("negate")}>
          ±
        </button>
        <button type="button" className={cn(eqBtn, "col-span-2")} onClick={() => setState(equalsCalculator)}>
          =
        </button>
      </div>
    </div>
  );
}
