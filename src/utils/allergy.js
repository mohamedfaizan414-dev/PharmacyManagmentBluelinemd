/**
 * Advisory allergy screening. It matches the patient's recorded allergies against the medicine
 * name/generic (plus a few common drug-class aliases). It is a safety NET, not a clinical decision
 * engine – the pharmacist still verifies. Extend ALIASES as your formulary needs.
 */
const ALIASES = {
  penicillin: ["penicillin", "amoxicillin", "amoxycillin", "ampicillin", "augmentin", "clavulan", "piperacillin"],
  sulfa: ["sulfa", "sulpha", "cotrimoxazole", "sulfamethoxazole", "bactrim"],
  aspirin: ["aspirin", "acetylsalicylic", "ecosprin", "disprin"],
  nsaid: ["diclofenac", "ibuprofen", "naproxen", "aceclofenac", "voveran", "brufen"],
  cephalosporin: ["cef", "ceph"],
};

export const allergyHits = (allergies = [], ...names) => {
  const hay = names.filter(Boolean).join(" ").toLowerCase();
  if (!hay) return [];
  return allergies.filter((a) => {
    const key = String(a).toLowerCase().trim();
    if (!key) return false;
    const terms = new Set([key, ...(Object.entries(ALIASES).find(([k]) => key.includes(k))?.[1] || [])]);
    return [...terms].some((t) => hay.includes(t));
  });
};
