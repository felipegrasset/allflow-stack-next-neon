/** Unidad menor de cada moneda (ISO 4217): CLP y JPY no tienen decimales, USD sí. */
export function currencyExponent(currency: string): number {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits!
}

/** Entero en unidad menor → número para APIs que piden decimales (MP: 15.5; CLP: 1500). */
export function minorToMajor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** currencyExponent(currency)
}

/** Número decimal de una API → entero en unidad menor, sin errores de coma flotante. */
export function majorToMinor(amountMajor: number, currency: string): number {
  return Math.round(amountMajor * 10 ** currencyExponent(currency))
}
