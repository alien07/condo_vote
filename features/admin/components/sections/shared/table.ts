export function tablePage(value: number | undefined, fallback = 1) {
  return Number.isInteger(value) && value && value > 0 ? value : fallback;
}

export function tablePerPage(value: number | undefined, fallback = 25) {
  const parsed =
    Number.isInteger(value) && value && value > 0 ? value : fallback;

  return Math.min(Math.max(parsed, 10), 100);
}
