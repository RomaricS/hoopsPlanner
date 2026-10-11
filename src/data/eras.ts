export interface EraDef {
  id: number;
  name: string;
  /** Hearth (HQ) level that opens this era. */
  hqLevel: number;
  tagline: string;
}

export const ERAS: EraDef[] = [
  { id: 1, name: 'Age of the Savanna', hqLevel: 1, tagline: 'One fire, one survivor, an endless plain.' },
  { id: 2, name: 'Age of Iron', hqLevel: 4, tagline: 'The smiths of Nok turn red earth into iron.' },
  { id: 3, name: 'Age of Kingdoms', hqLevel: 7, tagline: 'Caravans of salt and gold cross the land.' },
  { id: 4, name: 'Age of Empires', hqLevel: 10, tagline: 'Stone cities rise; the griots sing your name.' },
];

export function eraForHq(hqLevel: number): EraDef {
  let era = ERAS[0];
  for (const e of ERAS) if (hqLevel >= e.hqLevel) era = e;
  return era;
}
