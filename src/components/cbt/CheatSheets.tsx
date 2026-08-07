import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Delete, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// --- DATA NILAI NORMAL KESEHATAN (HARDCODED UNTUK MEDIS) ---
const NORMAL_VALUES = {
  'Tanda Vital': [
    { parameter: 'Tekanan Darah (Sistolik)', range: '90 - 120', unit: 'mmHg' },
    { parameter: 'Tekanan Darah (Diastolik)', range: '60 - 80', unit: 'mmHg' },
    { parameter: 'Detak Jantung (Nadi)', range: '60 - 100', unit: 'x/menit' },
    { parameter: 'Laju Pernapasan (RR)', range: '12 - 20', unit: 'x/menit' },
    { parameter: 'Suhu Tubuh', range: '36.5 - 37.2', unit: '°C' },
    { parameter: 'Saturasi Oksigen (SpO2)', range: '95 - 100', unit: '%' },
  ],
  'Hematologi': [
    { parameter: 'Hemoglobin (Pria)', range: '13.8 - 17.2', unit: 'g/dL' },
    { parameter: 'Hemoglobin (Wanita)', range: '12.1 - 15.1', unit: 'g/dL' },
    { parameter: 'Leukosit (WBC)', range: '4.5 - 11.0', unit: '10^3/µL' },
    { parameter: 'Trombosit (Platelet)', range: '150 - 450', unit: '10^3/µL' },
    { parameter: 'Hematokrit (Pria)', range: '40.7 - 50.3', unit: '%' },
    { parameter: 'Hematokrit (Wanita)', range: '36.1 - 44.3', unit: '%' },
  ],
  'Kimia Klinik': [
    { parameter: 'Gula Darah Puasa (GDP)', range: '70 - 99', unit: 'mg/dL' },
    { parameter: 'Gula Darah 2 Jam PP', range: '< 140', unit: 'mg/dL' },
    { parameter: 'Gula Darah Sewaktu (GDS)', range: '< 200', unit: 'mg/dL' },
    { parameter: 'Kolesterol Total', range: '< 200', unit: 'mg/dL' },
    { parameter: 'Trigliserida', range: '< 150', unit: 'mg/dL' },
    { parameter: 'Asam Urat (Pria)', range: '3.4 - 7.0', unit: 'mg/dL' },
    { parameter: 'Asam Urat (Wanita)', range: '2.4 - 6.0', unit: 'mg/dL' },
  ],
};

export function NormalValuesTable() {
  return (
    <Tabs defaultValue="Tanda Vital" className="w-full">
      <TabsList className="w-full flex overflow-x-auto h-auto p-1 mb-2">
        {Object.keys(NORMAL_VALUES).map((cat) => (
          <TabsTrigger key={cat} value={cat} className="flex-1 text-xs py-2 px-2 whitespace-nowrap">
            {cat}
          </TabsTrigger>
        ))}
      </TabsList>
      {Object.entries(NORMAL_VALUES).map(([cat, items]) => (
        <TabsContent key={cat} value={cat} className="mt-0">
          <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900">
                <TableRow>
                  <TableHead className="text-xs h-8">Parameter</TableHead>
                  <TableHead className="text-xs h-8">Normal</TableHead>
                  <TableHead className="text-xs h-8">Satuan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="py-2 text-xs font-medium">{item.parameter}</TableCell>
                    <TableCell className="py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{item.range}</TableCell>
                    <TableCell className="py-2 text-xs text-slate-500">{item.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function evaluateMathExpression(expr: string): number {
  const sanitized = expr.replace(/÷/g, "/").replace(/×/g, "*").replace(/−/g, "-");
  if (!/^[0-9\s.+\-*/%()]+$/.test(sanitized)) {
    throw new Error("Invalid math expression");
  }

  const expanded = sanitized.replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");
  const tokens = expanded.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
  if (!tokens) throw new Error("No tokens");

  let pos = 0;

  function parsePrimary(): number {
    if (pos >= tokens!.length) throw new Error("Unexpected end");
    const token = tokens![pos++];
    if (token === "(") {
      const val = parseExpr();
      if (tokens![pos++] !== ")") throw new Error("Missing closing paren");
      return val;
    }
    const num = parseFloat(token);
    if (isNaN(num)) throw new Error("Invalid number: " + token);
    return num;
  }

  function parseMultiplicative(): number {
    let left = parsePrimary();
    while (pos < tokens!.length && (tokens![pos] === "*" || tokens![pos] === "/")) {
      const op = tokens![pos++];
      const right = parsePrimary();
      left = op === "*" ? left * right : (right !== 0 ? left / right : NaN);
    }
    return left;
  }

  function parseExpr(): number {
    let left = parseMultiplicative();
    while (pos < tokens!.length && (tokens![pos] === "+" || tokens![pos] === "-")) {
      const op = tokens![pos++];
      const right = parseMultiplicative();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  const result = parseExpr();
  if (isNaN(result) || !isFinite(result)) throw new Error("Math error");
  return result;
}

// --- KALKULATOR ILMIAH ---
export function ScientificCalculator() {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [isRad, setIsRad] = useState(true);

  const handlePress = (val: string) => {
    if (display === 'Error') setDisplay(val);
    else if (display === '0' && val !== '.') setDisplay(val);
    else setDisplay(display + val);
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
  };

  const handleDelete = () => {
    if (display === 'Error' || display.length === 1) setDisplay('0');
    else setDisplay(display.slice(0, -1));
  };

  const calculate = () => {
    try {
      const evalResult = evaluateMathExpression(display);
      setEquation(display + ' =');
      setDisplay(String(Math.round(evalResult * 1000000) / 1000000));
    } catch (err) {
      setDisplay('Error');
    }
  };

  const advancedOp = (op: string) => {
    try {
      const current = parseFloat(display);
      let res = 0;
      switch (op) {
        case 'sin': res = isRad ? Math.sin(current) : Math.sin(current * Math.PI / 180); break;
        case 'cos': res = isRad ? Math.cos(current) : Math.cos(current * Math.PI / 180); break;
        case 'tan': res = isRad ? Math.tan(current) : Math.tan(current * Math.PI / 180); break;
        case 'log': res = Math.log10(current); break;
        case 'ln': res = Math.log(current); break;
        case 'sqrt': res = Math.sqrt(current); break;
        case 'sq': res = Math.pow(current, 2); break;
        case 'inv': res = 1 / current; break;
        case 'fact': 
          res = 1; 
          for (let i = 2; i <= Math.abs(Math.floor(current)); i++) res *= i;
          if (current < 0) res = NaN;
          break;
      }
      setEquation(`${op}(${display}) =`);
      setDisplay(String(Math.round(res * 1000000) / 1000000));
    } catch (e) {
      setDisplay('Error');
    }
  };

  // Google Calculator styling
  const btnClass = "h-9 sm:h-10 text-[13px] font-medium active:scale-95 transition-transform bg-[#f1f3f4] hover:bg-[#e8eaed] text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 rounded-md border-none p-0";
  const numClass = "h-9 sm:h-10 text-[13px] font-medium active:scale-95 transition-transform bg-[#f1f3f4] hover:bg-[#e8eaed] text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 rounded-md border-none p-0";
  const opClass = "h-9 sm:h-10 text-[13px] font-medium active:scale-95 transition-transform bg-[#f1f3f4] hover:bg-[#e8eaed] text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-md border-none p-0";
  const equalsClass = "h-9 sm:h-10 text-[13px] font-medium active:scale-95 transition-transform bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-md border-none p-0 shadow-sm";

  return (
    <div className="flex flex-col w-full max-w-[480px] mx-auto bg-white dark:bg-[#202124] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm font-sans">
      
      {/* Display */}
      <div className="flex flex-col items-end justify-end p-3 h-24 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-[#202124]">
        <div className="text-[13px] text-slate-500 dark:text-slate-400 h-5 mb-1">{equation}</div>
        <div className="text-3xl sm:text-4xl font-normal text-slate-800 dark:text-slate-200 tracking-tight w-full text-right overflow-hidden text-ellipsis whitespace-nowrap">{display}</div>
      </div>
      
      {/* Controls Bar */}
      <div className="flex justify-between items-center px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-4 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center p-0.5 cursor-pointer">
            <div className="w-3.5 h-3.5 bg-white dark:bg-slate-300 rounded-full shadow-sm"></div>
          </div>
          <span className="text-[13px] font-medium text-slate-600 dark:text-slate-400">Inv</span>
        </div>
        <div className="flex bg-emerald-600 dark:bg-emerald-500 rounded-md overflow-hidden text-[12px] font-medium">
          <div className="px-3 py-1.5 text-white dark:text-slate-900 bg-emerald-600 dark:bg-emerald-500 cursor-pointer">Keypad</div>
          <div className="px-3 py-1.5 text-emerald-100 dark:text-emerald-900 bg-transparent hover:bg-emerald-700 dark:hover:bg-emerald-400 cursor-pointer">History</div>
        </div>
      </div>

      {/* 7x5 Grid Keypad */}
      <div className="grid grid-cols-7 gap-1.5 p-2 sm:p-3 pt-0">
        {/* Row 1 */}
        <Button variant="outline" className={btnClass} onClick={() => advancedOp('sin')}>sin</Button>
        <Button variant="outline" className={btnClass} onClick={() => advancedOp('cos')}>cos</Button>
        <Button variant="outline" className={btnClass} onClick={() => advancedOp('tan')}>tan</Button>
        <Button variant="outline" className={opClass} onClick={() => handlePress('(')}>(</Button>
        <Button variant="outline" className={opClass} onClick={() => handlePress(')')}>)</Button>
        <Button variant="outline" className={opClass} onClick={() => handlePress('%')}>%</Button>
        <Button variant="outline" className={opClass} onClick={handleClear}>AC</Button>

        {/* Row 2 */}
        <Button variant="outline" className={btnClass} onClick={() => advancedOp('log')}>log</Button>
        <Button variant="outline" className={btnClass} onClick={() => advancedOp('ln')}>ln</Button>
        <Button variant="outline" className={btnClass} onClick={() => handlePress('^')}>xʸ</Button>
        <Button variant="outline" className={numClass} onClick={() => handlePress('7')}>7</Button>
        <Button variant="outline" className={numClass} onClick={() => handlePress('8')}>8</Button>
        <Button variant="outline" className={numClass} onClick={() => handlePress('9')}>9</Button>
        <Button variant="outline" className={opClass} onClick={() => handlePress('/')}>÷</Button>

        {/* Row 3 */}
        <Button variant="outline" className={btnClass} onClick={() => handlePress(String(Math.PI))}>π</Button>
        <Button variant="outline" className={btnClass} onClick={() => advancedOp('fact')}>x!</Button>
        <Button variant="outline" className={btnClass} onClick={() => advancedOp('sq')}>x²</Button>
        <Button variant="outline" className={numClass} onClick={() => handlePress('4')}>4</Button>
        <Button variant="outline" className={numClass} onClick={() => handlePress('5')}>5</Button>
        <Button variant="outline" className={numClass} onClick={() => handlePress('6')}>6</Button>
        <Button variant="outline" className={opClass} onClick={() => handlePress('*')}>×</Button>

        {/* Row 4 */}
        <Button variant="outline" className={btnClass} onClick={() => handlePress(String(Math.E))}>e</Button>
        <Button variant="outline" className={btnClass} onClick={() => handlePress('%')}>mod</Button>
        <Button variant="outline" className={btnClass} onClick={() => advancedOp('sqrt')}>√</Button>
        <Button variant="outline" className={numClass} onClick={() => handlePress('1')}>1</Button>
        <Button variant="outline" className={numClass} onClick={() => handlePress('2')}>2</Button>
        <Button variant="outline" className={numClass} onClick={() => handlePress('3')}>3</Button>
        <Button variant="outline" className={opClass} onClick={() => handlePress('-')}>−</Button>

        {/* Row 5 */}
        <Button variant="outline" className={btnClass} onClick={() => {}}>Ans</Button>
        <Button variant="outline" className={cn(btnClass, isRad && "font-bold text-slate-800 dark:text-slate-100")} onClick={() => setIsRad(true)}>Rad</Button>
        <Button variant="outline" className={cn(btnClass, !isRad && "font-bold text-slate-800 dark:text-slate-100")} onClick={() => setIsRad(false)}>Deg</Button>
        <Button variant="outline" className={numClass} onClick={() => handlePress('0')}>0</Button>
        <Button variant="outline" className={numClass} onClick={() => handlePress('.')}>.</Button>
        <Button variant="outline" className={equalsClass} onClick={calculate}>=</Button>
        <Button variant="outline" className={opClass} onClick={() => handlePress('+')}>+</Button>
      </div>
    </div>
  );
}
