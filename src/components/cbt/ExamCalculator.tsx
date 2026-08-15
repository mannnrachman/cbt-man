import { Delete } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  applyUnary,
  backspaceCalculator,
  type CalculatorConstant,
  type CalculatorOperator,
  type CalculatorUnary,
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
} from "@/lib/cbt/calculator";
import { cn } from "@/lib/utils";

export function ExamCalculator() {
  const [state, setState] = useState(INITIAL_CALCULATOR_STATE);
  const [showShift, setShowShift] = useState(false);

  const digit = (value: string) => setState((current) => inputDigit(current, value));
  const operator = (value: CalculatorOperator) =>
    setState((current) => chooseOperator(current, value));
  const unary = (value: CalculatorUnary) => setState((current) => applyUnary(current, value));
  const constant = (value: CalculatorConstant) =>
    setState((current) => inputConstant(current, value));

  const renderOperator = (op: CalculatorOperator | null) => {
    if (!op) return "";
    switch (op) {
      case "+":
        return "+";
      case "-":
        return "−";
      case "*":
        return "×";
      case "/":
        return "÷";
      case "^":
        return "^";
      case "mod":
        return "mod";
    }
  };

  const sciBtn =
    "h-8 px-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors";
  const memBtn =
    "h-8 px-1 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-300 transition-colors";
  const numBtn = "h-10 text-sm font-semibold transition-colors";
  const opBtn =
    "h-10 text-sm font-semibold bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60 transition-colors";
  const delBtn =
    "h-10 text-xs font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 transition-colors";
  const acBtn =
    "h-10 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 font-bold transition-colors";
  const eqBtn = "h-10 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-2.5 rounded-xl border bg-card p-3 shadow-sm select-none">
      {/* Top Bar: Mode Indicator & Memory Indicator */}
      <div className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px] font-bold"
            onClick={() => setState(toggleDegMode)}
            aria-label={`Ubah ke mode ${state.degMode ? "Radian" : "Derajat"}`}
          >
            {state.degMode ? "DEG" : "RAD"}
          </Button>
          <Button
            type="button"
            variant={showShift ? "default" : "outline"}
            size="sm"
            className="h-6 px-2 text-[11px] font-bold"
            onClick={() => setShowShift((prev) => !prev)}
            aria-label="Fungsi sekunder 2nd"
          >
            2nd {showShift ? "ON" : ""}
          </Button>
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          {state.memory !== 0 && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              M
            </span>
          )}
          <span>{state.degMode ? "Degree" : "Radian"}</span>
        </div>
      </div>

      {/* Screen / Display */}
      <output
        aria-live="polite"
        aria-label="Hasil kalkulator"
        className="flex h-20 flex-col items-end justify-between overflow-hidden rounded-lg bg-slate-900 p-3 text-right font-mono text-white dark:bg-slate-950"
      >
        <div className="h-4 w-full truncate text-xs text-slate-400">
          {state.accumulator !== null && state.operator
            ? `${state.accumulator} ${renderOperator(state.operator)}`
            : ""}
        </div>
        <span className="w-full truncate text-2xl font-semibold tracking-wider">
          {state.display}
        </span>
      </output>

      {/* Scientific Keys (5 columns) */}
      <div className="grid grid-cols-5 gap-1">
        {/* Memory Row */}
        <Button
          type="button"
          variant="secondary"
          className={memBtn}
          onClick={() => setState(memoryClear)}
          aria-label="Bersihkan memori"
        >
          MC
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={memBtn}
          onClick={() => setState(memoryRecall)}
          aria-label="Panggil memori"
        >
          MR
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={memBtn}
          onClick={() => setState(memoryAdd)}
          aria-label="Tambah ke memori"
        >
          M+
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={memBtn}
          onClick={() => setState(memorySubtract)}
          aria-label="Kurang dari memori"
        >
          M-
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={sciBtn}
          onClick={() => constant("pi")}
          aria-label="Konstanta Pi"
        >
          π
        </Button>

        {/* Scientific Row 1 */}
        {!showShift ? (
          <>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("sin")}
              aria-label="Sinus"
            >
              sin
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("cos")}
              aria-label="Cosinus"
            >
              cos
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("tan")}
              aria-label="Tangen"
            >
              tan
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("log")}
              aria-label="Logaritma basis 10"
            >
              log
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("ln")}
              aria-label="Logaritma natural"
            >
              ln
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("asin")}
              aria-label="Arc sinus"
            >
              sin⁻¹
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("acos")}
              aria-label="Arc cosinus"
            >
              cos⁻¹
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("atan")}
              aria-label="Arc tangen"
            >
              tan⁻¹
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("exp")}
              aria-label="Eksponensial e^x"
            >
              eˣ
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => constant("e")}
              aria-label="Konstanta Euler e"
            >
              e
            </Button>
          </>
        )}

        {/* Scientific Row 2 */}
        {!showShift ? (
          <>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("square")}
              aria-label="Pangkat dua"
            >
              x²
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => operator("^")}
              aria-label="Pangkat y"
            >
              xʸ
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("sqrt")}
              aria-label="Akar kuadrat"
            >
              √x
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("inv")}
              aria-label="Kebalikan satu per x"
            >
              1/x
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("percent")}
              aria-label="Persen"
            >
              %
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("cube")}
              aria-label="Pangkat tiga"
            >
              x³
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("cbrt")}
              aria-label="Akar pangkat tiga"
            >
              ∛x
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("factorial")}
              aria-label="Faktorial"
            >
              n!
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => unary("abs")}
              aria-label="Nilai mutlak"
            >
              |x|
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={sciBtn}
              onClick={() => operator("mod")}
              aria-label="Sisa bagi modulo"
            >
              mod
            </Button>
          </>
        )}
      </div>

      {/* Main Keypad Grid (5 columns) */}
      <div className="grid grid-cols-5 gap-1">
        {/* Row 1 */}
        <Button
          type="button"
          variant="secondary"
          className={numBtn}
          onClick={() => digit("7")}
          aria-label="Tujuh"
        >
          7
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={numBtn}
          onClick={() => digit("8")}
          aria-label="Delapan"
        >
          8
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={numBtn}
          onClick={() => digit("9")}
          aria-label="Sembilan"
        >
          9
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={delBtn}
          onClick={() => setState(backspaceCalculator)}
          aria-label="Hapus satu digit"
        >
          <Delete className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={acBtn}
          onClick={() => setState(INITIAL_CALCULATOR_STATE)}
          aria-label="Bersihkan semua"
        >
          AC
        </Button>

        {/* Row 2 */}
        <Button
          type="button"
          variant="secondary"
          className={numBtn}
          onClick={() => digit("4")}
          aria-label="Empat"
        >
          4
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={numBtn}
          onClick={() => digit("5")}
          aria-label="Lima"
        >
          5
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={numBtn}
          onClick={() => digit("6")}
          aria-label="Enam"
        >
          6
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={opBtn}
          onClick={() => operator("*")}
          aria-label="Kali"
        >
          ×
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={opBtn}
          onClick={() => operator("/")}
          aria-label="Bagi"
        >
          ÷
        </Button>

        {/* Row 3 */}
        <Button
          type="button"
          variant="secondary"
          className={numBtn}
          onClick={() => digit("1")}
          aria-label="Satu"
        >
          1
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={numBtn}
          onClick={() => digit("2")}
          aria-label="Dua"
        >
          2
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={numBtn}
          onClick={() => digit("3")}
          aria-label="Tiga"
        >
          3
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={opBtn}
          onClick={() => operator("+")}
          aria-label="Tambah"
        >
          +
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={opBtn}
          onClick={() => operator("-")}
          aria-label="Kurang"
        >
          −
        </Button>

        {/* Row 4 */}
        <Button
          type="button"
          variant="secondary"
          className={numBtn}
          onClick={() => digit("0")}
          aria-label="Nol"
        >
          0
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={numBtn}
          onClick={() => setState(inputDecimal)}
          aria-label="Koma desimal"
        >
          .
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={numBtn}
          onClick={() => unary("negate")}
          aria-label="Ubah tanda positif negatif"
        >
          ±
        </Button>
        <Button
          type="button"
          className={cn(eqBtn, "col-span-2")}
          onClick={() => setState(equalsCalculator)}
          aria-label="Hitung hasil sama dengan"
        >
          =
        </Button>
      </div>
    </div>
  );
}
