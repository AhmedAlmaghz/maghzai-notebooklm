// Test the neutralizeNonMathSpans logic from src/components/markdown.tsx

const NON_MATH_SCRIPT = /[\u0590-\u05FF\u0600-\u08FF\u0B00-\u0BFF\u0E00-\u0E7F\u0F00-\u0FFF\u2E80-\u303F\u3040-\u30FF\u3400-\u9FFF\uA000-\uA48F\uAC00-\uD7AF\uF900-\uFAFF\uFB00-\uFDFF\uFE70-\uFEFF\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/u;

/** Strip LaTeX syntax so a span reads as plain prose (no backslash commands). */
function mathSpanToPlainText(span) {
  return span
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}\\_^~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function neutralizeNonMathSpans(md) {
  const out = [];
  let i = 0;
  while (i < md.length) {
    const c = md[i];
    if (c === "$") {
      const prev = md[i - 1];
      const next = md[i + 1];
      const isDelimiter =
        next !== undefined &&
        next !== " " &&
        next !== "\t" &&
        next !== "\n" &&
        !(prev && /[\p{L}\p{N}]/u.test(prev));

      if (isDelimiter && next === "$") {
        const end = md.indexOf("$$", i + 2);
        if (end === -1) {
          out.push(md.slice(i));
          break;
        }
        const body = md.slice(i + 2, end);
        if (NON_MATH_SCRIPT.test(body)) {
          const plain = mathSpanToPlainText(body);
          out.push(plain ? `\n\n${plain}\n\n` : "");
        } else {
          out.push(`$$${body}$$`);
        }
        i = end + 2;
        continue;
      }

      if (isDelimiter) {
        const end = md.indexOf("$", i + 1);
        if (end === -1) {
          out.push(md.slice(i));
          break;
        }
        const body = md.slice(i + 1, end);
        if (NON_MATH_SCRIPT.test(body)) {
          out.push(mathSpanToPlainText(body));
        } else {
          out.push(`$${body}$`);
        }
        i = end + 1;
        continue;
      }
    }
    out.push(c);
    i++;
  }
  return out.join("");
}

const tests = [
  {
    name: "inline Arabic math",
    input: "قيمة $س$ في المعادلة",
    expected: "قيمة س في المعادلة",
  },
  {
    name: "block Arabic math",
    input: "بداية\n\n$$ع س ت ص$$\n\nنهاية",
    expected: "بداية\n\n\n\nع س ت ص\n\n\n\nنهاية",
  },
  {
    name: "Tamil text inside math parsed as math",
    input: "மரு $ர$",
    expected: "மரு ர",
  },
  {
    name: "real Latin math preserved",
    input: "معادلة $x^2 + y = 3$",
    expected: "معادلة $x^2 + y = 3$",
  },
  {
    name: "dollar as price (space after)",
    input: "السعر $ 10",
    expected: "السعر $ 10",
  },
  {
    name: "unclosed dollar",
    input: "التكلفة $",
    expected: "التكلفة $",
  },
  {
    name: "Arabic-Indic digits in math preserved as text",
    input: "تاريخ $٢٠٢٤$ ميلادي",
    expected: "تاريخ ٢٠٢٤ ميلادي",
  },
  {
    name: "mixed Arabic text with real math",
    input: "المساحة $\\pi r^2$ والناتج $س$",
    expected: "المساحة $\\pi r^2$ والناتج س",
  },
  {
    name: "block real math preserved",
    input: "$$\nx^2 = 4\n$$",
    expected: "$$\nx^2 = 4\n$$",
  },
  {
    name: "emoji in math preserved as text",
    input: "رمز $😀$ مضحك",
    expected: "رمز 😀 مضحك",
  },
];

let allPass = true;
for (const t of tests) {
  const result = neutralizeNonMathSpans(t.input);
  const ok = result === t.expected;
  if (!ok) allPass = false;
  console.log(
    `${ok ? "PASS" : "FAIL"} | ${t.name}` +
      (ok ? "" : ` | input: ${JSON.stringify(t.input)} | result: ${JSON.stringify(result)} | expected: ${JSON.stringify(t.expected)}`)
  );
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass ? 0 : 1);