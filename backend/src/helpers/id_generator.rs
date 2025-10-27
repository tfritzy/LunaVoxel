pub struct IdGenerator;

impl IdGenerator {
    pub fn generate(prefix: &str) -> String {
        use std::time::{SystemTime, UNIX_EPOCH};
        
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        
        format!("{}_{:x}", prefix, timestamp)
    }
}