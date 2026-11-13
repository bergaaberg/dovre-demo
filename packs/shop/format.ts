/** Number formats the shop pack's tiles share. */

/** A share from 0 to 1 as a percent with one decimal, like "1.7 %". */
export const percent = (share: number) => `${(Math.round(share * 1000) / 10).toFixed(1)} %`;
