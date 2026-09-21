import { BufferAttribute, BufferGeometry, DataTexture, DynamicDrawUsage, FloatType, InterleavedBuffer, InterleavedBufferAttribute, RGBAFormat } from 'three';

/** Four exact source corners and one motion record per patch. Indexed source
 * vertices retain the ordinary drawing path; a nearest-sampled Float32 data
 * texture shares motion fields without repeating them at every vertex.
 * Artwork textures, source paint and coordinates are never quantized. */
export class DotonboriSurfaceGeometry extends BufferGeometry {
  readonly patchCount: number;
  readonly vertexData: InterleavedBuffer;
  readonly data: InterleavedBuffer;
  readonly motionTexture: DataTexture;
  readonly source: Record<string, InterleavedBufferAttribute[]> = {};
  readonly centers: InterleavedBufferAttribute;
  readonly flow: InterleavedBufferAttribute;
  readonly bounds: InterleavedBufferAttribute;
  readonly target: InterleavedBufferAttribute;

  constructor(count: number, sizes: Readonly<Record<string, number>>) {
    super(); this.patchCount = count;
    const stride = Object.values(sizes).reduce((sum, size) => sum + size, 0);
    this.vertexData = new InterleavedBuffer(new Float32Array(count * 4 * stride), stride).setUsage(DynamicDrawUsage);
    const corners = new InterleavedBuffer(this.vertexData.array, stride * 4);
    let offset = 0;
    for (const [name, size] of Object.entries(sizes)) {
      this.setAttribute(name, new InterleavedBufferAttribute(this.vertexData, size, offset));
      this.source[name] = Array.from({ length: 4 }, (_, corner) => new InterleavedBufferAttribute(corners, size, corner * stride + offset));
      offset += size;
    }
    const indices = count * 4 > 65536 ? new Uint32Array(count * 6) : new Uint16Array(count * 6);
    for (let patch = 0; patch < count; patch++) indices.set([0, 1, 2, 0, 2, 3].map(corner => patch * 4 + corner), patch * 6);
    this.setIndex(new BufferAttribute(indices, 1));
    // Three texels per patch. Whole records fit each row, including padding;
    // 768 texels keeps even the largest batch below WebGL 2's minimum limits.
    const width = Math.min(768, Math.max(3, count * 3)), height = Math.max(1, Math.ceil(count * 3 / width));
    this.data = new InterleavedBuffer(new Float32Array(width * height * 4), 12);
    this.motionTexture = new DataTexture(this.data.array, width, height, RGBAFormat, FloatType);
    this.motionTexture.needsUpdate = true;
    const field = (size: number, start: number) => new InterleavedBufferAttribute(this.data, size, start);
    this.centers = field(3, 0); this.flow = field(3, 3);
    this.bounds = field(4, 6); this.target = field(2, 10);
  }

  get bytes() { return this.vertexData.array.byteLength + this.data.array.byteLength + this.index!.array.byteLength; }

  updateMotion() { this.data.needsUpdate = true; this.motionTexture.needsUpdate = true; }
  updateSource() { this.vertexData.needsUpdate = true; this.updateMotion(); }

  vertexShader(shader: string) {
    return `uniform highp sampler2D surfaceMotion;
uniform int surfaceMotionWidth;
` + shader.replace('void main() {', `void main() {
int surfacePatch=gl_VertexID/4, surfaceCorner=gl_VertexID%4;
int surfaceTexel=surfacePatch*3;
ivec2 surfaceAddress=ivec2(surfaceTexel%surfaceMotionWidth,surfaceTexel/surfaceMotionWidth);
vec4 surfaceA=texelFetch(surfaceMotion,surfaceAddress,0);
vec4 surfaceB=texelFetch(surfaceMotion,surfaceAddress+ivec2(1,0),0);
vec4 surfaceC=texelFetch(surfaceMotion,surfaceAddress+ivec2(2,0),0);
vec3 surfaceCenter=surfaceA.xyz, surfaceFlow=vec3(surfaceA.w,surfaceB.xy);
vec4 surfaceEnd=vec4(surfaceCorner==0 || surfaceCorner==3 ? surfaceB.z : surfaceB.w,
  surfaceCorner<2 ? surfaceC.x : surfaceC.y,surfaceC.zw);
`);
  }

  override dispose() { this.motionTexture.dispose(); super.dispose(); }
}
