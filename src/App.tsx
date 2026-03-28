/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Delete, 
  ChevronRight,
  HelpCircle,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types & Utilities ---

type ProblemType = 'monomial' | 'binomial_simple' | 'binomial_complex';

interface Problem {
  type: ProblemType;
  latex: string;
  correctAnswerValue: number;
  correctAnswerLatex: string;
  checkAnswer: (input: string) => boolean;
  hint: string;
}

// Simple GCD function
const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    a %= b;
    [a, b] = [b, a];
  }
  return a;
};

const simplifyFraction = (num: number, den: number): [number, number] => {
  const common = gcd(num, den);
  const sign = den < 0 ? -1 : 1;
  return [(num / common) * sign, (den / common) * sign];
};

// Simplify sqrt(n) -> a * sqrt(b)
const simplifySqrt = (n: number): [number, number] => {
  let a = 1;
  let b = n;
  for (let i = Math.floor(Math.sqrt(n)); i >= 2; i--) {
    if (n % (i * i) === 0) {
      a = i;
      b = n / (i * i);
      break;
    }
  }
  return [a, b];
};

// Helper to check if the answer is numerically correct and rationalized
const checkRationalizedAnswer = (input: string, val: number): boolean => {
  try {
    const evalInput = evaluateMath(input);
    const isNumericMatch = Math.abs(evalInput - val) < 0.000001;
    
    // Check if denominator contains a square root
    const parts = input.split('/');
    const hasRootInDenominator = parts.length > 1 && parts[1].includes('√');
    
    return isNumericMatch && !hasRootInDenominator;
  } catch {
    return false;
  }
};

// --- Problem Generators ---

const generateMonomial = (): Problem => {
  // a / sqrt(b)
  const b = [2, 3, 5, 6, 7, 8, 10, 12, 18, 20, 24, 27][Math.floor(Math.random() * 12)];
  const a = Math.floor(Math.random() * 5) + 1;

  const latex = `\\frac{${a}}{\\sqrt{${b}}}`;
  const val = a / Math.sqrt(b);

  // Calculate answer latex
  const [coeff, root] = simplifySqrt(b);
  const [fNum, fDen] = simplifyFraction(a, coeff * root);
  
  let ansLatex = "";
  if (fDen === 1) {
    ansLatex = fNum === 1 ? `\\sqrt{${root}}` : `${fNum}\\sqrt{${root}}`;
  } else {
    const numPart = fNum === 1 ? `\\sqrt{${root}}` : `${fNum}\\sqrt{${root}}`;
    ansLatex = `\\frac{${numPart}}{${fDen}}`;
  }

  return {
    type: 'monomial',
    latex,
    correctAnswerValue: val,
    correctAnswerLatex: ansLatex,
    hint: "將分子和分母同時乘以分母中的根號部分。",
    checkAnswer: (input: string) => checkRationalizedAnswer(input, val)
  };
};

const generateBinomialSimple = (): Problem => {
  // a / (sqrt(b) + sqrt(c))
  const primes = [2, 3, 5, 7, 11];
  let b = primes[Math.floor(Math.random() * primes.length)];
  let c = primes[Math.floor(Math.random() * primes.length)];
  while (b === c) c = primes[Math.floor(Math.random() * primes.length)];
  
  const a = Math.floor(Math.random() * 4) + 1;
  const op = Math.random() > 0.5 ? '+' : '-';
  const conjOp = op === '+' ? '-' : '+';

  const latex = `\\frac{${a}}{\\sqrt{${b}} ${op} \\sqrt{${c}}}`;
  const val = a / (Math.sqrt(b) + (op === '+' ? 1 : -1) * Math.sqrt(c));

  // a * (sqrt(b) - op * sqrt(c)) / (b - c)
  const den = b - c;
  const [fNum, fDen] = simplifyFraction(a, den);
  
  let ansLatex = "";
  const numerator = `(\\sqrt{${b}} ${conjOp} \\sqrt{${c}})`;
  if (fDen === 1) {
    ansLatex = fNum === 1 ? numerator : `${fNum}${numerator}`;
  } else if (fDen === -1) {
    ansLatex = fNum === 1 ? `-${numerator}` : `-${fNum}${numerator}`;
  } else {
    const numPart = fNum === 1 ? numerator : `${fNum}${numerator}`;
    ansLatex = `\\frac{${numPart}}{${fDen}}`;
  }

  return {
    type: 'binomial_simple',
    latex,
    correctAnswerValue: val,
    correctAnswerLatex: ansLatex,
    hint: `利用平方差公式 $(a+b)(a-b) = a^2 - b^2$。乘以分母的共軛根式：$\\sqrt{${b}} ${conjOp} \\sqrt{${c}}$。`,
    checkAnswer: (input: string) => checkRationalizedAnswer(input, val)
  };
};

const generateBinomialComplex = (): Problem => {
  // (sqrt(a) + opNum * sqrt(b)) / (sqrt(a) - opNum * sqrt(b))
  const primes = [2, 3, 5, 7];
  let a = primes[Math.floor(Math.random() * primes.length)];
  let b = primes[Math.floor(Math.random() * primes.length)];
  while (a === b) b = primes[Math.floor(Math.random() * primes.length)];
  
  const opNum = Math.random() > 0.5 ? '+' : '-';
  const opDen = opNum === '+' ? '-' : '+';

  const latex = `\\frac{\\sqrt{${a}} ${opNum} \\sqrt{${b}}}{\\sqrt{${a}} ${opDen} \\sqrt{${b}}}`;
  const val = (Math.sqrt(a) + (opNum === '+' ? 1 : -1) * Math.sqrt(b)) / (Math.sqrt(a) + (opDen === '+' ? 1 : -1) * Math.sqrt(b));

  // (sqrt(a) + opNum * sqrt(b))^2 / (a - b) = (a + b + 2 * opNum * sqrt(a*b)) / (a - b)
  const den = a - b;
  const sum = a + b;
  const prod = a * b;
  const [coeff, root] = simplifySqrt(prod);
  const rootCoeff = 2 * coeff * (opNum === '+' ? 1 : -1);
  
  // Simplify (sum + rootCoeff * sqrt(root)) / den
  const common = gcd(gcd(sum, Math.abs(rootCoeff)), Math.abs(den));
  const fSum = sum / common;
  const fRootCoeff = rootCoeff / common;
  const fDen = den / common;
  
  const sign = fDen < 0 ? -1 : 1;
  const finalSum = fSum * sign;
  const finalRootCoeff = fRootCoeff * sign;
  const finalDen = Math.abs(fDen);

  let numPart = "";
  if (finalRootCoeff === 1) numPart = `${finalSum} + \\sqrt{${root}}`;
  else if (finalRootCoeff === -1) numPart = `${finalSum} - \\sqrt{${root}}`;
  else if (finalRootCoeff > 0) numPart = `${finalSum} + ${finalRootCoeff}\\sqrt{${root}}`;
  else numPart = `${finalSum} - ${Math.abs(finalRootCoeff)}\\sqrt{${root}}`;

  const ansLatex = finalDen === 1 ? numPart : `\\frac{${numPart}}{${finalDen}}`;

  return {
    type: 'binomial_complex',
    latex,
    correctAnswerValue: val,
    correctAnswerLatex: ansLatex,
    hint: `將分子和分母同時乘以分母的共軛根式：$\\sqrt{${a}} ${opNum} \\sqrt{${b}}$。`,
    checkAnswer: (input: string) => checkRationalizedAnswer(input, val)
  };
};

// Helper to evaluate simple math strings with sqrt
const evaluateMath = (str: string): number => {
  // Replace sqrt(x) with Math.sqrt(x)
  let clean = str.replace(/√\(([^)]+)\)/g, 'Math.sqrt($1)');
  clean = clean.replace(/√(\d+)/g, 'Math.sqrt($1)');
  // Replace fractions if any (though user is encouraged to simplify)
  // This is a very basic evaluator
  try {
    // Using Function constructor for a simple sandbox-ish eval
    return new Function(`return ${clean}`)();
  } catch {
    return NaN;
  }
};

// --- Main Component ---

export default function App() {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [numInput, setNumInput] = useState('');
  const [denInput, setDenInput] = useState('1');
  const [activeField, setActiveField] = useState<'num' | 'den'>('num');
  const [status, setStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [showHint, setShowHint] = useState(false);

  const generateNewProblem = () => {
    const r = Math.random();
    let newProb;
    if (r < 0.33) newProb = generateMonomial();
    else if (r < 0.66) newProb = generateBinomialSimple();
    else newProb = generateBinomialComplex();
    
    setProblem(newProb);
    setNumInput('');
    setDenInput('1');
    setActiveField('num');
    setStatus('idle');
    setShowHint(false);
  };

  useEffect(() => {
    generateNewProblem();
  }, []);

  const handleKeyPress = (key: string) => {
    if (status !== 'idle') return;
    
    const setter = activeField === 'num' ? setNumInput : setDenInput;
    
    if (key === 'BACKSPACE') {
      setter(prev => prev.slice(0, -1));
    } else if (key === '√') {
      setter(prev => prev + '√(');
    } else {
      setter(prev => prev + key);
    }
  };

  const checkAnswer = () => {
    if (!problem || !numInput) return;
    
    // Combine inputs for checking
    // If den is 1 or empty, just check num
    const combinedInput = (denInput === '1' || denInput === '') ? numInput : `(${numInput})/(${denInput})`;
    
    if (problem.checkAnswer(combinedInput)) {
      setStatus('correct');
    } else {
      setStatus('incorrect');
    }
  };

  // Convert user input string to LaTeX for preview
  const toLatex = (str: string) => {
    if (!str) return '';
    let res = str;
    // Replace √(x) with \sqrt{x}
    res = res.replace(/√\(([^)]*)\)/g, '\\sqrt{$1}');
    // Handle cases where user hasn't closed the bracket yet
    res = res.replace(/√\((.*)/g, '\\sqrt{$1}');
    return res;
  };

  const userLatex = denInput === '1' || denInput === '' 
    ? toLatex(numInput) 
    : `\\frac{${toLatex(numInput)}}{${toLatex(denInput)}}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100"
      >
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight">分母有理化</h1>
            <p className="text-slate-400 text-xs mt-1">二次根式練習系統</p>
          </div>
          <button 
            onClick={generateNewProblem}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
            title="換一題"
          >
            <RefreshCw size={20} />
          </button>
        </div>

        {/* Problem Area */}
        <div className="p-8 flex flex-col items-center bg-slate-50/50">
          <div className="text-slate-500 text-sm mb-4 uppercase tracking-widest font-semibold">題目</div>
          <div className="text-3xl py-4">
            {problem && <BlockMath math={problem.latex} />}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 space-y-6">
          {/* Live Preview */}
          <div className="flex flex-col items-center justify-center min-h-[80px] bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-4">
            <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-2">你的答案預覽</div>
            <div className="text-2xl">
              {userLatex ? <InlineMath math={userLatex} /> : <span className="text-slate-300 italic text-sm">等待輸入...</span>}
            </div>
          </div>

          {/* Split Input Fields */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-full space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-8">分子</span>
                <button
                  onClick={() => setActiveField('num')}
                  className={`flex-1 text-center text-xl p-3 rounded-xl border-2 transition-all outline-none ${
                    activeField === 'num' ? 'border-slate-900 bg-white ring-4 ring-slate-100' : 'border-slate-100 bg-slate-50 text-slate-400'
                  } ${status === 'correct' && activeField === 'num' ? 'border-emerald-500 bg-emerald-50' : ''} ${status === 'incorrect' && activeField === 'num' ? 'border-rose-500 bg-rose-50' : ''}`}
                >
                  {numInput || <span className="opacity-30">輸入分子</span>}
                </button>
              </div>
              
              <div className="h-[2px] bg-slate-200 w-full rounded-full" />

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-8">分母</span>
                <button
                  onClick={() => setActiveField('den')}
                  className={`flex-1 text-center text-xl p-3 rounded-xl border-2 transition-all outline-none ${
                    activeField === 'den' ? 'border-slate-900 bg-white ring-4 ring-slate-100' : 'border-slate-100 bg-slate-50 text-slate-400'
                  } ${status === 'correct' && activeField === 'den' ? 'border-emerald-500 bg-emerald-50' : ''} ${status === 'incorrect' && activeField === 'den' ? 'border-rose-500 bg-rose-50' : ''}`}
                >
                  {denInput || <span className="opacity-30">輸入分母</span>}
                </button>
              </div>
            </div>
          </div>

          {/* Virtual Keyboard */}
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, '√', 4, 5, 6, '(', 7, 8, 9, ')', '.', 0, '+', '-', '/', 'BACKSPACE'].map((key) => (
              <button
                key={key.toString()}
                onClick={() => handleKeyPress(key.toString())}
                className={`flex items-center justify-center p-3 rounded-xl font-bold text-lg transition-all active:scale-95 ${
                  key === 'BACKSPACE' ? 'bg-slate-200 text-slate-600 col-span-1' :
                  typeof key === 'string' && ['√', '(', ')', '+', '-', '/'].includes(key) ? 'bg-slate-100 text-slate-900' :
                  'bg-white border border-slate-200 text-slate-900 hover:bg-slate-50'
                }`}
              >
                {key === 'BACKSPACE' ? <Delete size={20} /> : key}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowHint(!showHint)}
              className="flex-1 flex items-center justify-center gap-2 p-4 rounded-2xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
            >
              <HelpCircle size={20} />
              提示
            </button>
            <button
              onClick={status === 'idle' ? checkAnswer : generateNewProblem}
              className={`flex-[2] flex items-center justify-center gap-2 p-4 rounded-2xl font-bold text-white transition-all shadow-lg active:scale-95 ${
                status === 'idle' ? 'bg-slate-900 hover:bg-slate-800' :
                status === 'correct' ? 'bg-emerald-600 hover:bg-emerald-500' :
                'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              {status === 'idle' ? '檢查答案' : '下一題'}
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Hint Section */}
          <AnimatePresence>
            {showHint && problem && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-900 text-sm flex gap-3">
                  <Info className="shrink-0 text-amber-500" size={18} />
                  <div>
                    <p className="font-bold mb-1">解題提示：</p>
                    <div className="mb-2">
                      <InlineMath math={problem.hint} />
                    </div>
                    <div className="pt-2 border-t border-amber-200">
                      <p className="font-bold mb-1">正確答案參考：</p>
                      <div className="text-lg bg-white/50 p-2 rounded-lg inline-block">
                        <InlineMath math={problem.correctAnswerLatex} />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Footer Info */}
      <div className="mt-8 text-slate-400 text-xs text-center max-w-xs leading-relaxed">
        <p>提示：點擊「分子」或「分母」區域來切換輸入目標。如果答案不是分數，分母請填寫 1。</p>
        <p className="mt-1">預覽區域會即時顯示您的答案格式。</p>
      </div>
    </div>
  );
}
