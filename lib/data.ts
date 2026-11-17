export const DIAG = ["Malaria", "Typhoid", "Hypertension", "Diabetes", "Tuberculosis", "Lassa Fever"];
export const STATES = ["Lagos", "Kano", "FCT", "Rivers", "Oyo", "Enugu"];
export const AGES = ["0-9", "10-19", "20-29", "30-39", "40-49", "50+"];
export const ATTRS = ["Age group", "Gender", "State", "Diagnosis", "Outcome", "Length of stay"];
export type QType = "Count" | "Mean" | "Proportion";
export type Filters = { diagnosis: string; state: string; age: string };

// Seeded synthetic dataset (24,000 de-identified records) so the demo is repeatable.
let seed = 42;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
export const RECORDS = Array.from({ length: 24000 }, () => ({
  diagnosis: DIAG[Math.floor(rnd() * rnd() * DIAG.length)],
  state: STATES[Math.floor(rnd() * rnd() * STATES.length)],
  age: AGES[Math.floor(rnd() * AGES.length)],
  recovered: rnd() < 0.82,
  stay: 1 + Math.floor(rnd() * rnd() * 30),
}));

export function trueQuery(type: QType, f: Filters) {
  const rows = RECORDS.filter(
    (r) => (!f.diagnosis || r.diagnosis === f.diagnosis) && (!f.state || r.state === f.state) && (!f.age || r.age === f.age)
  );
  const n = rows.length;
  if (type === "Count") return { value: n, n, sens: 1 };
  if (n === 0) return { value: 0, n, sens: 1 };
  if (type === "Mean") return { value: rows.reduce((a, r) => a + r.stay, 0) / n, n, sens: 29 / n }; // mean length of stay (days)
  return { value: (rows.filter((r) => r.recovered).length / n) * 100, n, sens: 100 / n }; // % recovered
}

// Laplace mechanism: noise scale b = sensitivity / epsilon
export function laplace(b: number) {
  const u = Math.random() - 0.5;
  return -b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}
