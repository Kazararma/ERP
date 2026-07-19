import { useState, useRef, useEffect } from "react";
import { Calculator, X, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CalculatorWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: -24, y: -24 }); // Offset from bottom right
  const dragRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const inputDigit = (digit: string) => {
    if (waitingForNewValue) {
      setDisplay(digit);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === "0" ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForNewValue) {
      setDisplay("0.");
      setWaitingForNewValue(false);
      return;
    }
    if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  };

  const clear = () => {
    setDisplay("0");
    setPrevValue(null);
    setOperator(null);
    setWaitingForNewValue(false);
  };

  const backspace = () => {
    if (waitingForNewValue) return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
  };

  const calculate = (a: number, b: number, op: string) => {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (prevValue == null) {
      setPrevValue(inputValue);
    } else if (operator && !waitingForNewValue) {
      const result = calculate(prevValue, inputValue, operator);
      setDisplay(String(parseFloat(result.toFixed(6))));
      setPrevValue(result);
    }

    setOperator(nextOperator);
    setWaitingForNewValue(true);
  };

  const handleEqual = () => {
    if (!operator || prevValue == null) return;
    const inputValue = parseFloat(display);
    const result = calculate(prevValue, inputValue, operator);
    setDisplay(String(parseFloat(result.toFixed(6))));
    setPrevValue(null);
    setOperator(null);
    setWaitingForNewValue(true);
  };

  // Draggable logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y
      });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow drag from header
    if ((e.target as HTMLElement).closest(".drag-handle")) {
      e.preventDefault();
      setIsDragging(true);
      const rect = dragRef.current?.getBoundingClientRect();
      if (rect) {
        offsetRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
      }
    }
  };

  // Keyboard support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input field somewhere else
      // Actually we ONLY intercept if they're not in an input, OR if they're focused on the calculator
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA";
      
      if (isInputFocused) return;

      const key = e.key;
      if (/[0-9]/.test(key)) inputDigit(key);
      else if (key === ".") inputDecimal();
      else if (key === "Escape") setIsOpen(false);
      else if (key === "Backspace") backspace();
      else if (key === "Enter" || key === "=") { e.preventDefault(); handleEqual(); }
      else if (key === "+") performOperation("+");
      else if (key === "-") performOperation("-");
      else if (key === "*") performOperation("×");
      else if (key === "/") { e.preventDefault(); performOperation("÷"); }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, display, prevValue, operator, waitingForNewValue]);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-[9999] bg-indigo-600 hover:bg-indigo-700 text-white"
        size="icon"
      >
        <Calculator className="h-6 w-6" />
      </Button>
    );
  }

  const btnClass = "text-lg font-medium h-12 w-full transition-colors active:scale-95 border border-slate-200/60";
  const numClass = `${btnClass} bg-white hover:bg-slate-50 text-slate-800`;
  const opClass = `${btnClass} bg-indigo-50 hover:bg-indigo-100 text-indigo-700`;
  const eqClass = `${btnClass} bg-indigo-600 hover:bg-indigo-700 text-white col-span-2`;
  const clearClass = `${btnClass} bg-rose-50 hover:bg-rose-100 text-rose-600`;

  const style = isDragging || position.x !== -24 
    ? { left: position.x, top: position.y } 
    : { bottom: 24, right: 24 };

  return (
    <div 
      ref={dragRef}
      style={style}
      className={`fixed z-[9999] w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col ${isDragging ? "opacity-90 scale-[1.02]" : ""} transition-transform duration-75`}
      onMouseDown={handleMouseDown}
    >
      {/* Header / Drag Handle */}
      <div className="drag-handle bg-slate-900 px-4 py-3 flex items-center justify-between cursor-move select-none">
        <div className="flex items-center gap-2 text-slate-200">
          <Calculator className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Calculator</span>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-white transition-colors p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Display */}
      <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col items-end">
        <div className="text-xs font-mono text-slate-500 h-4 mb-1">
          {prevValue != null && operator ? `${prevValue} ${operator}` : ""}
        </div>
        <div className="text-3xl font-bold text-slate-800 tracking-tight overflow-x-auto max-w-full no-scrollbar whitespace-nowrap">
          {display}
        </div>
      </div>

      {/* Keypad */}
      <div className="p-3 grid grid-cols-4 gap-2 bg-slate-100/50">
        <button onClick={clear} className={clearClass}>C</button>
        <button onClick={backspace} className={`${btnClass} bg-white hover:bg-slate-50 text-slate-600 flex justify-center items-center`}><Delete className="h-5 w-5" /></button>
        <button onClick={() => performOperation("÷")} className={opClass}>÷</button>
        <button onClick={() => performOperation("×")} className={opClass}>×</button>

        <button onClick={() => inputDigit("7")} className={numClass}>7</button>
        <button onClick={() => inputDigit("8")} className={numClass}>8</button>
        <button onClick={() => inputDigit("9")} className={numClass}>9</button>
        <button onClick={() => performOperation("-")} className={opClass}>−</button>

        <button onClick={() => inputDigit("4")} className={numClass}>4</button>
        <button onClick={() => inputDigit("5")} className={numClass}>5</button>
        <button onClick={() => inputDigit("6")} className={numClass}>6</button>
        <button onClick={() => performOperation("+")} className={opClass}>+</button>

        <div className="col-span-3 grid grid-cols-3 gap-2">
          <button onClick={() => inputDigit("1")} className={numClass}>1</button>
          <button onClick={() => inputDigit("2")} className={numClass}>2</button>
          <button onClick={() => inputDigit("3")} className={numClass}>3</button>
          
          <button onClick={() => inputDigit("0")} className={`${numClass} col-span-2`}>0</button>
          <button onClick={inputDecimal} className={numClass}>.</button>
        </div>
        
        <button onClick={handleEqual} className={`${eqClass} !col-span-1 h-full`}>=</button>
      </div>
    </div>
  );
}
