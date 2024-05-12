const units = ["s", "ms", "µs", "ns"] as const;
type Unit = (typeof units)[number];

export const formatTime = (count: number, unit: Unit): string => {
  const unitIndex = units.indexOf(unit);
  if (unitIndex < 0) throw new Error(`unknown time unit ${unit}`);

  const format = () => `${count.toFixed(count < 100 ? 2 : 1)}${unit}`;

  if (count >= 1000) {
    if (unitIndex === 0) return format();
    return formatTime(count / 1000, units[unitIndex - 1]);
  }

  if (count < 1) {
    if (unitIndex === units.length - 1) return format();
    return formatTime(count * 1000, units[unitIndex + 1]);
  }

  return format();
};
