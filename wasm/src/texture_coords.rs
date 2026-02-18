pub fn get_texture_coordinates(
    texture_index: i32,
    texture_width: i32,
) -> [f32; 8] {
    let texture_size = 1.0_f32 / texture_width as f32;
    let half_pixel = texture_size * 0.5;
    let u = (texture_index % texture_width) as f32 * texture_size + half_pixel;
    let v = (texture_index / texture_width) as f32 * texture_size + half_pixel;
    let flipped_v = 1.0_f32 - v;
    [u, flipped_v, u, flipped_v, u, flipped_v, u, flipped_v]
}
