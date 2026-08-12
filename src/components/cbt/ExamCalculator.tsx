import { useState } from "react";
import {
  applyUnary,
  backspaceCalculator,
  type CalculatorOperator,
  type CalculatorUnary,
  chooseOperator,
  equalsCalculator,
  INITIAL_CALCULATOR_STATE,
  inputDecimal,
  inputDigit,
} from "@/lib/cbt/calculator";
import { cn } from "@/lib/utils";

export function ExamCalculator() {
  const [state, setState] = useState(INITIAL_CALCULATOR_STATE);

  const btnBase = "cursor-pointer flex items-center justify-center font-bold rounded-md shadow-sm border-b-[3px] active:border-b-0 active:translate-y-[3px] transition-all select-none focus:outline-none focus:ring-2 focus:ring-primary/50";
  const numBtn = cn(btnBase, "h-8 sm:h-9 bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200 text-sm");
  const opBtn = cn(btnBase, "h-8 sm:h-9 bg-indigo-500 text-white border-indigo-700 hover:bg-indigo-600 text-base");
  const funcBtn = cn(btnBase, "h-8 sm:h-9 bg-slate-700 text-slate-200 border-slate-900 hover:bg-slate-600 text-xs");
  const acBtn = cn(btnBase, "h-8 sm:h-9 bg-rose-500 text-white border-rose-700 hover:bg-rose-600 text-xs");
  const eqBtn = cn(btnBase, "h-8 sm:h-9 bg-emerald-500 text-white border-emerald-700 hover:bg-emerald-600 text-lg");

  const digit = (value: string) => setState((current) => inputDigit(current, value));
  const operator = (value: CalculatorOperator) =>
    setState((current) => chooseOperator(current, value));
  const unary = (value: CalculatorUnary) => setState((current) => applyUnary(current, value));

  const renderOperator = (op: CalculatorOperator | null) => {
    if (op === "*") return "×";
    if (op === "/") return "÷";
    if (op === "-") return "−";
    return op || "";
  };

  return (
    <div className="mx-auto flex w-full max-w-[380px] flex-col gap-2 sm:gap-3 rounded-2xl bg-slate-800 p-3 sm:p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_10px_15px_-3px_rgba(0,0,0,0.3)] border border-slate-700">

      {/* Brand/Logo Area */}
      <div className="flex justify-between items-center px-1 mb-1">
        <span className="text-xs font-black tracking-widest text-slate-400 italic">CBT-MAN</span>
        <span className="text-[10px] font-bold text-slate-500">SCIENTIFIC L-SCAPE</span>
      </div>

      {/* Screen */}
      <div className="bg-slate-900 p-1.5 rounded-xl border-b-2 border-slate-700 shadow-inner">
        <output
          aria-live="polite"
          aria-label="Hasil kalkulator"
          className="flex flex-col h-14 w-full items-end justify-between overflow-hidden rounded-md bg-[#b2c2a4] px-2 py-1 text-right font-mono tracking-tight text-slate-900 shadow-inner"
        >
          <div className="h-4 w-full text-[11px] text-slate-700/80 font-bold tracking-wider truncate">
            {state.accumulator !== null && state.operator ? `${state.accumulator} ${renderOperator(state.operator)}` : ""}
          </div>
          <span className="w-full truncate text-2xl font-medium leading-none">{state.display}</span>
        </output>
      </div>

      {/* Unified Keypad Grid (5 columns) */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mt-2">
        {/* Row 1 */}
        <button type="button" className={funcBtn} onClick={() => unary("sqrt")} aria-label="Akar kuadrat">√x</button>
        <button type="button" className={numBtn} onClick={() => digit("7")} aria-label="Tujuh">7</button>
        <button type="button" className={numBtn} onClick={() => digit("8")} aria-label="Delapan">8</button>
        <button type="button" className={numBtn} onClick={() => digit("9")} aria-label="Sembilan">9</button>
        <button type="button" className={opBtn} onClick={() => operator("/")} aria-label="Bagi">÷</button>

        {/* Row 2 */}
        <button type="button" className={funcBtn} onClick={() => unary("square")} aria-label="Kuadrat">x²</button>
        <button type="button" className={numBtn} onClick={() => digit("4")} aria-label="Empat">4</button>
        <button type="button" className={numBtn} onClick={() => digit("5")} aria-label="Lima">5</button>
        <button type="button" className={numBtn} onClick={() => digit("6")} aria-label="Enam">6</button>
        <button type="button" className={opBtn} onClick={() => operator("*")} aria-label="Kali">×</button>

        {/* Row 3 */}
        <button type="button" className={funcBtn} onClick={() => unary("percent")} aria-label="Persen">%</button>
        <button type="button" className={numBtn} onClick={() => digit("1")} aria-label="Satu">1</button>
        <button type="button" className={numBtn} onClick={() => digit("2")} aria-label="Dua">2</button>
        <button type="button" className={numBtn} onClick={() => digit("3")} aria-label="Tiga">3</button>
        <button type="button" className={opBtn} onClick={() => operator("-")} aria-label="Kurang">−</button>

        {/* Row 4 */}
        <button type="button" className={acBtn} onClick={() => setState(backspaceCalculator)} aria-label="Hapus digit">DEL</button>
        <button type="button" className={cn(numBtn, "col-span-2")} onClick={() => digit("0")} aria-label="Nol">0</button>
        <button type="button" className={numBtn} onClick={() => setState(inputDecimal)} aria-label="Desimal">.</button>
        <button type="button" className={opBtn} onClick={() => operator("+")} aria-label="Tambah">+</button>

        {/* Row 5 */}
        <button type="button" className={acBtn} onClick={() => setState(INITIAL_CALCULATOR_STATE)} aria-label="Bersihkan">AC</button>
        <button type="button" className={cn(eqBtn, "col-span-4")} onClick={() => setState(equalsCalculator)} aria-label="Sama dengan">=</button>
      </div>
    </div>
  );
}
