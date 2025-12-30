export function sleep(ms: number): Promise<void> {
    return new Promise((resolve: (value: void | PromiseLike<void>) => void) =>
        setTimeout(resolve, ms)
    );
}

export function getEnumKeyTuples<E extends Record<string, string | number>>(
    enumObj: E
): readonly [E[keyof E], ...Array<E[keyof E]>] {
    const values = Object.keys(enumObj)
        .filter((key: string): boolean => isNaN(Number(key))) // numeric enum reverse-mapping guard
        .map((key: string): E[keyof E] => enumObj[key as keyof E]) as Array<
        E[keyof E]
    >;

    if (values.length === 0) {
        throw new Error('Enum has no values');
    }

    return values as unknown as readonly [E[keyof E], ...Array<E[keyof E]>];
}

export function createEnumTransformer<E extends Record<string, string>>(
    enumObj: E,
    opts?: { caseInsensitive?: boolean }
): (value: string) => E[keyof E] {
    const values = Object.keys(enumObj)
        .filter((k: string): boolean => isNaN(Number(k)))
        .map((k: string): E[keyof E] => enumObj[k as keyof E]) as Array<
        E[keyof E]
    >;

    const caseInsensitive: boolean = opts?.caseInsensitive ?? true;

    const lookup = new Map<string, E[keyof E]>(
        values.map((v: E[keyof E]): [string, E[keyof E]] => [
            caseInsensitive ? v.toLowerCase() : v,
            v,
        ])
    );

    return (value: string): E[keyof E] => {
        const key: string = caseInsensitive ? value.toLowerCase() : value;
        const found: E[keyof E] | undefined = lookup.get(key);
        if (found === undefined) {
            throw new Error(`Invalid enum value: "${value}"`);
        }
        return found;
    };
}

export function formattedTimeForFilename(date = new Date()): string {
    const pad: (n: number) => string = (n: number): string =>
        String(n).padStart(2, '0');

    return (
        date.getFullYear() +
        pad(date.getMonth() + 1) +
        pad(date.getDate()) +
        '-' +
        pad(date.getHours()) +
        pad(date.getMinutes()) +
        pad(date.getSeconds())
    );
}
