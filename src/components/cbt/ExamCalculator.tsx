import { Delete } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  const baseClass = "h-10 text-sm font-semibold";
  const operatorClass = cn(
    baseClass,
    "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300",
  );

  const digit = (value: string) => setState((current) => inputDigit(current, value));
  const operator = (value: CalculatorOperator) =>
    setState((current) => chooseOperator(current, value));
  const unary = (value: CalculatorUnary) => setState((current) => applyUnary(current, value));

  return (
    <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
      <output
        aria-live="polite"
        aria-label="Hasil kalkulator"
        className="flex h-20 items-end justify-end overflow-hidden rounded-lg bg-slate-900 p-3 text-right font-mono text-2xl tracking-wider text-white"
      >
        <span className="w-full truncate">{state.display}</span>
      </output>

      <div className="grid grid-cols-3 gap-1.5">
        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => unary("sqrt")}
          aria-label="Akar kuadrat"
        >
          √x
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => unary("square")}
          aria-label="Kuadrat"
        >
          x²
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => unary("percent")}
          aria-label="Persen"
        >
          %
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <Button
          type="button"
          variant="secondary"
          className={cn(baseClass, "text-red-600")}
          onClick={() => setState(INITIAL_CALCULATOR_STATE)}
          aria-label="Bersihkan kalkulator"
        >
          AC
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => setState(backspaceCalculator)}
          aria-label="Hapus digit"
        >
          <Delete className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={operatorClass}
          onClick={() => operator("/")}
          aria-label="Bagi"
        >
          ÷
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={operatorClass}
          onClick={() => operator("*")}
          aria-label="Kali"
        >
          ×
        </Button>

        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => digit("7")}
          aria-label="Tujuh"
        >
          7
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => digit("8")}
          aria-label="Delapan"
        >
          8
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => digit("9")}
          aria-label="Sembilan"
        >
          9
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={operatorClass}
          onClick={() => operator("-")}
          aria-label="Kurang"
        >
          −
        </Button>

        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => digit("4")}
          aria-label="Empat"
        >
          4
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => digit("5")}
          aria-label="Lima"
        >
          5
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => digit("6")}
          aria-label="Enam"
        >
          6
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={operatorClass}
          onClick={() => operator("+")}
          aria-label="Tambah"
        >
          +
        </Button>

        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => digit("1")}
          aria-label="Satu"
        >
          1
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => digit("2")}
          aria-label="Dua"
        >
          2
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => digit("3")}
          aria-label="Tiga"
        >
          3
        </Button>
        <Button
          type="button"
          className="row-span-2 h-full font-bold"
          onClick={() => setState(equalsCalculator)}
          aria-label="Hitung hasil"
        >
          =
        </Button>

        <Button
          type="button"
          variant="secondary"
          className={cn(baseClass, "col-span-2")}
          onClick={() => digit("0")}
          aria-label="Nol"
        >
          0
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={baseClass}
          onClick={() => setState(inputDecimal)}
          aria-label="Desimal"
        >
          .
        </Button>
      </div>
    </div>
  );
}
