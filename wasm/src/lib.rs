use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn translate_positions_up(positions: &[f32], amount: f32) -> Vec<f32> {
    let mut result = Vec::with_capacity(positions.len());
    
    let mut i = 0;
    while i < positions.len() {
        if i + 2 < positions.len() {
            result.push(positions[i]);
            result.push(positions[i + 1] + amount);
            result.push(positions[i + 2]);
            i += 3;
        } else {
            break;
        }
    }
    
    result
}