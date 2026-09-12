export function toJsonSafe<T>(value: T): T {
  if (typeof value === 'bigint') {
    const numberValue = Number(value);
    return (Number.isSafeInteger(numberValue) ? numberValue : value.toString()) as T;
  }

  if (value instanceof Uint8Array) {
    return undefined as T;
  }

  if (Array.isArray(value)) {
    return value.map(toJsonSafe) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)])
    ) as T;
  }

  return value;
}
