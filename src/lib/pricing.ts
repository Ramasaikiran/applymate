// Country-based pricing. Must match PRICING in
// supabase/functions/create-razorpay-order/index.ts — this file is for
// display only; the server decides what is actually charged.
//
// Rule: India pays in INR. Every other country pays in its own
// currency, same number as the USD price (US $50, UK £50, EU €50 ...).
// To add a country: add a row to COUNTRIES (and to the migration's
// allowed list + the edge function copy).

export type PaidPlanId = 'basic' | 'pro' | 'maxpro'

export interface Country { code: string; name: string; currency: string; locale: string }

export const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India',          currency: 'INR', locale: 'en-IN' },
  { code: 'US', name: 'United States',  currency: 'USD', locale: 'en-US' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', locale: 'en-GB' },
  { code: 'CA', name: 'Canada',         currency: 'CAD', locale: 'en-CA' },
  { code: 'AU', name: 'Australia',      currency: 'AUD', locale: 'en-AU' },
  { code: 'NZ', name: 'New Zealand',    currency: 'NZD', locale: 'en-NZ' },
  { code: 'SG', name: 'Singapore',      currency: 'SGD', locale: 'en-SG' },
  { code: 'DE', name: 'Germany',        currency: 'EUR', locale: 'de-DE' },
  { code: 'FR', name: 'France',         currency: 'EUR', locale: 'fr-FR' },
  { code: 'IE', name: 'Ireland',        currency: 'EUR', locale: 'en-IE' },
  { code: 'NL', name: 'Netherlands',    currency: 'EUR', locale: 'nl-NL' },
  { code: 'ES', name: 'Spain',          currency: 'EUR', locale: 'es-ES' },
  { code: 'IT', name: 'Italy',          currency: 'EUR', locale: 'it-IT' },
]

export const COUNTRY_CODES = COUNTRIES.map(c => c.code)

export function getCountry(code: string | null | undefined): Country | null {
  return COUNTRIES.find(c => c.code === code) ?? null
}

type PriceRow = { price: number; trial: number }
const INDIA: Record<PaidPlanId, PriceRow> = {
  basic:  { price: 399,  trial: 99 },
  pro:    { price: 1999, trial: 500 },
  maxpro: { price: 2999, trial: 999 },
}
const INTERNATIONAL: Record<PaidPlanId, PriceRow> = {
  basic:  { price: 10, trial: 6 },
  pro:    { price: 50, trial: 14 },
  maxpro: { price: 75, trial: 25 },
}

// Whole units of the country's currency (₹ / $ / £ / €).
export function planPrice(country: Country, plan: PaidPlanId): PriceRow {
  return country.code === 'IN' ? INDIA[plan] : INTERNATIONAL[plan]
}

export function formatMoney(amount: number, country: Country): string {
  return new Intl.NumberFormat(country.locale, {
    style: 'currency', currency: country.currency, maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)
}
