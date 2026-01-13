export type Vector = number[];

export function dot(a: Vector, b: Vector): number {
    const n: number = Math.min(a.length, b.length);
    let s: number = 0;
    for (let i: number = 0; i < n; i++) {
        s += a[i] * b[i];
    }
    return s;
}

export function norm(a: Vector): number {
    let s: number = 0;
    for (let i: number = 0; i < a.length; i++) {
        const x: number = a[i];
        s += x * x;
    }
    return Math.sqrt(s);
}

export function l2Normalize(v: Vector): Vector {
    const n: number = norm(v);
    if (n === 0) {
        return v.slice();
    }

    const out: Vector = new Array<number>(v.length);
    for (let i: number = 0; i < v.length; i++) {
        out[i] = v[i] / n;
    }
    return out;
}

export function cosineSimilarity(
    a: Vector,
    b: Vector,
    normalize: boolean
): number {
    if (normalize) {
        const na: Vector = l2Normalize(a);
        const nb: Vector = l2Normalize(b);
        return dot(na, nb);
    }

    const denom: number = norm(a) * norm(b);
    if (denom === 0) {
        return 0;
    }
    return dot(a, b) / denom;
}
