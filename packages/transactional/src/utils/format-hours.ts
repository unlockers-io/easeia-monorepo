const hours = new Intl.NumberFormat("en", { style: "unit", unit: "hour", unitDisplay: "long" });

export const formatHours = (value: number): string => hours.format(value);
