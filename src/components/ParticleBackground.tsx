import { useEffect, useRef } from "react";
import * as THREE from "three";

const bgVertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const bgFragmentShader = `
  precision highp float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  out vec4 fragColor;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float hash1(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 6; i++) {
      f += amp * noise(p * freq);
      freq *= 2.03;
      amp *= 0.49;
      p += vec2(1.7, 9.2);
    }
    return f;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float t = u_time * 0.08;
    float mouseInfluence = 0.0;
    if (u_mouse.x > 0.0) {
      vec2 mUV = u_mouse / u_resolution;
      float mDist = length(uv - mUV);
      mouseInfluence = exp(-mDist * mDist * 8.0);
    }
    vec2 drift = vec2(
      fbm(uv * 1.5 + vec2(t, t * 0.5)),
      fbm(uv * 1.5 + vec2(-t * 0.7, t * 1.1))
    ) * 0.08;
    drift += mouseInfluence * vec2(
      sin(t * 2.0 + uv.y * 4.0),
      cos(t * 1.5 + uv.x * 4.0)
    ) * 0.05;
    vec2 p = uv + drift;
    float n1 = fbm(p * 2.0 + vec2(0.0, t * 0.3));
    float n2 = fbm(p * 2.5 + vec2(t * 0.4, 0.0));
    float pattern = smoothstep(0.1, 0.8, n1 * n2 * 2.0);
    vec3 c1 = vec3(0.04, 0.04, 0.045);
    vec3 c2 = vec3(0.06, 0.05, 0.04);
    vec3 c3 = vec3(0.10, 0.08, 0.06);
    vec3 col = mix(mix(c1, c2, uv.y), c3, pattern * 0.5);
    float vig = 1.0 - dot(uv - 0.5, uv - 0.5) * 1.5;
    vig = clamp(vig, 0.0, 1.0);
    col *= 0.5 + vig * 0.5;
    fragColor = vec4(col, 1.0);
  }
`;

const particleVertexShader = `
  uniform float u_time;
  uniform vec2 u_mouse;
  uniform vec2 u_resolution;
  attribute float a_seed;
  out float v_alpha;
  out vec3 v_color;

  mat2 rot2(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
  }

  float hash11(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  vec3 hash31(float n) {
    vec3 p = fract(vec3(n) * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.xxy + p.zzy) * p.zyx);
  }

  void main() {
    float seed = a_seed;
    float rnd1 = hash11(seed * 1.37);
    float rnd2 = hash11(seed * 2.91);
    float rnd3 = hash11(seed * 4.13);
    vec3 basePos = vec3(
      (rnd1 - 0.5) * 4.5,
      (rnd2 - 0.5) * 3.0,
      (rnd3 - 0.5) * 1.5
    );
    float t = u_time * 0.12;
    vec3 motion = vec3(
      sin(t * (0.7 + rnd1 * 0.5) + seed) * 0.25,
      cos(t * (0.5 + rnd2 * 0.5) + seed * 1.7) * 0.18,
      sin(t * 0.3 + seed * 2.3) * 0.08
    );
    vec3 turb = vec3(
      sin(basePos.y * 2.5 + t * 1.3),
      cos(basePos.x * 2.5 + t * 1.1),
      sin(basePos.z * 2.0 + t * 0.9)
    ) * 0.06;
    vec3 mouseShift = vec3(0.0);
    if (u_mouse.x >= 0.0) {
      vec2 mUV = u_mouse / u_resolution - 0.5;
      float mDist = length(basePos.xy - mUV * vec2(2.0, 1.5));
      float falloff = exp(-mDist * mDist * 3.0);
      mouseShift = vec3(mUV * 1.2, sin(mDist * 10.0 - t * 2.0) * 0.08) * falloff;
    }
    vec3 pos = basePos + motion + turb + mouseShift;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float pulse = 0.5 + 0.5 * sin(u_time * (1.5 + rnd3 * 2.0) + seed * 6.0);
    v_alpha = (0.2 + 0.4 * pulse) * smoothstep(0.0, 0.3, rnd1);
    vec3 colA = vec3(0.91, 0.66, 0.22);
    vec3 colB = vec3(0.83, 0.65, 0.13);
    vec3 colC = vec3(0.94, 0.90, 0.89);
    vec3 cMix = hash31(seed * 7.11);
    v_color = mix(mix(colA, colB, cMix.x), colC, cMix.y * 0.15);
    float pointSize = (2.0 + 2.5 * rnd2 * smoothstep(0.5, 1.0, pulse)) * (8.0 / -mv.z);
    gl_PointSize = clamp(pointSize, 1.0, 6.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const particleFragmentShader = `
  precision highp float;
  in float v_alpha;
  in vec3 v_color;
  out vec4 fragColor;

  void main() {
    vec2 c = 2.0 * gl_PointCoord - 1.0;
    float d = dot(c, c);
    float g = exp(-d * d * 2.0);
    if (g < 0.01) discard;
    fragColor = vec4(v_color, g * v_alpha);
  }
`;

const PARTICLE_COUNT = 4000;
const MOUSE_IDLE_MS = 2000;

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const container = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const bgUniforms = {
      u_time: { value: 0 },
      u_resolution: {
        value: new THREE.Vector2(
          window.innerWidth * dpr,
          window.innerHeight * dpr
        ),
      },
      u_mouse: { value: new THREE.Vector2(-1000, -1000) },
    };

    const bgScene = new THREE.Scene();
    const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: bgUniforms,
        vertexShader: bgVertexShader,
        fragmentShader: bgFragmentShader,
        depthWrite: false,
      })
    );
    bgScene.add(bgMesh);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 5;

    const seedArray = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      seedArray[i] = i + Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("a_seed", new THREE.BufferAttribute(seedArray, 1));

    const particleUniforms = {
      u_time: bgUniforms.u_time,
      u_resolution: bgUniforms.u_resolution,
      u_mouse: bgUniforms.u_mouse,
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: particleUniforms,
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    const clock = new THREE.Clock();
    let mouseTimer: ReturnType<typeof setTimeout> | null = null;

    const onMouseMove = (e: MouseEvent) => {
      particleUniforms.u_mouse.value.set(
        e.clientX,
        window.innerHeight - e.clientY
      );
      particleUniforms.u_mouse.value.multiplyScalar(dpr);
      if (mouseTimer) clearTimeout(mouseTimer);
      mouseTimer = setTimeout(() => {
        particleUniforms.u_mouse.value.set(-1000, -1000);
      }, MOUSE_IDLE_MS);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        particleUniforms.u_mouse.value.set(
          e.touches[0].clientX,
          window.innerHeight - e.touches[0].clientY
        );
        particleUniforms.u_mouse.value.multiplyScalar(dpr);
        if (mouseTimer) clearTimeout(mouseTimer);
        mouseTimer = setTimeout(() => {
          particleUniforms.u_mouse.value.set(-1000, -1000);
        }, MOUSE_IDLE_MS);
      }
    };

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      particleUniforms.u_resolution.value.set(
        window.innerWidth * dpr,
        window.innerHeight * dpr
      );
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      particleUniforms.u_time.value = clock.getElapsedTime();
      renderer.autoClear = false;
      renderer.render(bgScene, bgCamera);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("resize", onResize);
      if (mouseTimer) clearTimeout(mouseTimer);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        opacity: 0.15,
        pointerEvents: "none",
      }}
    />
  );
}
