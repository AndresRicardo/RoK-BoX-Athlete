export const LB_PER_KG = 2.20462;

export const kgToLb = (kg) =>
  kg == null ? 0 : Math.round(Number(kg) * LB_PER_KG * 10) / 10;

export const lbToKg = (lb) =>
  lb == null ? 0 : Math.round((Number(lb) / LB_PER_KG) * 10) / 10;

export const formatWeightKg = (storedLb) =>
  storedLb == null ? null : Number(lbToKg(Number(storedLb)).toFixed(1));

export const formatWeightLb = (val) =>
  val == null ? '' : `${Math.round(Number(val) * 10) / 10} lb`;
