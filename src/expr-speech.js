// 数学表达式 → 中文朗读文本转换
// 使用 math.js AST 遍历，正确处理嵌套表达式

import { parse } from 'https://cdn.jsdelivr.net/npm/mathjs@13.2.2/+esm';

// 函数名中文映射
const FUNC_NAMES = {
  sin: 'sin', cos: 'cos', tan: 'tan',
  asin: 'arcsin', acos: 'arccos', atan: 'arctan',
  sqrt: '根号', cbrt: '三次根号',
  abs: '绝对值',
  log: 'ln', log2: 'log2', log10: 'log10',
  exp: 'e的',
  floor: '取整', ceil: '向上取整', round: '四舍五入',
  sign: '符号函数',
};

export function exprToChinese(expr) {
  if (!expr) return '';
  try {
    const node = parse(expr);
    return nodeToChinese(node);
  } catch {
    return expr;
  }
}

function nodeToChinese(node) {
  switch (node.type) {
    case 'ConstantNode':
      return formatConstant(node);

    case 'SymbolNode':
      if (node.name === 'pi') return 'π';
      return node.name;

    case 'OperatorNode':
      return formatOperator(node);

    case 'FunctionNode':
      return formatFunction(node);

    case 'ParenthesisNode':
      return nodeToChinese(node.content);

    case 'UnaryNode':
      return formatUnary(node);

    default:
      return node.toString();
  }
}

function formatConstant(node) {
  const v = node.value;
  if (v === Math.PI) return 'π';
  if (v === Math.E) return 'e';
  // 分数检测（0.5 → "二分之一"）
  if (Number.isFinite(v) && Math.abs(v) < 100) {
    const frac = toFraction(v);
    if (frac) return frac;
  }
  return String(v);
}

// 简单分数转中文
function toFraction(v) {
  const fracs = [
    [0.5, '二分之一'], [0.25, '四分之一'], [0.75, '四分之三'],
    [0.333, '三分之一'], [0.667, '三分之二'],
    [-0.5, '负二分之一'], [-0.25, '负四分之一'],
  ];
  for (const [val, cn] of fracs) {
    if (Math.abs(v - val) < 0.01) return cn;
  }
  return null;
}

function formatOperator(node) {
  const op = node.op;

  // 一元负号：math.js 用 OperatorNode(op="-") 单参数表示
  if (op === '-' && node.args.length === 1) {
    return '负' + nodeToChinese(node.args[0]);
  }

  const args = node.args.map(a => nodeToChinese(a));

  switch (op) {
    case '+':
      return args.join(' 加 ');

    case '-':
      return args.join(' 减 ');

    case '*': {
      const left = node.args[0];
      const right = node.args[1];
      // 数字乘 变量/函数/幂次 → 省略乘号
      if (left.type === 'ConstantNode' &&
          (right.type === 'SymbolNode' || right.type === 'FunctionNode' ||
           right.type === 'OperatorNode' && right.op === '^')) {
        return args[0] + args[1];
      }
      // 负号×变量/函数 → 省略乘号
      if (left.type === 'OperatorNode' && left.op === '-' && left.args.length === 1 &&
          (right.type === 'SymbolNode' || right.type === 'FunctionNode')) {
        return args[0] + args[1];
      }
      return args.join(' 乘以 ');
    }

    case '/':
      // 除法：读作 "分之" 格式
      return `${args[1]}分之${args[0]}`;

    case '^': {
      const base = node.args[0];
      const exp = node.args[1];
      const expStr = nodeToChinese(exp);
      // 底数是复合表达式（括号/运算）时加"整体"
      const isComplexBase = base.type === 'ParenthesisNode' ||
        (base.type === 'OperatorNode' && base.args.length === 2);
      const baseStr = nodeToChinese(base);

      // x^2 / (x-1)^2 → …平方
      if (exp.type === 'ConstantNode' && exp.value === 2) {
        return isComplexBase ? `${baseStr}整体平方` : `${baseStr}平方`;
      }
      // x^3 → …三次方
      if (exp.type === 'ConstantNode' && exp.value === 3) {
        return isComplexBase ? `${baseStr}整体三次方` : `${baseStr}三次方`;
      }
      // x^n → …的n次方
      return baseStr + '的' + expStr + '次方';
    }

    default:
      return args.join(` ${op} `);
  }
}

function formatFunction(node) {
  const fn = node.fn.name;
  const cnName = FUNC_NAMES[fn];
  const argStr = node.args.map(a => nodeToChinese(a)).join('，');

  if (!cnName) return `${fn} ${argStr}`;

  // 特殊处理
  switch (fn) {
    case 'sqrt':
      return `根号${argStr}`;

    case 'abs':
      return `${argStr}的绝对值`;

    case 'exp': {
      // exp(x) → e的x次方
      const inner = nodeToChinese(node.args[0]);
      return `e的${inner}次方`;
    }

    case 'log':
      return `ln ${argStr}`;

    case 'floor':
    case 'ceil':
    case 'round':
    case 'sign':
      return `${cnName}${argStr}`;

    default:
      // 三角函数类：sin x, arcsin x
      return `${cnName} ${argStr}`;
  }
}

function formatUnary(node) {
  if (node.op === '-') {
    const arg = nodeToChinese(node.arg);
    return `负${arg}`;
  }
  return nodeToChinese(node.arg);
}
