const ADJECTIVES: &[&str] = &[
    "Stealthy", "Shadowy", "Covert", "Veiled", "Masked", "Mysterious", "Incognito",
    "Silent", "Camouflaged", "Disguised", "Anonymous", "Cloaked", "Ghostly", "Concealed",
];

const ANIMALS: &[&str] = &[
    "Wolf", "Eagle", "Tiger", "Bear", "Fox", "Lion", "Hawk", "Deer",
    "Rabbit", "Owl", "Dragon", "Horse", "Dolphin", "Panther", "Falcon",
    "Lynx", "Otter", "Raven", "Shark", "Turtle", "Whale", "Leopard",
    "Jaguar", "Elk", "Bison", "Crane", "Swan", "Viper", "Cobra", "Phoenix",
];

pub struct RandomNameGenerator;

impl RandomNameGenerator {
    pub fn generate(seed: u64) -> String {
        let adj_idx = (seed % ADJECTIVES.len() as u64) as usize;
        let animal_idx = ((seed / ADJECTIVES.len() as u64) % ANIMALS.len() as u64) as usize;
        format!("{} {}", ADJECTIVES[adj_idx], ANIMALS[animal_idx])
    }
}