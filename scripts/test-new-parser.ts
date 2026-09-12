import { parseSignal } from "../src/signals/parser";

const msg = `🚨 NOVA CALL

Symbol: JUPUSDT
Side: SHORT
Entry: 0.2477
TP1: 0.2452
TP2: 0.2405
TP3: 0.236
TP4: 0.2232
SL: 0.2601
Leverage: 15x

Execution:
TP1 = close 50% + move SL to entry
TP2 = close remaining 50%`;

const res = parseSignal(msg);
console.log("Resultado do parser:", res);
