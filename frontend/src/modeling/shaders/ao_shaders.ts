// AO vertex and fragment shaders stored in a reusable file
export const voxelVertexShader = `
  // Standard vertex attributes
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec2 uv;
  // New attribute for ambient occlusion
  attribute vec4 aAmbientOcclusion; // (topLeft, topRight, bottomLeft, bottomRight)
  
  // Varying values passed to fragment shader
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec4 vAmbientOcclusion;
  
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  
  void main() {
    vUv = uv;
    vNormal = normal;
    vAmbientOcclusion = aAmbientOcclusion;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const voxelFragmentShader = `
  uniform vec3 diffuse;
  uniform float opacity;
  uniform float aoIntensity;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec4 vAmbientOcclusion;
  
  void main() {
    // Determine which corner we're rendering
    float ao = 1.0;
    if (vUv.x < 0.5 && vUv.y < 0.5) {
      ao = vAmbientOcclusion.z; // bottom left
    } else if (vUv.x < 0.5 && vUv.y >= 0.5) {
      ao = vAmbientOcclusion.x; // top left
    } else if (vUv.x >= 0.5 && vUv.y < 0.5) {
      ao = vAmbientOcclusion.w; // bottom right
    } else {
      ao = vAmbientOcclusion.y; // top right
    }
    
    // Apply AO to the diffuse color with adjustable intensity
    vec4 finalColor = vec4(diffuse * mix(1.0, ao, aoIntensity), opacity);
    gl_FragColor = finalColor;
  }
`;
