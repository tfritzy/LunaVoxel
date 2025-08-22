const ADJECTIVES = [
  "Stealthy",
  "Shadowy",
  "Covert",
  "Veiled",
  "Masked",
  "Mysterious",
  "Incognito",
  "Silent",
  "Camouflaged",
  "Disguised",
  "Anonymous",
  "Cloaked",
  "Ghostly",
  "Concealed",
];

const ANIMALS = [
  "Wolf",
  "Eagle",
  "Tiger",
  "Bear",
  "Fox",
  "Lion",
  "Hawk",
  "Deer",
  "Rabbit",
  "Owl",
  "Dragon",
  "Horse",
  "Dolphin",
  "Panther",
  "Falcon",
  "Lynx",
  "Otter",
  "Raven",
  "Shark",
  "Turtle",
  "Whale",
  "Leopard",
  "Jaguar",
  "Elk",
  "Bison",
  "Crane",
  "Swan",
  "Viper",
  "Cobra",
  "Phoenix",
];

export const generateDisplayName = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }

  const adjectiveIndex = Math.abs(hash) % ADJECTIVES.length;
  const animalIndex = Math.abs(hash >> 16) % ANIMALS.length;

  return `${ADJECTIVES[adjectiveIndex]} ${ANIMALS[animalIndex]}`;
};
