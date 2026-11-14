// Original thematic icon system.
// Every official character has a hand-crafted SVG glyph that evokes their
// ability or flavour. Custom script characters fall back to the hash-based
// geometric system so they always get *some* distinct icon.

const TEAM_COLORS = {
  townsfolk:  '#5C8AA3',
  outsider:   '#8C6A3A',
  minion:     '#6B3A4A',
  demon:      '#B33A30',
  traveller:  '#C9A24B'
};

// ── Per-character thematic glyphs ───────────────────────────────────────────
// All paths are original artwork at a 64×64 viewBox.
const CHARACTER_ICONS = {

  // ── TROUBLE BREWING ──────────────────────────────────────────────────────

  // Washerwoman: washtub with water ripples
  washerwoman: (c) => `
    <ellipse cx="32" cy="40" rx="18" ry="7" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M14 40 V28 Q32 22 50 28 V40" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M20 34 q6-4 12 0 q6 4 12 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Librarian: open book
  librarian: (c) => `
    <path d="M32 16 C32 16 20 14 14 18 L14 50 C20 46 32 48 32 48" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 16 C32 16 44 14 50 18 L50 50 C44 46 32 48 32 48" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="32" y1="16" x2="32" y2="48" stroke="${c}" stroke-width="2"/>`,

  // Investigator: magnifying glass
  investigator: (c) => `
    <circle cx="27" cy="27" r="13" fill="none" stroke="${c}" stroke-width="3"/>
    <line x1="36" y1="37" x2="50" y2="51" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>`,

  // Chef: chef's hat
  chef: (c) => `
    <path d="M20 36 h24 v6 a4 4 0 0 1-4 4 H24 a4 4 0 0 1-4-4z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M24 36 C24 28 16 26 18 18 a8 8 0 0 1 14 0 a8 8 0 0 1 14 0 C48 26 40 28 40 36" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`,

  // Empath: two hands clasped / heart between people
  empath: (c) => `
    <circle cx="18" cy="22" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="46" cy="22" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M32 42 C32 42 20 34 20 28 a6 6 0 0 1 12 4 a6 6 0 0 1 12-4 C44 34 32 42 32 42z" fill="${c}" opacity="0.8"/>`,

  // Fortune Teller: crystal ball on stand
  fortuneteller: (c) => `
    <circle cx="32" cy="28" r="14" fill="none" stroke="${c}" stroke-width="2.5"/>
    <ellipse cx="32" cy="22" rx="6" ry="3" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.6"/>
    <line x1="24" y1="42" x2="40" y2="42" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M27 42 L24 50 M37 42 L40 50" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Undertaker: coffin
  undertaker: (c) => `
    <path d="M24 12 h16 l6 8 v28 a4 4 0 0 1-4 4 H22 a4 4 0 0 1-4-4 V20z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="18" y1="20" x2="46" y2="20" stroke="${c}" stroke-width="2"/>
    <line x1="26" y1="32" x2="38" y2="32" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="32" y1="26" x2="32" y2="38" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Monk: monk's hood / cowl
  monk: (c) => `
    <path d="M32 12 C20 12 16 22 16 32 C16 42 20 50 32 52 C44 50 48 42 48 32 C48 22 44 12 32 12z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M22 28 C22 28 24 22 32 22 C40 22 42 28 42 28" fill="none" stroke="${c}" stroke-width="2"/>
    <ellipse cx="32" cy="38" rx="8" ry="5" fill="none" stroke="${c}" stroke-width="2"/>`,

  // Ravenkeeper: raven / bird
  ravenkeeper: (c) => `
    <path d="M14 30 C14 20 22 14 30 16 C24 18 22 24 26 26 C30 18 40 14 46 20 C50 28 44 38 36 40 L38 50 L30 46 L28 50 L26 40 C18 38 14 34 14 30z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="38" cy="20" r="2" fill="${c}"/>`,

  // Virgin: dove / white bird shape
  virgin: (c) => `
    <path d="M32 18 C24 14 14 20 14 28 C14 34 20 36 28 34 L28 44 L32 50 L36 44 L36 34 C44 36 50 34 50 28 C50 20 40 14 32 18z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 18 L32 28" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Slayer: sword
  slayer: (c) => `
    <line x1="32" y1="10" x2="32" y2="46" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <line x1="20" y1="32" x2="44" y2="32" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M30 46 L32 54 L34 46" fill="${c}"/>`,

  // Soldier: helmet
  soldier: (c) => `
    <path d="M16 36 C16 24 22 14 32 14 C42 14 48 24 48 36z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="12" y1="36" x2="52" y2="36" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="28" y1="36" x2="28" y2="44" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="36" y1="36" x2="36" y2="44" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Mayor: crown
  mayor: (c) => `
    <path d="M14 44 L14 28 L22 36 L32 18 L42 36 L50 28 L50 44 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="12" y1="44" x2="52" y2="44" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="18" r="3" fill="${c}"/>`,

  // Butler: serving tray
  butler: (c) => `
    <ellipse cx="32" cy="36" rx="18" ry="5" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="32" y1="36" x2="32" y2="18" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="24" r="6" fill="none" stroke="${c}" stroke-width="2"/>
    <path d="M26 36 L22 50 M38 36 L42 50" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Drunk: wine bottle
  drunk: (c) => `
    <path d="M28 12 L28 22 C22 26 20 32 20 38 a12 12 0 0 0 24 0 C44 32 42 26 36 22 L36 12 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="28" y1="12" x2="36" y2="12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M24 36 q8-4 16 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Recluse: cloaked figure / hood
  recluse: (c) => `
    <circle cx="32" cy="20" r="8" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M16 52 C16 38 22 30 32 30 C42 30 48 38 48 52" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M22 52 C22 42 26 36 32 36 C38 36 42 42 42 52" fill="${c}" opacity="0.25"/>`,

  // Saint: halo
  saint: (c) => `
    <circle cx="32" cy="24" r="10" fill="none" stroke="${c}" stroke-width="2.5"/>
    <ellipse cx="32" cy="16" rx="14" ry="4" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M22 34 C22 44 26 50 32 52 C38 50 42 44 42 34" fill="none" stroke="${c}" stroke-width="2.5"/>`,

  // Poisoner: vial / poison bottle
  poisoner: (c) => `
    <path d="M26 14 L26 24 L18 36 a10 10 0 0 0 28 0 L38 24 L38 14 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="24" y1="14" x2="40" y2="14" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M22 38 q10-6 20 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="32" cy="42" r="3" fill="${c}" opacity="0.7"/>`,

  // Spy: eye with rays (surveillance)
  spy: (c) => `
    <ellipse cx="32" cy="32" rx="18" ry="10" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="5" fill="${c}"/>
    <g stroke="${c}" stroke-width="1.5" stroke-linecap="round" opacity="0.6">
      <line x1="32" y1="14" x2="32" y2="18"/>
      <line x1="32" y1="46" x2="32" y2="50"/>
      <line x1="14" y1="32" x2="18" y2="32"/>
      <line x1="46" y1="32" x2="50" y2="32"/>
    </g>`,

  // Scarlet Woman: spider web
  scarletwoman: (c) => `
    <circle cx="32" cy="32" r="16" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.5"/>
    <circle cx="32" cy="32" r="8" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.5"/>
    <circle cx="32" cy="32" r="3" fill="${c}"/>
    <g stroke="${c}" stroke-width="1.5" stroke-linecap="round">
      <line x1="32" y1="16" x2="32" y2="48"/>
      <line x1="16" y1="32" x2="48" y2="32"/>
      <line x1="20" y1="20" x2="44" y2="44"/>
      <line x1="44" y1="20" x2="20" y2="44"/>
    </g>`,

  // Baron: top hat
  baron: (c) => `
    <rect x="24" y="14" width="16" height="22" rx="2" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="16" y1="36" x2="48" y2="36" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <path d="M20 36 L18 44 L46 44 L44 36" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`,

  // Imp: devil horns and tail
  imp: (c) => `
    <path d="M18 28 C14 18 18 10 24 14 C20 18 22 24 26 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M46 28 C50 18 46 10 40 14 C44 18 42 24 38 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M22 24 C22 36 26 44 32 46 C38 44 42 36 42 24 C42 18 38 14 32 14 C26 14 22 18 22 24z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M32 46 C32 46 28 50 32 54 C34 52 36 50 32 46z" fill="${c}"/>`,

  // ── SECTS & VIOLETS ───────────────────────────────────────────────────────

  // Clockmaker: clock face
  clockmaker: (c) => `
    <circle cx="32" cy="32" r="18" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="32" y1="18" x2="32" y2="32" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="32" y1="32" x2="42" y2="38" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="32" cy="32" r="2" fill="${c}"/>
    <line x1="32" y1="14" x2="32" y2="16"/><line x1="32" y1="48" x2="32" y2="50"/>
    <line x1="14" y1="32" x2="16" y2="32"/><line x1="48" y1="32" x2="50" y2="32"/>`,

  // Dreamer: crescent moon with stars
  dreamer: (c) => `
    <path d="M38 14 a18 18 0 1 0 0 36 14 14 0 1 1 0-36z" fill="${c}" opacity="0.25" stroke="${c}" stroke-width="2.5"/>
    <circle cx="46" cy="20" r="2" fill="${c}"/>
    <circle cx="50" cy="30" r="1.5" fill="${c}" opacity="0.7"/>
    <circle cx="44" cy="12" r="1.5" fill="${c}" opacity="0.7"/>`,

  // Snake Charmer: snake coil
  snakecharmer: (c) => `
    <path d="M32 48 C20 48 16 40 20 34 C24 28 34 30 36 24 C38 18 32 12 26 14" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M24 12 C22 10 28 8 28 12 C28 16 22 14 24 18" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="36" cy="48" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>`,

  // Mathematician: sigma / equation
  mathematician: (c) => `
    <path d="M44 16 L20 16 L34 32 L20 48 L44 48" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,

  // Flowergirl: flower
  flowergirl: (c) => `
    <circle cx="32" cy="32" r="5" fill="${c}"/>
    <circle cx="32" cy="20" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="32" cy="44" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="20" cy="32" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="44" cy="32" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>`,

  // Town Crier: megaphone / horn
  towncrier: (c) => `
    <path d="M16 26 L16 38 L26 38 L44 50 L44 14 L26 26 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M16 28 C12 28 10 30 10 32 C10 34 12 36 16 36" fill="none" stroke="${c}" stroke-width="2"/>`,

  // Oracle: all-seeing eye triangle
  oracle: (c) => `
    <polygon points="32,10 52,46 12,46" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="32" cy="36" rx="9" ry="6" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="32" cy="36" r="3" fill="${c}"/>`,

  // Savant: two speech bubbles
  savant: (c) => `
    <path d="M14 18 h22 a4 4 0 0 1 4 4 v10 a4 4 0 0 1-4 4 H24 L18 42 L20 36 H18 a4 4 0 0 1-4-4 V22 a4 4 0 0 1 4-4z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 40 h14 a4 4 0 0 1 4 4 v6 a4 4 0 0 1-4 4 H34 L38 60" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`,

  // Seamstress: needle and thread
  seamstress: (c) => `
    <line x1="14" y1="50" x2="50" y2="14" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="46" cy="18" rx="6" ry="4" transform="rotate(-45 46 18)" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="44" cy="16" r="2" fill="${c}"/>
    <path d="M14 50 C16 44 20 40 26 40 C32 40 36 44 32 50" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Philosopher: thought bubble / lightbulb
  philosopher: (c) => `
    <circle cx="32" cy="26" r="12" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M26 38 L26 44 L38 44 L38 38" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="28" y1="44" x2="36" y2="44" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="32" y1="14" x2="32" y2="10" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Artist: paintbrush
  artist: (c) => `
    <path d="M44 12 L20 44 C18 48 14 50 12 52 C14 50 20 48 22 46 L50 20 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M20 44 C18 48 14 50 12 52 C16 52 20 50 22 46" fill="${c}" opacity="0.6"/>
    <circle cx="44" cy="14" r="4" fill="none" stroke="${c}" stroke-width="2"/>`,

  // Juggler: three balls arc
  juggler: (c) => `
    <circle cx="20" cy="20" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="44" cy="20" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="32" cy="12" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M22 26 C24 36 28 42 32 44 C36 42 40 36 42 26" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Sage: open eye (wisdom)
  sage: (c) => `
    <path d="M10 32 C16 20 24 14 32 14 C40 14 48 20 54 32 C48 44 40 50 32 50 C24 50 16 44 10 32z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="8" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="3" fill="${c}"/>`,

  // Barber: scissors
  barber: (c) => `
    <circle cx="22" cy="22" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="42" cy="22" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="26" y1="26" x2="48" y2="48" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="38" y1="26" x2="16" y2="48" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Klutz: falling star / trip symbol
  klutz: (c) => `
    <path d="M32 12 L35 22 L46 22 L37 29 L40 40 L32 34 L24 40 L27 29 L18 22 L29 22 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="24" y1="44" x2="40" y2="52" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Moonchild: crescent with glow
  moonchild: (c) => `
    <path d="M40 14 a18 18 0 1 0 0 36 14 14 0 1 1 0-36z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="44" cy="20" r="2.5" fill="${c}"/>
    <circle cx="48" cy="32" r="2" fill="${c}" opacity="0.7"/>`,

  moonchild2: (c) => `
    <path d="M40 14 a18 18 0 1 0 0 36 14 14 0 1 1 0-36z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="44" cy="20" r="2.5" fill="${c}"/>
    <circle cx="48" cy="32" r="2" fill="${c}" opacity="0.7"/>`,

  // Goon: puppet strings
  goon: (c) => `
    <circle cx="32" cy="40" r="10" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="26" y1="30" x2="20" y2="14" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="32" y1="30" x2="32" y2="12" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="38" y1="30" x2="44" y2="14" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="16" y1="12" x2="48" y2="12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Godfather: tommy gun / fedora
  godfather: (c) => `
    <path d="M16 30 h32 a4 4 0 0 1 0 8 H16 a4 4 0 0 1 0-8z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M20 30 C20 22 24 16 32 16 C40 16 44 22 44 30" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="12" y1="38" x2="52" y2="38" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Devil's Advocate: scales of justice
  devilsadvocate: (c) => `
    <line x1="32" y1="12" x2="32" y2="52" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="16" y1="22" x2="48" y2="22" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M16 22 L12 34 a8 8 0 0 0 8 0 Z" fill="none" stroke="${c}" stroke-width="2"/>
    <path d="M48 22 L44 34 a8 8 0 0 0 8 0 Z" fill="none" stroke="${c}" stroke-width="2"/>`,

  deviant: (c) => `
    <line x1="32" y1="12" x2="32" y2="52" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="16" y1="22" x2="48" y2="22" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M16 22 L12 34 a8 8 0 0 0 8 0 Z" fill="none" stroke="${c}" stroke-width="2"/>
    <path d="M48 22 L44 34 a8 8 0 0 0 8 0 Z" fill="none" stroke="${c}" stroke-width="2"/>`,

  // Evil Twin: mirror / two faces
  evilTwin: (c) => `
    <line x1="32" y1="10" x2="32" y2="54" stroke="${c}" stroke-width="2" stroke-dasharray="3 3"/>
    <circle cx="22" cy="28" r="8" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M16 44 C16 38 18 36 22 36 C26 36 28 38 28 44" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="42" cy="28" r="8" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M36 44 C36 38 38 36 42 36 C46 36 48 38 48 44" fill="none" stroke="${c}" stroke-width="2.5"/>`,

  // Witch: pointed hat
  witch: (c) => `
    <path d="M32 10 L16 44 h32 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="32" cy="44" rx="14" ry="5" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M28 28 q4 4 8 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Pukka: plague mask / beak
  pukka: (c) => `
    <circle cx="32" cy="24" r="12" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M26 36 L28 52 L32 48 L36 52 L38 36" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="27" cy="22" r="3" fill="${c}" opacity="0.7"/>
    <circle cx="37" cy="22" r="3" fill="${c}" opacity="0.7"/>`,

  // Pit-Hag: cauldron
  pithag: (c) => `
    <path d="M18 32 C18 44 24 52 32 52 C40 52 46 44 46 32" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="14" y1="32" x2="50" y2="32" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M22 32 C20 26 24 20 22 14 M32 32 C32 26 34 20 32 12 M42 32 C44 26 40 20 42 14" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  pithag2: (c) => `
    <path d="M18 32 C18 44 24 52 32 52 C40 52 46 44 46 32" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="14" y1="32" x2="50" y2="32" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M22 32 C20 26 24 20 22 14 M32 32 C32 26 34 20 32 12 M42 32 C44 26 40 20 42 14" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Fang Gu: fanged mouth
  fanggu: (c) => `
    <path d="M12 32 C12 24 20 16 32 16 C44 16 52 24 52 32 C52 40 44 48 32 48 C20 48 12 40 12 32z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M20 34 L20 42 M26 34 L26 44 M32 34 L32 46 M38 34 L38 44 M44 34 L44 42" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="18" y1="34" x2="46" y2="34" stroke="${c}" stroke-width="2"/>`,

  // Vigormortis: skeleton hand
  vigormortis: (c) => `
    <path d="M32 50 L32 28" stroke="${c}" stroke-width="4" stroke-linecap="round"/>
    <path d="M24 48 L22 28" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <path d="M40 48 L42 28" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <path d="M18 46 L14 30" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M46 46 L50 30" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M14 28 C18 22 26 20 32 22 C38 20 46 22 50 28 C46 32 38 30 32 30 C26 30 18 32 14 28z" fill="none" stroke="${c}" stroke-width="2"/>`,

  // No Dashii: shadow / dark cloud
  noDashii: (c) => `
    <path d="M14 38 C10 30 16 20 24 20 C26 14 32 10 38 12 C44 8 52 14 50 22 C54 24 56 32 52 38 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M20 38 L16 50 M30 38 L28 50 M40 38 L42 50 M50 38 L52 50" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // ── BAD MOON RISING ───────────────────────────────────────────────────────

  // Grandmother: rocking chair / knitting needles
  grandmother: (c) => `
    <path d="M22 44 C18 38 18 28 22 22 C26 16 38 16 42 22 C46 28 46 38 42 44" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="20" y1="44" x2="44" y2="44" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="26" y1="20" x2="24" y2="52" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="38" y1="20" x2="40" y2="52" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Sailor: ship's anchor
  sailor: (c) => `
    <circle cx="32" cy="20" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="32" y1="26" x2="32" y2="50" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="18" y1="34" x2="46" y2="34" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M18 34 C18 44 24 50 32 50 C40 50 46 44 46 34" fill="none" stroke="${c}" stroke-width="2"/>`,

  // Chambermaid: pillow / bed
  chambermaid: (c) => `
    <rect x="14" y="28" width="36" height="22" rx="4" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M14 36 h36" stroke="${c}" stroke-width="1.5" opacity="0.5"/>
    <ellipse cx="32" cy="28" rx="12" ry="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="14" y1="44" x2="50" y2="44" stroke="${c}" stroke-width="1.5" opacity="0.4"/>`,

  // Exorcist: crucifix
  exorcist: (c) => `
    <line x1="32" y1="10" x2="32" y2="54" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <line x1="18" y1="24" x2="46" y2="24" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,

  // Innkeeper: tankard / mug
  innkeeper: (c) => `
    <path d="M18 20 h22 v28 a4 4 0 0 1-4 4 H22 a4 4 0 0 1-4-4 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M40 26 C46 26 50 28 50 34 C50 40 46 40 40 40" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M22 28 q5 4 10 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Gambler: playing card / diamond suit
  gambler: (c) => `
    <rect x="18" y="14" width="28" height="36" rx="4" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M32 20 L36 28 L32 36 L28 28 Z" fill="${c}" opacity="0.7"/>
    <text x="20" y="26" font-size="8" fill="${c}" font-family="serif">A</text>
    <text x="36" y="48" font-size="8" fill="${c}" font-family="serif" transform="rotate(180 40 44)">A</text>`,

  // Gossip: speech bubble with exclamation
  gossip: (c) => `
    <path d="M12 16 h32 a4 4 0 0 1 4 4 v16 a4 4 0 0 1-4 4 H24 L14 46 L18 40 H16 a4 4 0 0 1-4-4 V20 a4 4 0 0 1 4-4z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="32" y1="24" x2="32" y2="33" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="32" cy="37" r="2" fill="${c}"/>`,

  // Courtier: jester / scepter
  courtier: (c) => `
    <circle cx="32" cy="16" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="32" y1="22" x2="32" y2="44" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M22 30 L16 26 L20 34 Z" fill="${c}" opacity="0.7"/>
    <path d="M42 30 L48 26 L44 34 Z" fill="${c}" opacity="0.7"/>
    <line x1="22" y1="44" x2="42" y2="44" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Professor: mortarboard cap
  professor: (c) => `
    <polygon points="32,14 52,24 32,28 12,24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M46 26 L46 38 C42 42 36 44 32 44 C28 44 22 42 18 38 L18 26" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="52" y1="24" x2="52" y2="36" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="52" cy="38" r="3" fill="${c}"/>`,

  // Minstrel: music note
  minstrel: (c) => `
    <path d="M38 14 L38 38 a6 6 0 1 1-4-6 V18 L26 20 V42 a6 6 0 1 1-4-6 V16 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`,

  // Tea Lady: teacup
  tealady: (c) => `
    <path d="M18 26 h28 L42 46 a4 4 0 0 1-4 4 H26 a4 4 0 0 1-4-4 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M46 30 C52 30 54 34 54 38 C54 42 52 44 46 44" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="14" y1="26" x2="50" y2="26" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M26 22 C26 18 30 16 32 18 C34 16 38 18 38 22" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Pacifist: peace dove
  pacifist: (c) => `
    <path d="M32 18 C24 14 14 20 14 28 C14 34 20 36 28 34" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M28 34 L26 46 L32 42 L38 46 L36 34 C44 36 50 34 50 28 C50 20 40 14 32 18z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`,

  // Fool: jester bells
  fool: (c) => `
    <path d="M20 38 C20 28 26 16 32 16 C38 16 44 28 44 38" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M20 38 C16 34 12 30 16 26 C18 22 22 24 24 28" fill="none" stroke="${c}" stroke-width="2"/>
    <path d="M44 38 C48 34 52 30 48 26 C46 22 42 24 40 28" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="20" cy="40" r="4" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="44" cy="40" r="4" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="32" cy="16" r="4" fill="none" stroke="${c}" stroke-width="2"/>`,

  // Tinker: wrench
  tinker: (c) => `
    <path d="M18 46 L40 24 C40 24 44 16 50 18 C48 22 46 22 46 22 C46 22 46 26 42 26 C42 26 42 22 38 24 L16 46 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="20" cy="44" r="5" fill="none" stroke="${c}" stroke-width="2"/>`,

  // Lunatic: spiral eyes
  lunatic: (c) => `
    <circle cx="32" cy="28" r="14" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M26 26 C26 24 28 22 28 24 C28 26 26 28 28 28 C30 28 30 26 30 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M34 26 C34 24 36 22 36 24 C36 26 34 28 36 28 C38 28 38 26 38 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M26 34 q6 6 12 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M22 44 L26 52 M42 44 L38 52" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Mutant / Politician - silhouette speaker
  tinkerOutsider: (c) => `
    <circle cx="32" cy="22" r="10" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M18 52 C18 40 24 34 32 34 C40 34 46 40 46 52" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  linkedevilTwin: (c) => `
    <circle cx="32" cy="22" r="10" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M18 52 C18 40 24 34 32 34 C40 34 46 40 46 52" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Sweetheart: heart
  sweetheart: (c) => `
    <path d="M32 46 C32 46 12 34 12 22 a10 10 0 0 1 20-4 a10 10 0 0 1 20 4 C52 34 32 46 32 46z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`,

  // Barber (BMR): comb
  barber2: (c) => `
    <rect x="14" y="26" width="36" height="8" rx="2" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="20" y1="34" x2="20" y2="46" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="26" y1="34" x2="26" y2="46" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="32" y1="34" x2="32" y2="46" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="38" y1="34" x2="38" y2="46" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="44" y1="34" x2="44" y2="46" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Godfather (BMR): same as S&V version
  godfather2: (c) => `
    <path d="M16 30 h32 a4 4 0 0 1 0 8 H16 a4 4 0 0 1 0-8z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M20 30 C20 22 24 16 32 16 C40 16 44 22 44 30" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="12" y1="38" x2="52" y2="38" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Mezepheles: whisper / ear
  mezepheles: (c) => `
    <path d="M22 20 C22 14 28 10 36 12 C44 14 48 22 46 30 C44 38 36 40 32 36 C28 32 30 26 34 26 C38 26 38 30 36 30" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M30 36 L28 46 L36 42" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,

  // Vortox: vortex spiral
  vortox: (c) => `
    <path d="M32 32 C32 24 38 20 42 24 C46 28 44 36 38 38 C32 40 24 36 22 28 C20 20 26 12 34 12 C44 12 52 22 50 32 C48 44 36 50 26 46" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Ojo: eye with target rings
  ojo: (c) => `
    <circle cx="32" cy="32" r="18" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.4"/>
    <circle cx="32" cy="32" r="10" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="32" cy="32" r="4" fill="${c}"/>
    <line x1="32" y1="10" x2="32" y2="18" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="32" y1="46" x2="32" y2="54" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="10" y1="32" x2="18" y2="32" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="46" y1="32" x2="54" y2="32" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Al-Hadikhia: three chains
  alhadikhia: (c) => `
    <circle cx="22" cy="16" r="5" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="32" cy="16" r="5" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="42" cy="16" r="5" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="22" y1="21" x2="22" y2="50" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="32" y1="21" x2="32" y2="50" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="42" y1="21" x2="42" y2="50" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M18 50 h8 M28 50 h8 M38 50 h8" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Legion: many figures
  legion: (c) => `
    <circle cx="18" cy="24" r="6" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="32" cy="20" r="6" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="46" cy="24" r="6" fill="none" stroke="${c}" stroke-width="2"/>
    <path d="M10 48 C10 40 14 36 18 36 C22 36 25 39 26 43" fill="none" stroke="${c}" stroke-width="2"/>
    <path d="M22 48 C22 38 26 34 32 34 C38 34 42 38 42 48" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M38 43 C39 39 42 36 46 36 C50 36 54 40 54 48" fill="none" stroke="${c}" stroke-width="2"/>`,

  // Leviathan: sea serpent / wave beast
  leviathan: (c) => `
    <path d="M10 38 C14 28 20 24 28 28 C36 32 40 26 46 22 C50 18 54 22 54 28" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M54 28 C54 36 50 40 44 38 C38 36 34 42 28 44 C22 46 14 44 10 38" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="52" cy="22" r="3" fill="${c}"/>`,

  // ── TRAVELLERS ────────────────────────────────────────────────────────────

  // Scapegoat: goat horns
  scapegoat: (c) => `
    <circle cx="32" cy="34" r="12" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M24 24 C20 14 14 12 16 20" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M40 24 C44 14 50 12 48 20" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="28" cy="32" r="2" fill="${c}"/>
    <circle cx="36" cy="32" r="2" fill="${c}"/>
    <path d="M28 38 q4 4 8 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Gunslinger: revolver / six-shooter
  gunslinger: (c) => `
    <rect x="14" y="28" width="26" height="14" rx="3" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="40" y1="32" x2="52" y2="30" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <rect x="18" y="24" width="12" height="6" rx="1" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="22" cy="42" r="4" fill="none" stroke="${c}" stroke-width="2"/>`,

  // Beggar: outstretched hand / bowl
  beggar: (c) => `
    <path d="M18 36 C18 30 24 26 32 26 C40 26 46 30 46 36" fill="none" stroke="${c}" stroke-width="2.5"/>
    <ellipse cx="32" cy="36" rx="14" ry="5" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M22 26 L20 14 M32 26 L32 12 M42 26 L44 14" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Bureaucrat: rubber stamp
  bureaucrat: (c) => `
    <rect x="20" y="30" width="24" height="16" rx="2" fill="none" stroke="${c}" stroke-width="2.5"/>
    <rect x="24" y="20" width="16" height="12" rx="2" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="28" y1="34" x2="36" y2="34" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="28" y1="38" x2="36" y2="38" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="28" y1="42" x2="32" y2="42" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Thief: bag with dollar sign
  thief: (c) => `
    <circle cx="32" cy="34" r="14" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M26 28 C26 24 30 22 32 22 C34 22 36 24 38 22 C36 20 32 18 28 22" fill="none" stroke="${c}" stroke-width="2"/>
    <line x1="32" y1="28" x2="32" y2="40" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M28 30 h8 M28 38 h8" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Butcher: cleaver
  butcher: (c) => `
    <path d="M18 16 h26 a4 4 0 0 1 0 20 H18 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="18" y1="28" x2="44" y2="28" stroke="${c}" stroke-width="1.5" opacity="0.5"/>
    <line x1="22" y1="36" x2="22" y2="52" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,

  // Bone Collector: skull
  bonecollector: (c) => `
    <circle cx="32" cy="26" r="14" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="26" cy="24" r="3" fill="${c}"/>
    <circle cx="38" cy="24" r="3" fill="${c}"/>
    <path d="M22 34 h6 v6 h8 v-6 h6" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`,

  // Harlot: comedy/tragedy masks
  harlot: (c) => `
    <circle cx="22" cy="28" r="10" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M18 30 q4 6 8 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="42" cy="32" r="10" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M38 36 q4-6 8 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Barista: coffee cup with steam
  barista: (c) => `
    <path d="M20 28 h24 L40 50 H24 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M40 32 C46 32 50 36 50 40 C50 44 46 44 40 44" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M26 24 C26 20 28 18 26 14 M32 24 C32 20 34 18 32 14 M38 24 C38 20 40 18 38 14" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Apprentice: graduation scroll
  apprentice: (c) => `
    <path d="M18 20 C18 16 22 14 32 14 C42 14 46 16 46 20 L46 44 C46 48 42 50 32 50 C22 50 18 48 18 44 Z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="18" y1="26" x2="46" y2="26" stroke="${c}" stroke-width="2"/>
    <line x1="24" y1="32" x2="40" y2="32" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="24" y1="38" x2="36" y2="38" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M14 14 L18 20 M50 14 L46 20" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Matron: two chairs
  matron: (c) => `
    <path d="M16 22 v20 M28 22 v20" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="14" y1="36" x2="30" y2="36" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="16" y1="28" x2="28" y2="28" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <path d="M36 22 v20 M48 22 v20" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="34" y1="36" x2="50" y2="36" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="36" y1="28" x2="48" y2="28" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <path d="M30 40 C30 44 34 46 32 50 M34 40 C34 44 38 46 36 50" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Voudon: voodoo doll / pins
  voudon: (c) => `
    <path d="M26 14 C22 14 18 18 18 26 C18 38 26 48 32 52 C38 48 46 38 46 26 C46 18 42 14 38 14 C36 14 34 16 32 16 C30 16 28 14 26 14z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="28" y1="24" x2="28" y2="34" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="36" y1="24" x2="36" y2="34" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="22" y1="30" x2="42" y2="30" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Judge: gavel
  judge: (c) => `
    <rect x="30" y="12" width="20" height="12" rx="3" transform="rotate(45 40 18)" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="28" y1="36" x2="14" y2="50" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <line x1="14" y1="46" x2="22" y2="54" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,

  // Bishop: bishop chess piece / mitre
  bishop: (c) => `
    <path d="M32 10 C28 10 24 14 24 20 C24 28 28 34 32 36 C36 34 40 28 40 20 C40 14 36 10 32 10z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="32" cy="18" r="4" fill="none" stroke="${c}" stroke-width="2"/>
    <line x1="20" y1="44" x2="44" y2="44" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="18" y1="50" x2="46" y2="50" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="32" y1="36" x2="32" y2="44" stroke="${c}" stroke-width="2.5"/>`,

  // Cacklejack: jester hat with bells
  cacklejack: (c) => `
    <path d="M16 42 C20 30 24 20 32 16" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M32 16 C38 8 48 14 44 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M44 24 C50 18 56 28 48 34" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="16" y1="42" x2="48" y2="42" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="16" cy="44" r="4" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="32" cy="16" r="4" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="48" cy="36" r="4" fill="none" stroke="${c}" stroke-width="2"/>`,

  // Gangster: tommy gun / violin case
  gangster: (c) => `
    <rect x="14" y="26" width="36" height="16" rx="4" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="14" y1="34" x2="50" y2="34" stroke="${c}" stroke-width="1.5" opacity="0.5"/>
    <circle cx="20" cy="30" r="2.5" fill="${c}" opacity="0.6"/>
    <circle cx="20" cy="38" r="2.5" fill="${c}" opacity="0.6"/>
    <line x1="50" y1="30" x2="56" y2="28" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Gnome: pointed hat + beard
  gnome: (c) => `
    <path d="M32 10 L18 36 h28 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="32" cy="36" r="10" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M24 44 C24 50 28 54 32 54 C36 54 40 50 40 44" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="32" cy="34" r="2" fill="${c}"/>`,

  // ── EXPERIMENTAL TOWNSFOLK ──────────────────────────────────────────────────

  // Acrobat: tumbling figure tracing an arc
  acrobat: (c) => `
    <path d="M18 42 C18 30 26 18 36 14 C46 10 52 16 50 26 C48 36 38 40 32 46 C28 50 20 52 18 48" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="46" cy="16" r="5" fill="none" stroke="${c}" stroke-width="2.5"/>`,

  // Alchemist: round-bottomed flask with bubbles
  alchemist: (c) => `
    <path d="M28 12 L28 28 L16 44 a12 12 0 0 0 32 0 L36 28 L36 12 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="26" y1="12" x2="38" y2="12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M20 40 q6-3 12 0 q6 3 12 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
    <circle cx="24" cy="46" r="2" fill="${c}" opacity="0.8"/>
    <circle cx="34" cy="38" r="1.5" fill="${c}" opacity="0.7"/>
    <circle cx="42" cy="48" r="1.5" fill="${c}" opacity="0.6"/>`,

  // Amnesiac: head silhouette with question mark
  amnesiac: (c) => `
    <circle cx="32" cy="26" r="14" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M27 21 C27 17 29 15 32 15 C35 15 37 17 37 21 C37 25 33 27 32 30" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="34" r="2" fill="${c}"/>`,

  // Atheist: halo slashed through with an X
  atheist: (c) => `
    <ellipse cx="32" cy="18" rx="14" ry="5" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="22" y1="12" x2="42" y2="24" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="42" y1="12" x2="22" y2="24" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="38" r="10" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M25 46 C25 50 30 52 32 52 C34 52 39 50 39 46" fill="none" stroke="${c}" stroke-width="2.5"/>`,

  // Balloonist: hot air balloon
  balloonist: (c) => `
    <path d="M32 10 C20 10 14 20 14 28 C14 38 22 44 32 44 C42 44 50 38 50 28 C50 20 44 10 32 10z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M26 44 L22 54 L42 54 L38 44" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="26" y1="44" x2="22" y2="54" stroke="${c}" stroke-width="2"/>
    <line x1="38" y1="44" x2="42" y2="54" stroke="${c}" stroke-width="2"/>
    <path d="M32 10 L32 44 M14 28 L50 28" stroke="${c}" stroke-width="1.5" opacity="0.35" stroke-dasharray="3 3"/>`,

  // Banshee: wailing spirit with trailing form
  banshee: (c) => `
    <path d="M18 12 C18 6 26 4 32 6 C38 4 46 6 46 12 C46 20 42 30 40 38 L44 50 L36 44 L32 50 L28 44 L20 50 L24 38 C22 30 18 22 18 12z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M26 22 q6-4 12 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Bounty Hunter: targeting crosshair
  bountyHunter: (c) => `
    <circle cx="32" cy="32" r="16" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="4" fill="${c}"/>
    <line x1="32" y1="12" x2="32" y2="22" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="32" y1="42" x2="32" y2="52" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="12" y1="32" x2="22" y2="32" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="42" y1="32" x2="52" y2="32" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Cannibal: fork and knife crossed
  cannibal: (c) => `
    <line x1="24" y1="12" x2="24" y2="52" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <path d="M20 12 L20 26 C20 30 24 32 28 28 L28 12" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="40" y1="12" x2="40" y2="52" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <path d="M36 12 L36 20 M40 12 L40 20 M44 12 L44 20" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M36 20 C36 22 38 26 40 28 C42 26 44 22 44 20" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Choirboy: singing open mouth + music notes
  choirboy: (c) => `
    <circle cx="28" cy="34" r="12" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M22 36 q6 6 12 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="25" cy="31" r="2" fill="${c}"/>
    <circle cx="31" cy="31" r="2" fill="${c}"/>
    <line x1="44" y1="14" x2="44" y2="24" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="50" y1="12" x2="50" y2="22" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="44" y1="14" x2="50" y2="12" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="42" cy="25" r="3" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="48" cy="23" r="3" fill="none" stroke="${c}" stroke-width="2"/>`,

  // Cult Leader: central figure with arms commanding two followers
  cultLeader: (c) => `
    <circle cx="32" cy="16" r="7" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="32" y1="23" x2="32" y2="38" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M18 32 L32 27 L46 32" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M26 52 C26 44 30 40 32 40 C34 40 38 44 38 52" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="16" cy="34" r="4" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="48" cy="34" r="4" fill="none" stroke="${c}" stroke-width="2"/>`,

  // Engineer: cog/gear with centre hole
  engineer: (c) => `
    <circle cx="32" cy="32" r="10" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="3.5" fill="${c}" opacity="0.7"/>
    <g stroke="${c}" stroke-width="3" stroke-linecap="round">
      <line x1="32" y1="12" x2="32" y2="18"/>
      <line x1="32" y1="46" x2="32" y2="52"/>
      <line x1="12" y1="32" x2="18" y2="32"/>
      <line x1="46" y1="32" x2="52" y2="32"/>
      <line x1="18" y1="18" x2="22" y2="22"/>
      <line x1="42" y1="42" x2="46" y2="46"/>
      <line x1="46" y1="18" x2="42" y2="22"/>
      <line x1="22" y1="42" x2="18" y2="46"/>
    </g>`,

  // Farmer: wheat sheaf bound in the middle
  farmer: (c) => `
    <line x1="32" y1="52" x2="32" y2="22" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M32 24 C28 16 22 16 22 22 C22 28 28 30 32 26" fill="none" stroke="${c}" stroke-width="2"/>
    <path d="M32 28 C28 20 20 20 20 26 C20 32 26 34 32 30" fill="none" stroke="${c}" stroke-width="2"/>
    <path d="M32 24 C36 16 42 16 42 22 C42 28 36 30 32 26" fill="none" stroke="${c}" stroke-width="2"/>
    <path d="M32 28 C36 20 44 20 44 26 C44 32 38 34 32 30" fill="none" stroke="${c}" stroke-width="2"/>
    <path d="M24 46 h16" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,

  // Fisherman: fishing rod with line and fish
  fisherman: (c) => `
    <line x1="16" y1="52" x2="46" y2="14" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M46 14 C48 12 52 14 50 18" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="50" y1="18" x2="44" y2="42" stroke="${c}" stroke-width="1.5" stroke-dasharray="2 4" stroke-linecap="round"/>
    <path d="M36 44 C38 39 46 41 46 46 C46 51 38 51 36 46 C34 43 36 40 42 41" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="46" cy="46" r="1.5" fill="${c}"/>`,

  // Flood: three wave crests
  flood: (c) => `
    <path d="M10 24 C14 20 18 22 22 24 C26 26 30 24 34 22 C38 20 42 22 46 24 C50 26 52 24 54 22" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M10 34 C14 30 18 32 22 34 C26 36 30 34 34 32 C38 30 42 32 46 34 C50 36 52 34 54 32" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M10 44 C14 40 18 42 22 44 C26 46 30 44 34 42 C38 40 42 42 46 44 C50 46 52 44 54 42" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // General: five-point military star with ribbon
  general: (c) => `
    <path d="M32 10 L35 21 L47 21 L38 28 L41 40 L32 33 L23 40 L26 28 L17 21 L29 21 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="32" y1="40" x2="32" y2="50" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M24 50 h16" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // High Priestess: tall staff with eye atop
  highPriestess: (c) => `
    <line x1="32" y1="54" x2="32" y2="16" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="32" cy="28" rx="10" ry="6" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="32" cy="28" r="3" fill="${c}"/>
    <path d="M18 22 L44 22" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="12" r="5" fill="none" stroke="${c}" stroke-width="2.5"/>`,

  // Huntsman: strung bow with arrow drawn
  huntsman: (c) => `
    <path d="M14 10 C12 32 14 54 14 54" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <line x1="14" y1="10" x2="14" y2="54" stroke="${c}" stroke-width="1" opacity="0.2"/>
    <line x1="14" y1="32" x2="50" y2="32" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M47 28 L52 32 L47 36" fill="${c}" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>`,

  // King: three-point crown (taller/more regal than Mayor)
  king: (c) => `
    <path d="M12 48 L12 28 L20 38 L32 14 L44 38 L52 28 L52 48 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="10" y1="48" x2="54" y2="48" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="14" r="3" fill="${c}"/>
    <circle cx="12" cy="28" r="3" fill="${c}"/>
    <circle cx="52" cy="28" r="3" fill="${c}"/>`,

  // Knight: kite shield with cross
  knight: (c) => `
    <path d="M18 14 h28 v22 C46 48 40 54 32 56 C24 54 18 48 18 36 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="32" y1="14" x2="32" y2="52" stroke="${c}" stroke-width="2" opacity="0.6"/>
    <line x1="18" y1="30" x2="46" y2="30" stroke="${c}" stroke-width="2" opacity="0.6"/>`,

  // Lycanthrope: three claw gashes
  lycanthrope: (c) => `
    <path d="M20 12 C14 10 12 16 16 20 C20 24 26 24 28 20" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M28 10 C24 6 20 10 22 16 C24 22 28 24 32 22" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M36 10 C40 6 44 10 42 16 C40 22 36 24 32 22" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M26 22 L24 38 C26 46 30 52 32 54 C34 52 38 46 40 38 L38 22" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`,

  // Magician: wand with starburst
  magician: (c) => `
    <line x1="12" y1="52" x2="46" y2="18" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <path d="M46 18 L50 10 L54 18 L46 18 L40 12 Z" fill="${c}" opacity="0.8"/>
    <circle cx="22" cy="18" r="2" fill="${c}"/>
    <circle cx="48" cy="38" r="2" fill="${c}"/>
    <circle cx="36" cy="10" r="2" fill="${c}"/>
    <circle cx="54" cy="28" r="1.5" fill="${c}" opacity="0.6"/>
    <circle cx="14" cy="34" r="1.5" fill="${c}" opacity="0.6"/>`,

  // Nightwatchman: hanging lantern with flame
  nightwatchman: (c) => `
    <line x1="32" y1="10" x2="32" y2="16" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M24 16 C24 14 40 14 40 16 L40 44 C40 48 36 50 32 50 C28 50 24 48 24 44 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M24 22 h16 M24 38 h16" stroke="${c}" stroke-width="1.5" opacity="0.4"/>
    <path d="M29 28 C29 24 35 24 35 28 C35 34 32 36 32 36 C32 36 29 34 29 28z" fill="${c}" opacity="0.7" stroke="${c}" stroke-width="1.5"/>`,

  // Noble: heraldic pennant / sash
  noble: (c) => `
    <path d="M18 14 h28 v10 L32 54 L18 24 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M46 24 L32 54" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="18" r="4" fill="${c}" opacity="0.7"/>
    <path d="M22 28 h8 M22 36 h6" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Organist: four organ pipes of descending height
  organist: (c) => `
    <rect x="12" y="36" width="40" height="14" rx="2" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="18" y1="36" x2="18" y2="14" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
    <line x1="26" y1="36" x2="26" y2="18" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
    <line x1="34" y1="36" x2="34" y2="22" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
    <line x1="42" y1="36" x2="42" y2="10" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,

  // Pixie: four fairy wings around a small figure
  pixie: (c) => `
    <path d="M32 28 C22 20 10 20 12 30 C14 38 24 36 32 28z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M32 28 C42 20 54 20 52 30 C50 38 40 36 32 28z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M32 28 C24 36 22 48 28 50 C32 52 36 44 32 28z" fill="none" stroke="${c}" stroke-width="2"/>
    <path d="M32 28 C40 36 42 48 36 50 C32 52 28 44 32 28z" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="32" cy="24" r="4" fill="none" stroke="${c}" stroke-width="2.5"/>`,

  // Plague Doctor: beaked plague mask
  plagueDoctor: (c) => `
    <path d="M20 22 C20 14 26 10 32 10 C38 10 44 14 44 22 C44 30 40 36 32 38 C24 36 20 30 20 22z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M32 38 L27 50 C29 54 35 54 37 50 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="25" cy="20" r="3" fill="${c}" opacity="0.8"/>
    <circle cx="39" cy="20" r="3" fill="${c}" opacity="0.8"/>
    <line x1="22" y1="14" x2="14" y2="10" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="42" y1="14" x2="50" y2="10" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Poppy Grower: poppy flower with stem
  poppyGrower: (c) => `
    <circle cx="32" cy="22" r="12" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="32" cy="22" r="4" fill="${c}" opacity="0.8"/>
    <path d="M26 20 C22 12 20 8 24 8 C28 8 30 14 32 18" fill="${c}" opacity="0.3" stroke="${c}" stroke-width="1.5"/>
    <path d="M38 20 C42 12 44 8 40 8 C36 8 34 14 32 18" fill="${c}" opacity="0.3" stroke="${c}" stroke-width="1.5"/>
    <line x1="32" y1="34" x2="32" y2="54" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M28 44 C24 42 22 38 26 36" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Preacher: open bible with text lines
  preacher: (c) => `
    <path d="M32 16 C32 16 20 14 14 18 L14 50 C20 46 32 48 32 48" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 16 C32 16 44 14 50 18 L50 50 C44 46 32 48 32 48" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="32" y1="16" x2="32" y2="48" stroke="${c}" stroke-width="2"/>
    <line x1="18" y1="26" x2="28" y2="26" stroke="${c}" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
    <line x1="18" y1="31" x2="28" y2="31" stroke="${c}" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
    <line x1="18" y1="36" x2="26" y2="36" stroke="${c}" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
    <line x1="36" y1="26" x2="46" y2="26" stroke="${c}" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
    <line x1="36" y1="31" x2="46" y2="31" stroke="${c}" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
    <line x1="36" y1="36" x2="44" y2="36" stroke="${c}" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>`,

  // Steward: butler bow-tie
  steward: (c) => `
    <path d="M16 28 L28 32 L16 36 Z" fill="${c}" opacity="0.8" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M48 28 L36 32 L48 36 Z" fill="${c}" opacity="0.8" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="4" fill="${c}"/>
    <circle cx="32" cy="16" r="8" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M24 48 C24 42 28 40 32 40 C36 40 40 42 40 48 L40 56 L24 56 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`,

  // Storm Catcher: lightning bolt sealed inside a jar
  stormCatcher: (c) => `
    <rect x="20" y="18" width="24" height="32" rx="4" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="28" y1="12" x2="28" y2="18" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="36" y1="12" x2="36" y2="18" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M20 26 h24 M20 42 h24" stroke="${c}" stroke-width="1.5" opacity="0.35"/>
    <path d="M37 20 L28 33 L34 33 L27 50 L38 33 L32 33 Z" fill="${c}" opacity="0.7" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>`,

  // ── EXPERIMENTAL OUTSIDERS ──────────────────────────────────────────────────

  // Damsel: crown with a falling tear drop
  damsel: (c) => `
    <path d="M16 40 L16 24 L24 34 L32 14 L40 34 L48 24 L48 40 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="14" y1="40" x2="50" y2="40" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M32 46 C30 50 30 54 32 56 C34 54 34 50 32 46z" fill="${c}" opacity="0.85"/>`,

  // Golem: blocky stone humanoid
  golem: (c) => `
    <rect x="22" y="10" width="20" height="14" rx="1" fill="none" stroke="${c}" stroke-width="2.5"/>
    <rect x="18" y="24" width="28" height="18" rx="1" fill="none" stroke="${c}" stroke-width="2.5"/>
    <rect x="12" y="26" width="6" height="12" rx="1" fill="none" stroke="${c}" stroke-width="2"/>
    <rect x="46" y="26" width="6" height="12" rx="1" fill="none" stroke="${c}" stroke-width="2"/>
    <rect x="22" y="42" width="8" height="12" rx="1" fill="none" stroke="${c}" stroke-width="2"/>
    <rect x="34" y="42" width="8" height="12" rx="1" fill="none" stroke="${c}" stroke-width="2"/>
    <line x1="26" y1="15" x2="38" y2="15" stroke="${c}" stroke-width="2" opacity="0.45"/>`,

  // Heretic: dashed circle with X inside (inversion)
  heretic: (c) => `
    <circle cx="32" cy="32" r="18" fill="none" stroke="${c}" stroke-width="2.5" stroke-dasharray="4 3"/>
    <line x1="22" y1="22" x2="42" y2="42" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <line x1="42" y1="22" x2="22" y2="42" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,

  // Puzzlemaster: four-sided interlocking puzzle piece
  puzzlemaster: (c) => `
    <path d="M12 12 h16 v-4 a4 4 0 0 1 8 0 v4 h16 v16 h4 a4 4 0 0 1 0 8 h-4 v16 H36 v4 a4 4 0 0 1-8 0 v-4 H12 V36 h-4 a4 4 0 0 1 0-8 h4 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`,

  // Snitch: ear listening
  snitch: (c) => `
    <path d="M22 14 C16 18 14 26 14 32 C14 42 20 52 28 54 C32 54 34 52 34 46 C34 42 30 40 30 34 C30 28 34 26 36 26 C40 26 42 28 42 34 C42 38 38 40 38 42" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M22 14 C24 10 28 8 34 8 C44 8 50 18 50 28 C50 36 46 42 40 44" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="38" cy="46" r="3" fill="${c}" opacity="0.8"/>`,

  // ── EXPERIMENTAL MINIONS ────────────────────────────────────────────────────

  // Boomdandy: round bomb with lit fuse
  boomdandy: (c) => `
    <circle cx="28" cy="36" r="16" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M40 22 C44 18 48 14 50 12" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="52" cy="10" r="4" fill="${c}" opacity="0.9"/>
    <path d="M22 32 q4-4 8 0 q4 4 8 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="0.5"/>`,

  // Cerenovus: brain with control pulse line
  cerenovus: (c) => `
    <path d="M22 30 C22 20 26 14 32 14 C38 14 42 20 42 30 C42 36 38 40 34 40" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M28 14 C28 18 24 22 22 26" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M34 40 C28 42 24 40 22 36 C20 32 22 30 22 30" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M10 36 L18 36 L22 28 L26 44 L30 32 L34 40 L38 36 L54 36" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,

  // Fearmonger: looming shadow horns above cowering figure
  fearmonger: (c) => `
    <path d="M18 14 C14 8 20 6 24 10 C26 12 26 18 28 20" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M46 14 C50 8 44 6 40 10 C38 12 38 18 36 20" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M28 20 C28 20 32 18 36 20 C42 24 44 34 42 44" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M22 44 C20 34 22 24 28 20" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="26" cy="36" r="3" fill="${c}" opacity="0.7"/>
    <circle cx="38" cy="36" r="3" fill="${c}" opacity="0.7"/>
    <path d="M24 44 q8 6 16 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Goblin: pointed ears and mischievous face
  goblin: (c) => `
    <path d="M20 22 C14 14 18 10 24 14" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M44 22 C50 14 46 10 40 14" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="32" cy="32" rx="14" ry="16" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="26" cy="28" r="3" fill="${c}" opacity="0.8"/>
    <circle cx="38" cy="28" r="3" fill="${c}" opacity="0.8"/>
    <path d="M26 40 C28 44 36 44 38 40" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M28 38 L26 42 M36 38 L38 42" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`,

  // Marionette: cross-bar with hanging puppet on strings
  marionette: (c) => `
    <line x1="18" y1="12" x2="46" y2="12" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <line x1="32" y1="12" x2="32" y2="20" stroke="${c}" stroke-width="2.5"/>
    <line x1="14" y1="18" x2="28" y2="18" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="36" y1="18" x2="50" y2="18" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="20" y1="18" x2="26" y2="34" stroke="${c}" stroke-width="1.5" stroke-dasharray="2 2"/>
    <line x1="44" y1="18" x2="38" y2="34" stroke="${c}" stroke-width="1.5" stroke-dasharray="2 2"/>
    <line x1="32" y1="20" x2="32" y2="34" stroke="${c}" stroke-width="1.5" stroke-dasharray="2 2"/>
    <circle cx="32" cy="34" r="5" fill="none" stroke="${c}" stroke-width="2.5"/>
    <line x1="27" y1="39" x2="24" y2="52" stroke="${c}" stroke-width="1.5" stroke-dasharray="2 2"/>
    <line x1="37" y1="39" x2="40" y2="52" stroke="${c}" stroke-width="1.5" stroke-dasharray="2 2"/>`,

  // Organ Grinder: hand-crank music box with musical note
  organGrinder: (c) => `
    <rect x="14" y="26" width="28" height="22" rx="3" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M42 32 C48 30 52 34 52 38 C52 42 48 44 42 44" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="34" y1="26" x2="34" y2="18" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M34 18 L42 14 L42 22" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="42" cy="22" r="3" fill="none" stroke="${c}" stroke-width="2"/>
    <line x1="20" y1="34" x2="34" y2="34" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="20" y1="40" x2="32" y2="40" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Psychopath: two-faced cracked mask
  psychopath: (c) => `
    <path d="M14 28 C14 18 22 10 32 10 C42 10 50 18 50 28 C50 40 42 48 32 48 C22 48 14 40 14 28z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M32 10 C30 22 30 36 32 48" stroke="${c}" stroke-width="2" stroke-dasharray="3 3"/>
    <path d="M22 24 q3 3 0 7" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M38 24 q4-2 4 4" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M24 39 q8 6 14 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Summoner: summoning pentagram circle
  summoner: (c) => `
    <circle cx="32" cy="32" r="18" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="32" cy="32" r="13" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.6"/>
    <path d="M32 19 L35 28 L45 28 L37 34 L40 44 L32 38 L24 44 L27 34 L19 28 L29 28 Z" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`,

  // Widow: black widow spider with widow's peak silhouette
  widow: (c) => `
    <path d="M32 14 C28 18 22 22 18 22 C14 22 12 28 18 32 C24 36 30 32 32 32 C34 32 40 36 46 32 C52 28 50 22 46 22 C42 22 36 18 32 14z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="32" y1="32" x2="32" y2="44" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M22 36 L18 42 M26 38 L24 46 M38 38 L40 46 M42 36 L46 42" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="32" cy="47" r="4" fill="none" stroke="${c}" stroke-width="2"/>`,

  // ── EXPERIMENTAL DEMONS ─────────────────────────────────────────────────────

  // Kazali: demonic crown with three upward spikes
  kazali: (c) => `
    <path d="M12 48 L12 30 L22 42 L32 14 L42 42 L52 30 L52 48 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="10" y1="48" x2="54" y2="48" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="20" y1="28" x2="17" y2="16" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="32" y1="22" x2="32" y2="10" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="44" y1="28" x2="47" y2="16" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="17" cy="14" r="3" fill="${c}"/>
    <circle cx="32" cy="8" r="3" fill="${c}"/>
    <circle cx="47" cy="14" r="3" fill="${c}"/>`,

  // Lleech: segmented worm/leech with sucker mouth
  lleech: (c) => `
    <path d="M20 12 C16 12 14 16 14 22 C14 28 18 34 22 38 C26 42 28 46 28 52" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>
    <path d="M28 52 C28 56 32 58 36 56 C40 54 40 50 36 48 C32 46 26 48 26 52" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="20" cy="14" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="18" cy="13" r="2" fill="${c}"/>
    <circle cx="22" cy="13" r="2" fill="${c}"/>
    <path d="M18 18 L22 18" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Lil' Monsta: cute demon face with tiny horns
  lilMonsta: (c) => `
    <circle cx="32" cy="34" r="16" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M24 20 C22 14 18 14 18 20" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M40 20 C42 14 46 14 46 20" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="26" cy="32" r="3" fill="${c}" opacity="0.8"/>
    <circle cx="38" cy="32" r="3" fill="${c}" opacity="0.8"/>
    <path d="M25 40 q7 8 14 0" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Po: demon face with three kill-drop marks below
  po: (c) => `
    <path d="M32 12 C26 8 18 12 18 20 C18 28 26 34 32 40 C38 34 46 28 46 20 C46 12 38 8 32 12z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="32" cy="26" r="4" fill="${c}" opacity="0.7"/>
    <circle cx="22" cy="52" r="3" fill="${c}" opacity="0.8"/>
    <circle cx="32" cy="52" r="3" fill="${c}" opacity="0.8"/>
    <circle cx="42" cy="52" r="3" fill="${c}" opacity="0.8"/>
    <line x1="22" y1="44" x2="22" y2="48" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="32" y1="42" x2="32" y2="48" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="42" y1="44" x2="42" y2="48" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Riot: roaring flames
  riot: (c) => `
    <path d="M20 52 C16 42 18 34 22 28 C20 33 22 38 26 36 C24 28 26 18 32 12 C38 18 40 28 38 36 C42 38 44 33 42 28 C46 34 48 42 44 52" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="16" y1="52" x2="48" y2="52" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M29 36 C27 40 27 46 32 48 C37 46 37 40 35 36" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // ── FABLED ──────────────────────────────────────────────────────────────────

  // Djinn: ornate oil lamp with rising genie smoke
  djinn: (c) => `
    <path d="M12 38 C14 32 20 28 26 30 C24 22 30 16 34 22 C36 16 44 14 46 22 C50 16 54 22 52 30 C56 28 58 34 54 38" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M12 38 C12 44 54 44 54 38" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M28 30 C30 22 32 14 32 10 C34 14 36 22 36 30" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
    <path d="M31 10 C31 6 35 4 35 8" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="0.5"/>`,

  // Spirit of Ivory: ivory tusk curving to a point
  spiritOfIvory: (c) => `
    <path d="M26 10 C34 10 42 16 42 26 C42 38 36 50 30 56" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
    <path d="M26 10 C20 10 16 16 16 24 C16 36 22 50 30 56" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
    <ellipse cx="30" cy="11" rx="8" ry="4" fill="none" stroke="${c}" stroke-width="2"/>`,

  // Hell's Librarian: open book with flames rising from pages
  hellsLibrarian: (c) => `
    <path d="M14 50 L14 22 C20 18 32 18 32 18" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M50 50 L50 22 C44 18 32 18 32 18" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="14" y1="50" x2="50" y2="50" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="32" y1="18" x2="32" y2="50" stroke="${c}" stroke-width="2"/>
    <path d="M22 18 C22 12 26 8 24 14 C26 8 30 6 30 12 C30 6 36 8 34 14 C36 8 42 10 40 16" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="0.85"/>`,

  // Angel: spread wings with halo above
  angel: (c) => `
    <path d="M32 32 C22 24 10 22 10 32 C10 40 20 44 32 40" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M32 32 C42 24 54 22 54 32 C54 40 44 44 32 40" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="20" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <ellipse cx="32" cy="14" rx="11" ry="3.5" fill="none" stroke="${c}" stroke-width="2" opacity="0.7"/>
    <line x1="28" y1="40" x2="28" y2="52" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="36" y1="40" x2="36" y2="52" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Sentinel: shield with an eye in the centre
  sentinel: (c) => `
    <path d="M14 14 h36 v24 C50 50 42 56 32 58 C22 56 14 50 14 38 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="32" cy="36" rx="12" ry="8" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="32" cy="36" r="4" fill="${c}"/>`,

  // Buddhist: lotus blossom with stem
  buddhist: (c) => `
    <path d="M32 40 C32 40 20 34 20 24 C20 16 26 12 32 12 C38 12 44 16 44 24 C44 34 32 40 32 40z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M32 40 C32 40 14 38 12 28 C10 20 16 14 22 16" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M32 40 C32 40 50 38 52 28 C54 20 48 14 42 16" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <line x1="32" y1="40" x2="32" y2="54" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M24 52 C26 48 30 46 32 46 C34 46 38 48 40 52" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Ferryman: boat with a long oar
  ferryman: (c) => `
    <path d="M10 44 C14 40 20 38 32 38 C44 38 50 40 54 44" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M10 44 C12 50 20 54 32 54 C44 54 52 50 54 44" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="32" y1="38" x2="32" y2="54" stroke="${c}" stroke-width="1.5" opacity="0.35"/>
    <line x1="22" y1="14" x2="46" y2="38" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M18 10 C14 14 12 18 22 18 C26 18 26 14 22 14" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,

  // Toymaker: wind-up key on a clockface
  toymaker: (c) => `
    <circle cx="32" cy="32" r="16" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="5" fill="none" stroke="${c}" stroke-width="2"/>
    <line x1="32" y1="22" x2="32" y2="32" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="32" y1="32" x2="42" y2="26" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M32 16 L32 10 M28 10 h8" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,

  // Gardener: watering can with water drops
  gardener: (c) => `
    <path d="M12 26 h24 a4 4 0 0 1 4 4 v14 a4 4 0 0 1-4 4 H16 a4 4 0 0 1-4-4 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M36 30 C42 28 50 24 52 16" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M48 10 C50 6 54 8 52 12 C50 16 46 18 44 16" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="12" y1="34" x2="8" y2="34" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="26" cy="56" r="2" fill="${c}" opacity="0.7"/>
    <circle cx="34" cy="54" r="2" fill="${c}" opacity="0.7"/>
    <circle cx="20" cy="54" r="2" fill="${c}" opacity="0.5"/>`,

  // Duchess: decorative folded hand fan
  duchess: (c) => `
    <path d="M32 46 L14 18 C18 14 24 12 32 12 C40 12 46 14 50 18 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="32" y1="46" x2="21" y2="20" stroke="${c}" stroke-width="1.5" opacity="0.5"/>
    <line x1="32" y1="46" x2="26" y2="14" stroke="${c}" stroke-width="1.5" opacity="0.5"/>
    <line x1="32" y1="46" x2="32" y2="12" stroke="${c}" stroke-width="1.5" opacity="0.5"/>
    <line x1="32" y1="46" x2="38" y2="14" stroke="${c}" stroke-width="1.5" opacity="0.5"/>
    <line x1="32" y1="46" x2="43" y2="20" stroke="${c}" stroke-width="1.5" opacity="0.5"/>
    <rect x="24" y="48" width="16" height="6" rx="2" fill="none" stroke="${c}" stroke-width="2.5"/>`,

  // Revolutionary: two figures standing side by side with raised fist
  revolutionary: (c) => `
    <circle cx="20" cy="16" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="44" cy="16" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
    <path d="M12 48 C12 38 16 30 20 28 C24 30 28 38 28 48" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M36 48 C36 38 40 30 44 28 C48 30 52 38 52 48" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M29 26 L29 18 L35 18 L35 26" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M29 18 L35 18 L35 14 L32 12 L29 14 Z" fill="${c}" opacity="0.8" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>`,

  // Storm Catcher (fabled): potion bottle catching a lightning bolt
  stormCatcherFabled: (c) => `
    <path d="M24 12 C24 8 40 8 40 12 L38 36 C38 42 36 48 32 50 C28 48 26 42 26 36 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M38 20 L28 32 L34 32 L26 46" fill="${c}" opacity="0.65" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="28" y1="8" x2="28" y2="12" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    <line x1="36" y1="8" x2="36" y2="12" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>`,
};

// ── Fallback geometric glyphs for custom scripts ─────────────────────────────
const FALLBACK_GLYPHS = [
  (c) => `<circle cx="32" cy="32" r="18" fill="none" stroke="${c}" stroke-width="3"/><circle cx="32" cy="32" r="6" fill="${c}"/>`,
  (c) => `<polygon points="32,12 50,46 14,46" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
  (c) => `<path d="M40 14a20 20 0 1 0 0 36 16 16 0 1 1 0-36z" fill="${c}"/>`,
  (c) => `<polygon points="32,10 54,32 32,54 10,32" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
  (c) => `<circle cx="20" cy="32" r="5" fill="${c}"/><circle cx="32" cy="20" r="5" fill="${c}"/><circle cx="44" cy="32" r="5" fill="${c}"/>`,
  (c) => `<line x1="32" y1="14" x2="32" y2="50" stroke="${c}" stroke-width="4" stroke-linecap="round"/><line x1="14" y1="32" x2="50" y2="32" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`,
  (c) => `<path d="M44 20a14 14 0 1 0-6 24" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
  (c) => `<circle cx="22" cy="24" r="8" fill="none" stroke="${c}" stroke-width="3"/><line x1="28" y1="30" x2="46" y2="48" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
  (c) => `<path d="M32 10l18 7v14c0 12-8 19-18 23-10-4-18-11-18-23V17z" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
  (c) => `<g stroke="${c}" stroke-width="3" stroke-linecap="round"><line x1="32" y1="14" x2="32" y2="50"/><line x1="14" y1="32" x2="50" y2="32"/><line x1="20" y1="20" x2="44" y2="44"/><line x1="44" y1="20" x2="20" y2="44"/></g>`,
  (c) => `<path d="M18 14h28l-4 14a10 10 0 0 1-20 0z" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/><line x1="32" y1="38" x2="32" y2="48" stroke="${c}" stroke-width="3"/>`,
  (c) => `<path d="M20 46c-4-14 0-26 8-30M44 46c4-14 0-26-8-30" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
  (c) => `<rect x="22" y="18" width="20" height="24" rx="3" fill="none" stroke="${c}" stroke-width="3"/><line x1="32" y1="10" x2="32" y2="18" stroke="${c}" stroke-width="3"/>`,
  (c) => `<path d="M32 12c8 8 8 28 0 40 -8-12-8-32 0-40z" fill="none" stroke="${c}" stroke-width="3"/>`,
  (c) => `<circle cx="32" cy="26" r="14" fill="none" stroke="${c}" stroke-width="3"/><circle cx="26" cy="24" r="3" fill="${c}"/><circle cx="38" cy="24" r="3" fill="${c}"/>`,
  (c) => `<path d="M32 14 L35 24 L46 24 L37 31 L40 42 L32 36 L24 42 L27 31 L18 24 L29 24 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`,
];

function hashStringToInt(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Fallback per-script assignment for custom scripts
const scriptGlyphAssignments = {};
function buildAssignmentsForScript(scriptId, characters) {
  const sorted = [...characters].sort((a, b) => a.id.localeCompare(b.id));
  const rotations = [0, 90, 180, 270];
  const assignments = {};
  let slot = 0;
  const totalSlots = FALLBACK_GLYPHS.length * rotations.length;
  sorted.forEach(c => {
    const s = slot % totalSlots;
    assignments[c.id] = { glyphIndex: s % FALLBACK_GLYPHS.length, rotation: rotations[Math.floor(s / FALLBACK_GLYPHS.length) % rotations.length] };
    slot++;
  });
  scriptGlyphAssignments[scriptId] = assignments;
  return assignments;
}

function getCharacterIconSVG(characterId, team, scriptId, allCharactersInScript) {
  const color = TEAM_COLORS[team] || '#C9A24B';

  // Use the hand-crafted icon if it exists
  if (CHARACTER_ICONS[characterId]) {
    const glyph = CHARACTER_ICONS[characterId](color);
    return `<svg viewBox="0 0 64 64" class="token-icon-svg" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="none" stroke="${color}" stroke-width="1" opacity="0.25"/>${glyph}</svg>`;
  }

  // Fallback: deterministic geometric glyph for custom characters
  let glyphIndex = 0, rotation = 0;
  if (scriptId && allCharactersInScript) {
    let assignments = scriptGlyphAssignments[scriptId];
    if (!assignments || !assignments[characterId]) assignments = buildAssignmentsForScript(scriptId, allCharactersInScript);
    const a = assignments[characterId];
    if (a) { glyphIndex = a.glyphIndex; rotation = a.rotation; }
  } else {
    glyphIndex = hashStringToInt(characterId) % FALLBACK_GLYPHS.length;
  }
  const glyph = FALLBACK_GLYPHS[glyphIndex](color);
  const transform = rotation ? ` transform="rotate(${rotation} 32 32)"` : '';
  return `<svg viewBox="0 0 64 64" class="token-icon-svg" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="none" stroke="${color}" stroke-width="1" opacity="0.25"/><g${transform}>${glyph}</g></svg>`;
}

function getBlankTokenSVG() {
  return `<svg viewBox="0 0 64 64" class="token-icon-svg" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="14" fill="none" stroke="#6F6754" stroke-width="2" stroke-dasharray="3 4"/></svg>`;
}
