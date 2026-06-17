export const LB_PER_KG = 2.2046;

export const kgToLb = (kg) => kg * LB_PER_KG;

export const lbToKg = (lb) => lb / LB_PER_KG;

export const formatWeightKg = (storedLb) =>
  storedLb == null ? null : Number(lbToKg(Number(storedLb)).toFixed(1));
