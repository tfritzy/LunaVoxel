use spacetimedb::Timestamp;

pub struct IdGenerator;

impl IdGenerator {
    pub fn generate(prefix: &str, timestamp: Timestamp) -> String {
        let nanos = timestamp.to_micros_since_unix_epoch() as u128 * 1000;
        format!("{}_{:x}", prefix, nanos)
    }
}