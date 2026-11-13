"""Bounded checking of explicit arithmetic and real linear/quadratic equations.

Input is data, never Python code: AST nodes are interpreted by a small allowlist.
Unsupported notation, prose, domains and resource limits require human review.
"""
import ast
import json
import re
import sys

from sympy import Poly, Rational, Symbol, simplify, sqrt

X = Symbol("x", real=True)
MATH = r"(?:\\\((.*?)\\\)|\\\[(.*?)\\\]|\$\$(.*?)\$\$)"
UNKNOWN = {"status": "needs_review", "message": "Este formato não está coberto pela conferência automática. Revise o cálculo e o gabarito."}


class Unsupported(ValueError):
    pass


def expression(source, variable=False):
    if not isinstance(source, str) or len(source) > 256:
        raise Unsupported()
    source = source.strip().replace("−", "-").replace("×", "*").replace("÷", "/")
    source = source.replace(r"\cdot", "*").replace(r"\times", "*").replace(r"\div", "/")
    source = source.replace(r"\left", "").replace(r"\right", "")
    # Decimal comma is accepted only between digits; no thousands separator.
    source = re.sub(r"(?<=\d),(?=\d)", ".", source)
    for _ in range(12):
        previous = source
        source = re.sub(r"\\(?:d?frac)\{([^{}]+)\}\{([^{}]+)\}", r"((\1)/(\2))", source)
        source = re.sub(r"\\sqrt\{([^{}]+)\}", r"sqrt(\1)", source)
        source = re.sub(r"\^\{([^{}]+)\}", r"^(\1)", source)
        if source == previous:
            break
    if re.search(r"[^0-9.xsqrt+*/^()\s-]", source) or re.search(r"\d{7}", source):
        raise Unsupported()
    source = source.replace("^", "**")
    source = re.sub(r"(?<=[0-9)])(?=x|\()|(?<=x)(?=\()", "*", source)
    nesting = 0
    for char in source:
        nesting += (char == '(') - (char == ')')
        if nesting < 0 or nesting > 16:
            raise Unsupported()
    tree = ast.parse(source, mode="eval")
    if len(list(ast.walk(tree))) > 80:
        raise Unsupported()

    def visit(node, depth=0):
        if depth > 16:
            raise Unsupported()
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            token = ast.get_source_segment(source, node)
            if not re.fullmatch(r"\d+(?:\.\d+)?", token):
                raise Unsupported()
            return Rational(token)
        if isinstance(node, ast.Name) and node.id == "x" and variable:
            return X
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            value = visit(node.operand, depth + 1)
            return -value if isinstance(node.op, ast.USub) else value
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                and node.func.id == "sqrt" and len(node.args) == 1 and not node.keywords):
            value = visit(node.args[0], depth + 1)
            if value.free_symbols or value.is_nonnegative is not True:
                raise Unsupported()
            return sqrt(value)
        if not isinstance(node, ast.BinOp):
            raise Unsupported()
        left, right = visit(node.left, depth + 1), visit(node.right, depth + 1)
        if isinstance(node.op, ast.Add):
            result = left + right
        elif isinstance(node.op, ast.Sub):
            result = left - right
        elif isinstance(node.op, ast.Mult):
            result = left * right
        elif isinstance(node.op, ast.Div) and not right.free_symbols and right.is_zero is False:
            result = left / right
        elif (isinstance(node.op, ast.Pow) and right.is_Integer
              and abs(right) <= 6 and not (left.is_zero and right <= 0)
              and not (left.free_symbols and right < 0)):
            result = left ** right
        else:
            raise Unsupported()
        if len(str(result)) > 512 or result.count_ops() > 64:
            raise Unsupported()
        if result.free_symbols and Poly(result, X).degree() > 2:
            raise Unsupported()
        return result

    return visit(tree.body)


def unbox(text):
    text = text.strip()
    match = re.fullmatch(MATH, text, re.S)
    return next(x for x in match.groups() if x is not None) if match else text


def values(text, equation):
    # Only the final result is checked, not the reasoning preceding this label.
    text = re.split(r"Resposta final:\s*", text, flags=re.I)[-1].strip()
    text = unbox(text.removesuffix("."))
    if equation:
        if text.lower().strip() in ("sem solução real", "sem raízes reais"):
            return set()
        parts = re.split(r"\s+ou\s+|;", text)
        if len(parts) > 2:
            raise Unsupported()
        results = set()
        for part in parts:
            part = unbox(part)
            part = re.sub(r"^x\s*=\s*", "", part.strip())
            results.add(simplify(expression(part)))
        return results
    return {expression(text)}


def check(question):
    # Anchoring the complete statement avoids checking a fragment of a word problem.
    match = re.fullmatch(
        r"\s*(Calcule(?: o valor de)?|Resolva(?: a equação)?(?: nos reais)?)\s*:?\s*"
        + MATH + r"\s*[.!]?\s*", question["statement"], re.I | re.S,
    )
    if not match:
        return UNKNOWN.copy()
    source = next(x for x in match.groups()[1:] if x is not None)
    equation = "=" in source
    if equation:
        if not match[1].lower().startswith("resolva") or source.count("=") != 1:
            raise Unsupported()
        left, right = source.split("=")
        poly = Poly(expression(left, True) - expression(right, True), X)
        coefficients = poly.all_coeffs()
        if poly.degree() not in (1, 2) or not all(c.is_Rational for c in coefficients):
            raise Unsupported()
        if poly.degree() == 1:
            a, b = coefficients
            expected = {-b / a}
        else:
            a, b, c = coefficients
            delta = b * b - 4 * a * c
            expected = set() if delta < 0 else {(-b + sqrt(delta)) / (2 * a), (-b - sqrt(delta)) / (2 * a)}
    else:
        if not match[1].lower().startswith("calcule"):
            raise Unsupported()
        expected = {expression(source)}

    def equivalent(first, second):
        if len(first) != len(second):
            return False
        for value in first:
            comparisons = [simplify(value - other).is_zero for other in second]
            if True not in comparisons:
                if None in comparisons:
                    raise Unsupported()
                return False
        return True

    actual = values(question["answer"], equation)
    matches = equivalent(actual, expected)
    if question["type"] == "objective":
        options = [values(option, equation) for option in question["options"]]
        if len(options) != 4 or question["answer"] not in question["options"]:
            raise Unsupported()
        if any(equivalent(options[i], options[j]) for i in range(4) for j in range(i)):
            return {"status": "mismatch", "message": "Há alternativas matematicamente equivalentes. Revise as opções."}
        matches = matches and sum(equivalent(option, expected) for option in options) == 1
    return {
        "status": "verified" if matches else "mismatch",
        "message": ("Resultado final conferido. Revise também o raciocínio e a adequação da questão."
                    if matches else "O resultado final diverge do cálculo do enunciado. Revise o gabarito."),
    }


def verify(payload):
    questions = payload.get("questions", [])
    if not isinstance(questions, list) or len(questions) > 30:
        raise Unsupported()
    # Instructions may change domain, rounding or precision. Only neutral instructions
    # are accepted; an unfamiliar instruction must not silently disappear from the check.
    neutral = r"\s*(?:(?:Leia com atenção|Responda(?: às questões)?|Mostre (?:os cálculos|seu raciocínio)|Apresente (?:os cálculos|seu raciocínio))[.!]?\s*)*"
    if not re.fullmatch(neutral, payload.get('instructions', ''), re.I):
        return [{"status": "needs_review", "message": "As instruções desta prova exigem conferência manual do domínio e da precisão."} for _ in questions]
    results = []
    for question in questions:
        try:
            results.append(check(question))
        except (ValueError, TypeError, KeyError, SyntaxError, RecursionError, ZeroDivisionError, NotImplementedError):
            results.append(UNKNOWN.copy())
    return results


if __name__ == "__main__":
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024,) * 2)
        resource.setrlimit(resource.RLIMIT_CPU, (4, 4))
    except ImportError:  # Windows; PHP still enforces a wall-clock timeout.
        pass
    raw = sys.stdin.buffer.read(300001)
    if len(raw) > 300000:
        raise Unsupported()
    print(json.dumps(verify(json.loads(raw)), ensure_ascii=True))
