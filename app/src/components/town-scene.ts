import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SPECIES, speciesById, type Gait } from "@/lib/species";

/**
 * The Isekai in 3D: a small island town drawn with plain three.js, no models or textures.
 *
 * It is a view of the simulation, not a second simulation. Where each resident is, who is
 * talking, what was said, how busy a place is and what hour it is all come from the
 * server; this file only decides how that looks and how a resident gets from where they
 * were to where they now are. Everything scattered (trees, flowers, lantern posts) comes
 * from one seeded generator, so the town looks the same on every screen.
 */

/** `kind` is the resident's species id: it decides their colour, ears and anything on their head. */
export type SceneAgent = { id: number; name: string; place: string; hue: number; mine: boolean; owned: boolean; paused: boolean; kind?: string };
export type SceneTalk = { id: number; aId: number; bId: number | null; delta: number; line: string | null; speaker: number | null };
export type SceneState = {
  agents: SceneAgent[];
  /** The hour at the last tick, when that tick was seen (performance.now()), and hours per second. */
  hour: number;
  hourAt: number;
  hourRate: number;
  buzz: Record<string, number>;
  talk: SceneTalk | null;
  selected: number | null;
  /** Weather someone paid for, and the place it fills. The server decides both. */
  weather: { kind: string; place: string } | null;
};

const PLACE_AT: Record<string, [number, number]> = { tavern: [-15, -12], market: [15, -12], guild: [-15, 13], lake: [16, 13] };
const PLAZA: [number, number] = [0, 0];

/** Seeded generator (mulberry32), so scatter is identical for everyone. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mat = (color: number | string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra });

function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A four-sided pitched roof. */
function roof(w: number, h: number, d: number, material: THREE.Material, y: number) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(1, h, 4, 1), material);
  m.rotation.y = Math.PI / 4;
  m.scale.set(w * 0.72, 1, d * 0.72);
  m.position.y = y + h / 2;
  m.castShadow = true;
  return m;
}

// Sky colours at four times of day; everything in between is blended.
const SKY = [
  { h: 0, top: 0x0b1030, low: 0x2a2f5e, sun: 0x8fa4ff, light: 0.22, fog: 0x1a1f45 },
  { h: 6, top: 0x5b7fd6, low: 0xffb38a, sun: 0xffc9a0, light: 0.75, fog: 0xf2c4a8 },
  { h: 12, top: 0x4aa3ff, low: 0xcfeaff, sun: 0xfff4e0, light: 1.15, fog: 0xcfeaff },
  { h: 18, top: 0x4a4fa8, low: 0xff9a6b, sun: 0xff9a5a, light: 0.7, fog: 0xe8a58a },
  { h: 24, top: 0x0b1030, low: 0x2a2f5e, sun: 0x8fa4ff, light: 0.22, fog: 0x1a1f45 },
];

function skyAt(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const i = SKY.findIndex((k, n) => h >= k.h && h <= SKY[n + 1]?.h);
  const a = SKY[Math.max(0, i)];
  const b = SKY[Math.max(0, i) + 1] ?? a;
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  const mix = (x: number, y: number) => new THREE.Color(x).lerp(new THREE.Color(y), t);
  // 0 at midday, 1 in the dead of night: how much the lanterns and windows should glow.
  const night = THREE.MathUtils.clamp(1 - (a.light + (b.light - a.light) * t - 0.22) / 0.55, 0, 1);
  return { top: mix(a.top, b.top), low: mix(a.low, b.low), sun: mix(a.sun, b.sun), fog: mix(a.fog, b.fog), light: a.light + (b.light - a.light) * t, night };
}

type Body = {
  group: THREE.Group;
  body: THREE.Mesh;
  marker: THREE.Object3D | null;
  label: CSS2DObject;
  bubble: CSS2DObject;
  bubbleEl: HTMLDivElement;
  emote: CSS2DObject;
  emoteEl: HTMLDivElement;
  path: THREE.Vector3[];
  place: string;
  slot: number;
  phase: number;
  lookAt: THREE.Vector3 | null;
  bubbleUntil: number;
  emoteUntil: number;
  scale: number;
  /** How this species moves, and any wings it beats. */
  gait: Gait;
  wings: { mesh: THREE.Object3D; side: number; fast: boolean }[];
};

const BAKED = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });

/**
 * Turns a group of plain coloured meshes into one mesh, with the colours carried on its
 * vertices. A sheep is nine boxes; drawn one by one that is nine draw calls, and a phone
 * feels every one. The group must not be in the scene yet, and must hold nothing that
 * glows or moves on its own.
 */
function bake(group: THREE.Object3D): THREE.Mesh {
  group.updateMatrixWorld(true);
  const undo = group.matrixWorld.clone().invert();
  const parts: THREE.BufferGeometry[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(undo, m.matrixWorld));
    const { r, g: green, b } = (m.material as THREE.MeshStandardMaterial).color;
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set([r, green, b], i);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(g);
    m.geometry.dispose();
  });
  const mesh = new THREE.Mesh(mergeGeometries(parts), BAKED);
  mesh.position.copy(group.position);
  mesh.rotation.copy(group.rotation);
  mesh.scale.copy(group.scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Something that moves by itself out in the countryside: an animal, a bird or a boat. */
type Critter = { g: THREE.Object3D; kind: "walker" | "swimmer" | "flyer" | "boat" | "sailor"; home: [number, number]; reach: number; speed: number; phase: number; to: THREE.Vector3 | null; wait: number; y: number };

/** Where the countryside's set pieces stand (x, z, radius), so trees keep off them. */
const KEEP_OFF: [number, number, number][] = [
  [33, -27, 12], // the farm
  [-33, 30, 7.5], // the pond
  [-42, -6, 5.5], // the camp
  [49, 21, 5], // the lighthouse
  [19, 16, 9.6], // the lake itself
];
/** How far from the middle the grass reaches. */
const ISLAND = 54;

export class TownScene {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private bodies = new Map<number, Body>();
  private sky!: THREE.Mesh;
  private sun = new THREE.DirectionalLight(0xffffff, 1);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 0.6);
  private sunDisc!: THREE.Mesh;
  private stars!: THREE.Points;
  private glows: { mesh: THREE.Mesh; place: string | null; base: number }[] = [];
  private windows: THREE.MeshStandardMaterial[] = [];
  private placeLights: Record<string, THREE.PointLight> = {};
  private canopies: { mesh: THREE.Object3D; phase: number }[] = [];
  private motes!: THREE.Points;
  private clouds: THREE.Group[] = [];
  private smoke: { mesh: THREE.Mesh; t: number }[] = [];
  private critters: Critter[] = [];
  private blades!: THREE.Group;
  private flame!: THREE.Mesh;
  private fireLight!: THREE.PointLight;
  private water!: THREE.Mesh;
  private lake!: THREE.Mesh;
  private banner!: THREE.Mesh;
  private state: SceneState = { agents: [], hour: 12, hourAt: 0, hourRate: 0, buzz: {}, talk: null, selected: null, weather: null };
  private lastTalk = -1;
  // How far the sky has turned to storm or to moonlight, 0 to 1, eased so weather rolls in.
  private storm = 0;
  private moonlit = 0;
  private rain!: THREE.Points;
  private flash = 0;
  private nextFlash = 0;
  private small = false;
  private follow: number | null = null;
  private wantTarget = new THREE.Vector3();
  private userMoved = false;
  private greeted = false;
  private down: { x: number; y: number } | null = null;
  private reduced = false;
  private ring: THREE.Mesh;
  private selectRing: THREE.Mesh;

  /**
   * `ambient` is the town as scenery: empty of residents, slowly turning, not touchable
   * and drawn cheaply. It is what the landing page shows, blurred, behind the way in.
   */
  constructor(
    private host: HTMLElement,
    private onPick: (id: number | null) => void,
    private ambient = false,
  ) {
    const small = host.clientWidth < 700 || ambient;
    this.small = small;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: !small, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
    this.renderer.shadowMap.enabled = !small;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    host.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    host.appendChild(this.labels.domElement);

    this.camera.position.set(0, 40, 58);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 112;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.36;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.target.set(0, 1, 0);
    this.controls.addEventListener("start", () => {
      this.userMoved = true;
    });
    if (ambient) {
      this.controls.enabled = false;
      this.controls.autoRotate = !this.reduced;
      this.controls.autoRotateSpeed = 0.45;
      this.camera.position.set(0, 27, 62);
      this.renderer.setPixelRatio(1);
      this.renderer.domElement.style.touchAction = "auto";
      this.state = { ...this.state, hour: 18.4 };
    }

    this.scene.fog = new THREE.Fog(0xcfeaff, 80, 240);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sun.castShadow = !small;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 190 });
    this.sun.shadow.bias = -0.0015;

    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.25, 32), new THREE.MeshBasicMaterial({ color: 0x836ef9, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.selectRing = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.2, 32), new THREE.MeshBasicMaterial({ color: 0x1cb0f6, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    this.selectRing.rotation.x = -Math.PI / 2;
    this.selectRing.visible = false;
    this.scene.add(this.ring, this.selectRing);

    this.buildWorld();
    this.resize();

    const el = this.renderer.domElement;
    if (!ambient) {
      el.addEventListener("pointerdown", this.onDown);
      el.addEventListener("pointerup", this.onUp);
    }
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisible);
    this.loop();
  }

  // ---------------------------------------------------------------- the place

  private buildWorld() {
    const rnd = seeded(20261013);
    const s = this.scene;

    // Sky dome: the inside of a big sphere, coloured from horizon to zenith every frame.
    const skyGeo = new THREE.SphereGeometry(220, 24, 12);
    skyGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
    this.sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    s.add(this.sky);
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1c9, fog: false }));
    s.add(this.sunDisc);
    const starPos = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const v = new THREE.Vector3().setFromSphericalCoords(200, Math.acos(rnd() * 0.95), rnd() * Math.PI * 2);
      starPos.set([v.x, v.y, v.z], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    s.add(this.stars);

    // Sea, then the island: a grassy disc with a sandy rim and a few gentle hills.
    this.water = new THREE.Mesh(new THREE.CircleGeometry(230, 48), new THREE.MeshStandardMaterial({ color: 0x3f8fd8, roughness: 0.35, metalness: 0.1 }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -0.9;
    s.add(this.water);
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND + 3, ISLAND + 6, 1.2, 64), mat(0xf1dfae));
    sand.position.y = -0.75;
    sand.receiveShadow = true;
    s.add(sand);
    const groundGeo = new THREE.CircleGeometry(ISLAND, 80, 0, Math.PI * 2);
    const gp = groundGeo.attributes.position;
    const gc = new Float32Array(gp.count * 3);
    for (let i = 0; i < gp.count; i++) {
      const c = new THREE.Color(0x8fd16a).lerp(new THREE.Color(0x6fbf5a), rnd());
      gc.set([c.r, c.g, c.b], i * 3);
    }
    groundGeo.setAttribute("color", new THREE.BufferAttribute(gc, 3));
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);
    for (const [x, z, r] of [[-31, 6, 6], [30, 0, 5], [3, -30, 7], [-5, 32, 6]] as const) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x7cc862));
      hill.scale.y = 0.42;
      hill.position.set(x, -0.05, z);
      hill.receiveShadow = true;
      s.add(hill);
    }

    // Paths from the plaza to each place, and the plaza itself with a fountain.
    const stone = mat(0xe9dcc0, { flatShading: false });
    for (const [x, z] of Object.values(PLACE_AT)) {
      const len = Math.hypot(x, z) - 3;
      const path = new THREE.Mesh(new THREE.PlaneGeometry(2.6, len), stone);
      path.rotation.x = -Math.PI / 2;
      path.rotation.z = -Math.atan2(x, z);
      path.position.set(x / 2, 0.03, z / 2);
      path.receiveShadow = true;
      s.add(path);
    }
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(5.2, 32), stone);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.04;
    plaza.receiveShadow = true;
    s.add(plaza);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 0.7, 20), mat(0xcfc6b4));
    basin.position.y = 0.35;
    basin.castShadow = true;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.65, 20), new THREE.MeshStandardMaterial({ color: 0x6fc8ff, roughness: 0.2 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.71;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 8), mat(0xcfc6b4));
    spout.position.y = 1.1;
    s.add(basin, pool, spout);

    this.buildTavern();
    this.buildMarket(rnd);
    this.buildGuild();
    this.buildLake(rnd);

    // Lanterns along the paths. They glow more the busier their place has been.
    for (const [place, [x, z]] of Object.entries(PLACE_AT)) {
      for (const f of [0.35, 0.62, 0.86]) {
        const side = f === 0.62 ? -1 : 1;
        const nx = -z / Math.hypot(x, z);
        const nz = x / Math.hypot(x, z);
        this.lantern(x * f + nx * 2.1 * side, z * f + nz * 2.1 * side, place);
      }
      const light = new THREE.PointLight(0xffc27a, 0, 26, 1.6);
      light.position.set(x * 0.86, 4.5, z * 0.86);
      s.add(light);
      this.placeLights[place] = light;
    }
    for (let i = 0; i < 4; i++) this.lantern(Math.cos((i * Math.PI) / 2 + 0.8) * 4.4, Math.sin((i * Math.PI) / 2 + 0.8) * 4.4, null);

    // Trees and flowers, kept clear of paths, places and the plaza.
    this.buildCountryside(rnd);
    const clear = (x: number, z: number) => this.clear(x, z);
    const trunkMat = mat(0x8a5a3a);
    const leafMats = [mat(0x4fae58), mat(0x3f9a4c), mat(0x6cc070), mat(0xf7a8c4)];
    let placed = 0;
    for (let tries = 0; placed < 130 && tries < 1800; tries++) {
      // The north is thick with trees; the rest of the island is more open.
      const wooded = tries % 4 === 0;
      const x = wooded ? -6 + (rnd() - 0.5) * 44 : (rnd() - 0.5) * 104;
      const z = wooded ? -38 + (rnd() - 0.5) * 22 : (rnd() - 0.5) * 104;
      if (!clear(x, z)) continue;
      placed++;
      const tree = new THREE.Group();
      const h = 1.6 + rnd() * 1.4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, h, 6), trunkMat);
      trunk.position.y = h / 2;
      trunk.castShadow = true;
      const top = new THREE.Group();
      top.position.y = h;
      const blossom = !wooded && rnd() < 0.16;
      const leaf = blossom ? leafMats[3] : leafMats[Math.floor(rnd() * 3)];
      if ((wooded || rnd() < 0.4) && !blossom) {
        for (let k = 0; k < 3; k++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5 - k * 0.35, 1.7, 7), leaf);
          cone.position.y = 0.5 + k * 0.95;
          cone.castShadow = true;
          top.add(cone);
        }
      } else {
        for (let k = 0; k < 3; k++) {
          const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + rnd() * 0.6, 0), leaf);
          blob.position.set((rnd() - 0.5) * 1.3, 0.7 + rnd() * 0.9, (rnd() - 0.5) * 1.3);
          blob.castShadow = true;
          top.add(blob);
        }
      }
      const crown = bake(top);
      tree.add(trunk, crown);
      tree.position.set(x, 0, z);
      tree.scale.setScalar(0.8 + rnd() * 0.6);
      s.add(tree);
      this.canopies.push({ mesh: crown, phase: rnd() * 6.28 });
    }
    const petal = [0xff8fb1, 0xffe066, 0xffffff, 0xb79cff];
    const flowerGeo = new THREE.SphereGeometry(0.16, 6, 4);
    // One draw call per colour, however many flowers there are.
    const beds: [number, number][][] = petal.map(() => []);
    for (let i = 0; i < 380; i++) {
      // A flower meadow in the south, and a scattering everywhere else.
      const meadow = i % 3 === 0;
      const x = meadow ? 4 + (rnd() - 0.5) * 26 : (rnd() - 0.5) * 102;
      const z = meadow ? 41 + (rnd() - 0.5) * 14 : (rnd() - 0.5) * 102;
      if (!clear(x, z)) continue;
      beds[Math.floor(rnd() * 4)].push([x, z]);
    }
    beds.forEach((bed, k) => {
      const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshBasicMaterial({ color: petal[k] }), bed.length);
      const m = new THREE.Matrix4();
      bed.forEach(([x, z], i) => flowers.setMatrixAt(i, m.makeTranslation(x, 0.14, z)));
      s.add(flowers);
    });

    // Clouds, and the things that drift in the air: petals by day, fireflies by night.
    for (let i = 0; i < 7; i++) {
      const cloud = new THREE.Group();
      const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92, fog: false });
      for (let k = 0; k < 4; k++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + rnd() * 2.5, 1), cm);
        puff.position.set(k * 3.4 - 5, rnd() * 1.2, (rnd() - 0.5) * 3);
        puff.scale.y = 0.55;
        cloud.add(puff);
      }
      cloud.position.set((rnd() - 0.5) * 160, 34 + rnd() * 14, (rnd() - 0.5) * 160);
      s.add(cloud);
      this.clouds.push(cloud);
    }
    const n = 320;
    const mp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) mp.set([(rnd() - 0.5) * 108, 0.6 + rnd() * 7, (rnd() - 0.5) * 108], i * 3);
    const mg = new THREE.BufferGeometry();
    mg.setAttribute("position", new THREE.BufferAttribute(mp, 3));
    this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xffd1e0, size: 0.22, transparent: true, opacity: 0.9, depthWrite: false }));
    s.add(this.motes);

    // Rain for a thunderstorm: one set of points, made once, hidden until it storms.
    const drops = this.small ? 420 : 1100;
    const rp = new Float32Array(drops * 3);
    for (let i = 0; i < drops; i++) rp.set([(rnd() - 0.5) * 118, rnd() * 36, (rnd() - 0.5) * 118], i * 3);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.2, transparent: true, opacity: 0, depthWrite: false }));
    this.rain.visible = false;
    s.add(this.rain);
  }

  /** Whether a spot is free for a tree or a rock: on the grass, off the paths, clear of every building. */
  private clear(x: number, z: number) {
    if (Math.hypot(x, z) < 7.5 || Math.hypot(x, z) > ISLAND - 3.5) return false;
    for (const [kx, kz, r] of KEEP_OFF) if (Math.hypot(x - kx, z - kz) < r) return false;
    for (const [px, pz] of Object.values(PLACE_AT)) {
      if (Math.hypot(x - px, z - pz) < 9.5) return false;
      const t = THREE.MathUtils.clamp((x * px + z * pz) / (px * px + pz * pz), 0, 1);
      if (Math.hypot(x - px * t, z - pz * t) < 3.2) return false;
    }
    return true;
  }

  // -------------------------------------------------------------- countryside

  /**
   * Everything outside the town itself: a farm with a windmill and a pasture, a duck pond,
   * a camp in the woods, a lighthouse on the shore, boats at sea, and the animals that
   * live there. None of it comes from the server. It is scenery, and the animals wander
   * by themselves on each screen.
   */
  private buildCountryside(rnd: () => number) {
    const s = this.scene;
    const wood = mat(0x8a5a3a);
    const darkWood = mat(0x6b4226);

    // Hills along the far edge.
    for (const [x, z, r] of [[-20, -45, 8], [47, -4, 7], [-49, 17, 7], [17, 47, 8], [-38, -32, 6]] as const) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x7cc862));
      hill.scale.y = 0.45;
      hill.position.set(x, -0.05, z);
      hill.receiveShadow = true;
      s.add(hill);
    }

    // Stepping stones from the town out to the farm, the pond and the camp.
    const stoneMat = mat(0xd9ccb0);
    const trail = (from: readonly [number, number], to: readonly [number, number], n: number) => {
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.55 + rnd() * 0.25, 0.6, 0.12, 7), stoneMat);
        stone.position.set(from[0] + (to[0] - from[0]) * t + (rnd() - 0.5) * 0.9, 0.06, from[1] + (to[1] - from[1]) * t + (rnd() - 0.5) * 0.9);
        stone.receiveShadow = true;
        s.add(stone);
      }
    };
    trail([20, -16], [28, -27], 6);
    trail([-20, 18], [-30, 26], 6);
    trail([-22, -11], [-38, -7], 7);

    // --- The farm: a barn, rows of crops, a fenced pasture and a windmill.
    const barn = new THREE.Group();
    barn.add(box(5, 3.2, 4, mat(0xc44a3a), 0, 1.6, 0));
    barn.add(roof(5.6, 2, 4.6, mat(0x7a3028), 3.2));
    barn.add(box(1.5, 2, 0.12, mat(0xf2e6c8), 0, 1, 2.02));
    barn.add(box(0.9, 0.9, 0.12, mat(0xf2e6c8), 0, 2.9, 2.02));
    barn.position.set(27, 0, -32);
    barn.rotation.y = 0.5;
    s.add(bake(barn));
    for (let row = 0; row < 5; row++) {
      const bed = box(7, 0.16, 0.8, mat(0x8a6238), 0, 0.08, 0);
      bed.castShadow = false;
      const rowGroup = new THREE.Group();
      rowGroup.add(bed);
      for (let k = 0; k < 8; k++) {
        const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55 + rnd() * 0.3, 5), mat(row % 2 ? 0x6cc070 : 0xe8c34a));
        sprout.position.set(-3.1 + k * 0.88, 0.4, 0);
        rowGroup.add(sprout);
      }
      rowGroup.position.set(29, 0, -27.2 + row * 1.25);
      rowGroup.rotation.y = 0.5;
      s.add(bake(rowGroup));
    }
    const PASTURE: [number, number] = [37, -21];
    const posts = 18;
    const fence = new THREE.Group();
    for (let i = 0; i < posts; i++) {
      const a = (i / posts) * Math.PI * 2;
      const b = ((i + 1) / posts) * Math.PI * 2;
      const [px, pz] = [PASTURE[0] + Math.cos(a) * 6, PASTURE[1] + Math.sin(a) * 6];
      const [qx, qz] = [PASTURE[0] + Math.cos(b) * 6, PASTURE[1] + Math.sin(b) * 6];
      fence.add(box(0.18, 1, 0.18, darkWood, px, 0.5, pz));
      // Leave a gap for a gate on the side facing the barn.
      if (i === 9) continue;
      const rail = box(Math.hypot(qx - px, qz - pz), 0.1, 0.08, wood, (px + qx) / 2, 0.7, (pz + qz) / 2);
      rail.rotation.y = -Math.atan2(qz - pz, qx - px);
      fence.add(rail);
    }
    s.add(bake(fence));
    const mill = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.6, 5.4, 8), mat(0xf2e6c8));
    tower.position.y = 2.7;
    tower.castShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.4, 8), mat(0x7a3028));
    cap.position.y = 6.1;
    cap.castShadow = true;
    this.blades = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group();
      arm.add(box(0.14, 3.4, 0.08, darkWood, 0, 1.7, 0));
      arm.add(box(0.9, 2.4, 0.04, mat(0xfaf3e0), 0.5, 2.1, 0));
      arm.rotation.z = (k * Math.PI) / 2;
      this.blades.add(arm);
    }
    this.blades.position.set(0, 5, 1.25);
    mill.add(tower, cap, this.blades);
    mill.position.set(37, 0, -33);
    mill.rotation.y = -0.7;
    s.add(mill);

    // --- A pond in the south-west. It shares the lake's water, so it follows the sky too.
    const POND: [number, number] = [-33, 30];
    const pondShore = new THREE.Mesh(new THREE.CircleGeometry(5.6, 24), mat(0xe8d9a8, { flatShading: false }));
    pondShore.rotation.x = -Math.PI / 2;
    pondShore.position.set(POND[0], 0.03, POND[1]);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(4.8, 24), this.lake.material);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(POND[0], 0.07, POND[1]);
    s.add(pondShore, pond);
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2;
      const reed = new THREE.Mesh(new THREE.ConeGeometry(0.09, 1 + rnd(), 4), mat(0x5aa05a));
      reed.position.set(POND[0] + Math.cos(a) * 5, 0.5, POND[1] + Math.sin(a) * 5);
      s.add(reed);
    }
    const bench = new THREE.Group();
    bench.add(box(1.8, 0.12, 0.5, wood, 0, 0.5, 0), box(0.12, 0.5, 0.4, darkWood, -0.75, 0.25, 0), box(0.12, 0.5, 0.4, darkWood, 0.75, 0.25, 0), box(1.8, 0.5, 0.1, wood, 0, 0.85, -0.22));
    bench.position.set(POND[0] + 6.4, 0, POND[1] - 2);
    bench.rotation.y = -1.2;
    s.add(bake(bench));

    // --- A camp in the western woods, with a fire that is lit at night.
    const CAMP: [number, number] = [-42, -6];
    for (const [dx, dz, color, turn] of [[-2.2, 1.2, 0xe86a4a, 0.4], [2.1, 1.6, 0x4a90e8, -0.5]] as const) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.2, 4), mat(color));
      tent.position.set(CAMP[0] + dx, 1.1, CAMP[1] + dz);
      tent.rotation.y = Math.PI / 4 + turn;
      tent.castShadow = true;
      s.add(tent);
    }
    for (let k = 0; k < 3; k++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.1, 6), darkWood);
      log.rotation.set(Math.PI / 2, 0, (k * Math.PI) / 3);
      log.position.set(CAMP[0], 0.14, CAMP[1] - 1.4);
      s.add(log);
    }
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1, 6), new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff7a1a, emissiveIntensity: 0.6, flatShading: true }));
    this.flame.position.set(CAMP[0], 0.7, CAMP[1] - 1.4);
    this.fireLight = new THREE.PointLight(0xff9a4a, 0, 18, 1.8);
    this.fireLight.position.set(CAMP[0], 1.6, CAMP[1] - 1.4);
    s.add(this.flame, this.fireLight);
    for (const [dx, dz] of [[-1.6, -2.6], [1.5, -2.9]] as const) {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.5, 8), wood);
      seat.position.set(CAMP[0] + dx, 0.25, CAMP[1] + dz);
      seat.castShadow = true;
      s.add(seat);
    }

    // --- A lighthouse on the eastern shore. Its lamp comes on with the lanterns.
    const light = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 + rnd() * 0.9, 0), mat(0x8f8f9c));
      rock.position.set((rnd() - 0.5) * 4.5, 0.3, (rnd() - 0.5) * 4.5);
      rock.castShadow = true;
      light.add(rock);
    }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.35, 7, 10), mat(0xfaf6ee));
    shaft.position.y = 4.2;
    shaft.castShadow = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.2, 1.5, 10), mat(0xd9483b));
    band.position.y = 4;
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.2, 10), mat(0x4a3b33));
    gallery.position.y = 7.8;
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0xfff0c2, emissive: 0xffd27a, emissiveIntensity: 0 }));
    lamp.position.y = 8.45;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1, 8), mat(0xd9483b));
    hat.position.y = 9.5;
    light.add(shaft, band, gallery, lamp, hat);
    light.position.set(49, 0, 21);
    s.add(light);
    this.glows.push({ mesh: lamp, place: null, base: 1 });

    // Rocks and mushrooms here and there.
    for (let i = 0; i < 26; i++) {
      const x = (rnd() - 0.5) * 100;
      const z = (rnd() - 0.5) * 100;
      if (!this.clear(x, z)) continue;
      if (i % 3) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + rnd() * 0.5, 0), mat(0x9a9aa6));
        rock.position.set(x, 0.2, z);
        rock.castShadow = true;
        s.add(rock);
      } else {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.3, 6), mat(0xfaf3e0));
        stem.position.set(x, 0.15, z);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe2483a));
        head.position.set(x, 0.3, z);
        s.add(stem, head);
      }
    }

    // --- Boats. Two rest offshore; one sails slowly round the island.
    const boat = (sail: number) => {
      const g = new THREE.Group();
      g.add(box(3, 0.7, 1.2, mat(0x8a5a3a), 0, 0.1, 0), box(0.1, 3, 0.1, darkWood, 0, 1.7, 0));
      const cloth = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 3), mat(sail));
      cloth.position.set(0.5, 1.9, 0);
      cloth.scale.z = 0.12;
      g.add(cloth);
      return bake(g);
    };
    for (const [x, z, color, turn] of [[68, -38, 0xfaf3e0, 0.6], [-70, 22, 0xffd166, 2.2]] as const) {
      const g = boat(color);
      g.position.set(x, -0.6, z);
      g.rotation.y = turn;
      s.add(g);
      this.critters.push({ g, kind: "boat", home: [x, z], reach: 0, speed: 0, phase: rnd() * 6, to: null, wait: 0, y: -0.6 });
    }
    const sailing = boat(0xff8fb1);
    s.add(sailing);
    this.critters.push({ g: sailing, kind: "sailor", home: [0, 0], reach: 82, speed: 1.6, phase: rnd() * 6, to: null, wait: 0, y: -0.6 });

    // --- Animals.
    const beast = (body: number, head: number, legs: number, long: number, tall: number, extra?: (g: THREE.Group) => void) => {
      const g = new THREE.Group();
      g.add(box(long, tall * 0.55, long * 0.55, mat(body), 0, tall * 0.72, 0));
      g.add(box(long * 0.34, tall * 0.4, long * 0.36, mat(head), long * 0.62, tall * 0.92, 0));
      for (const [lx, lz] of [[-0.32, -0.18], [-0.32, 0.18], [0.32, -0.18], [0.32, 0.18]] as const) {
        g.add(box(0.1, tall * 0.48, 0.1, mat(legs), lx * long, tall * 0.24, lz * long));
      }
      extra?.(g);
      return g;
    };
    const walker = (made: THREE.Group, home: [number, number], reach: number, speed: number) => {
      const g = bake(made);
      const a = rnd() * Math.PI * 2;
      const r = rnd() * reach;
      g.position.set(home[0] + Math.cos(a) * r, 0, home[1] + Math.sin(a) * r);
      g.rotation.y = rnd() * 6.28;
      s.add(g);
      this.critters.push({ g, kind: "walker", home, reach, speed, phase: rnd() * 6, to: null, wait: rnd() * 4, y: 0 });
    };
    for (let i = 0; i < 5; i++) {
      // Sheep: a woolly body on dark legs.
      walker(
        beast(0xfaf6ee, 0x3a3340, 0x3a3340, 1.1, 0.9, (g) => {
          const wool = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat(0xffffff));
          wool.position.set(-0.05, 0.75, 0);
          wool.scale.set(1.15, 0.85, 0.9);
          wool.castShadow = true;
          g.add(wool);
        }),
        PASTURE,
        4.6,
        0.7,
      );
    }
    for (let i = 0; i < 2; i++) {
      // Cows: white with brown patches.
      walker(
        beast(0xfaf6ee, 0x6b4226, 0x3a3340, 1.6, 1.15, (g) => {
          g.add(box(0.5, 0.36, 0.92, mat(0x6b4226), -0.3, 0.92, 0), box(0.36, 0.3, 0.9, mat(0x6b4226), 0.35, 0.74, 0));
        }),
        PASTURE,
        4.2,
        0.45,
      );
    }
    for (let i = 0; i < 4; i++) {
      // Chickens by the barn.
      const g = new THREE.Group();
      const hen = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), mat(i % 2 ? 0xffffff : 0xd98a3a));
      hen.position.y = 0.3;
      hen.castShadow = true;
      const comb = box(0.08, 0.12, 0.16, mat(0xe2483a), 0.14, 0.56, 0);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), mat(0xffb347));
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(0.3, 0.36, 0);
      g.add(hen, comb, beak);
      walker(g, [27, -27.5], 2.6, 0.9);
    }
    for (let i = 0; i < 2; i++) {
      // Deer in the northern woods.
      walker(
        beast(0xb07a4a, 0xb07a4a, 0x7a5232, 1.3, 1.5, (g) => {
          for (const dz of [-0.14, 0.14]) {
            const antler = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 4), mat(0xe8d9b8));
            antler.position.set(0.86, 1.85, dz);
            g.add(antler);
          }
        }),
        [-4, -41],
        6.5,
        0.8,
      );
    }
    const duck = (color: number) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(color));
      body.scale.set(1.3, 0.75, 0.9);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), mat(color));
      head.position.set(0.3, 0.26, 0);
      const bill = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), mat(0xff9a3a));
      bill.rotation.z = -Math.PI / 2;
      bill.position.set(0.52, 0.24, 0);
      g.add(body, head, bill);
      return bake(g);
    };
    const [lx, lz] = PLACE_AT.lake;
    for (const [home, reach, color] of [[POND, 1.4, 0xffffff], [POND, 2.4, 0xffe066], [POND, 3.3, 0xffffff], [POND, 3.9, 0x8a6238], [[lx + 3, lz + 3], 3.2, 0xffffff], [[lx + 3, lz + 3], 5, 0xffe066]] as const) {
      const g = duck(color);
      s.add(g);
      this.critters.push({ g, kind: "swimmer", home: [home[0], home[1]], reach, speed: 0.5 + rnd() * 0.4, phase: rnd() * 6.28, to: null, wait: 0, y: 0.2 });
    }
    for (let i = 0; i < 7; i++) {
      // Birds, circling high over the island.
      const g = new THREE.Group();
      const wingMat = new THREE.MeshBasicMaterial({ color: 0x2b2350, side: THREE.DoubleSide, fog: false });
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 4), wingMat);
      body.rotation.z = -Math.PI / 2;
      g.add(body);
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.9), wingMat);
        wing.rotation.x = Math.PI / 2;
        wing.position.z = side * 0.45;
        wing.userData.side = side;
        g.add(wing);
      }
      s.add(g);
      this.critters.push({ g, kind: "flyer", home: [(rnd() - 0.5) * 14, (rnd() - 0.5) * 14], reach: 22 + rnd() * 20, speed: 5 + rnd() * 3, phase: rnd() * 6.28, to: null, wait: 0, y: 19 + rnd() * 9 });
    }
  }

  /** The animals and boats move by themselves; under reduced motion they stay where they are. */
  private stirCountryside(dt: number, time: number, night: number) {
    this.blades.rotation.z -= dt * (this.state.weather?.kind === "storm" ? 2.6 : 0.7);
    const flicker = 0.75 + 0.25 * Math.sin(time * 11) * Math.sin(time * 7.3);
    this.flame.scale.set(1, (0.5 + night * 0.7) * flicker, 1);
    (this.flame.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + night * 1.8 * flicker;
    this.fireLight.intensity = night * 16 * flicker;
    if (this.reduced) return;
    for (const c of this.critters) {
      const p = c.g.position;
      if (c.kind === "walker") {
        if (c.wait > 0) {
          c.wait -= dt;
          p.y = 0;
          continue;
        }
        if (!c.to) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * c.reach;
          c.to = new THREE.Vector3(c.home[0] + Math.cos(a) * r, 0, c.home[1] + Math.sin(a) * r);
        }
        const dx = c.to.x - p.x;
        const dz = c.to.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.15) {
          // Arrived: graze for a while. Animals sleep through most of the night.
          c.to = null;
          c.wait = 1.5 + Math.random() * 5 + night * 12;
          continue;
        }
        const step = Math.min(dist, c.speed * dt);
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
        p.y = Math.abs(Math.sin(time * 9 + c.phase)) * 0.07;
        c.g.rotation.y = lerpAngle(c.g.rotation.y, Math.atan2(-dz, dx), 1 - Math.pow(0.002, dt));
      } else if (c.kind === "swimmer") {
        c.phase += (c.speed / c.reach) * dt;
        p.set(c.home[0] + Math.cos(c.phase) * c.reach, c.y + Math.sin(time * 2.2 + c.reach) * 0.03, c.home[1] + Math.sin(c.phase) * c.reach);
        c.g.rotation.y = -c.phase - Math.PI / 2;
      } else if (c.kind === "flyer") {
        c.phase += (c.speed / c.reach) * dt;
        p.set(c.home[0] + Math.cos(c.phase) * c.reach, c.y + Math.sin(time * 0.7 + c.reach) * 1.2, c.home[1] + Math.sin(c.phase) * c.reach);
        c.g.rotation.y = -c.phase - Math.PI / 2;
        for (const wing of c.g.children) {
          if (wing.userData.side) wing.rotation.x = Math.PI / 2 + wing.userData.side * Math.sin(time * 9 + c.reach) * 0.7;
        }
      } else if (c.kind === "sailor") {
        c.phase += (c.speed / c.reach) * dt;
        p.set(Math.cos(c.phase) * c.reach, c.y + Math.sin(time * 1.1) * 0.12, Math.sin(c.phase) * c.reach);
        c.g.rotation.y = -c.phase - Math.PI / 2;
        c.g.rotation.z = Math.sin(time * 0.9) * 0.05;
      } else {
        p.y = c.y + Math.sin(time * 1.1 + c.phase) * 0.12;
        c.g.rotation.z = Math.sin(time * 0.8 + c.phase) * 0.06;
      }
    }
  }

  private lantern(x: number, z: number, place: string | null) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.6, 6), mat(0x4a3b33));
    post.position.set(x, 1.3, z);
    post.castShadow = true;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff0c2, emissive: 0xffb347, emissiveIntensity: 0 }));
    lamp.position.set(x, 2.75, z);
    this.scene.add(post, lamp);
    this.glows.push({ mesh: lamp, place, base: 1 });
  }

  private windowMat() {
    const m = new THREE.MeshStandardMaterial({ color: 0x55637a, emissive: 0xffc76b, emissiveIntensity: 0, roughness: 0.4 });
    this.windows.push(m);
    return m;
  }

  private buildTavern() {
    const [x, z] = PLACE_AT.tavern;
    const g = new THREE.Group();
    g.position.set(x - 2.5, 0, z - 2.5);
    g.rotation.y = Math.PI / 4;
    g.add(box(8, 3.6, 6, mat(0xf3e2c0), 0, 1.8, 0), roof(8.8, 3.4, 6.8, mat(0xb5523b), 3.6));
    for (const dx of [-3.4, 3.4]) g.add(box(0.5, 3.8, 0.5, mat(0x7a4b2e), dx, 1.9, 3.05));
    g.add(box(1.5, 2.3, 0.2, mat(0x7a4b2e), 0, 1.15, 3.05));
    for (const dx of [-2.3, 2.3]) g.add(box(1.3, 1.2, 0.15, this.windowMat(), dx, 2.1, 3.05));
    g.add(box(1, 2.6, 1, mat(0x9a8f86), 2.6, 5.3, -1.2));
    // A swinging sign, and barrels out front.
    g.add(box(1.4, 0.9, 0.12, mat(0xe9b44c), -3.9, 2.9, 3.6));
    for (const [bx, bz] of [[3.6, 4.4], [4.4, 3.6], [-4.6, 4.2]] as const) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 10), mat(0x9a6a3c));
      barrel.position.set(bx, 0.55, bz);
      barrel.castShadow = true;
      g.add(barrel);
    }
    this.scene.add(g);
    // Chimney smoke: more of it when the tavern is busy.
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0, roughness: 1 }));
      this.scene.add(puff);
      this.smoke.push({ mesh: puff, t: i / 6 });
    }
  }

  private buildMarket(rnd: () => number) {
    const [x, z] = PLACE_AT.market;
    const colors = [0xff6b6b, 0x4dabf7, 0xffd43b, 0x69db7c];
    const spots = [[2.5, -3.5], [5.5, -0.5], [-1.5, -5], [5, 3.2]] as const;
    spots.forEach(([dx, dz], i) => {
      const g = new THREE.Group();
      g.position.set(x + dx, 0, z + dz);
      g.rotation.y = -Math.PI / 4 + (rnd() - 0.5) * 0.5;
      for (const [px, pz] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]] as const) g.add(box(0.14, 2.4, 0.14, mat(0x8a5a3a), px, 1.2, pz));
      const awning = box(3.2, 0.16, 2.4, mat(colors[i]), 0, 2.5, 0);
      awning.rotation.x = 0.12;
      g.add(awning, box(2.8, 0.9, 1.4, mat(0xc79a63), 0, 0.45, 0));
      for (let k = 0; k < 5; k++) {
        const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat([0xff922b, 0xfa5252, 0x94d82d][k % 3]));
        fruit.position.set(-1 + k * 0.5, 1.05, (rnd() - 0.5) * 0.7);
        g.add(fruit);
      }
      this.scene.add(g);
    });
    for (let i = 0; i < 5; i++) this.scene.add(box(0.9, 0.9, 0.9, mat(0xb98a55), x - 3 + rnd() * 2, 0.45, z + 3 + rnd() * 3));
  }

  private buildGuild() {
    const [x, z] = PLACE_AT.guild;
    const g = new THREE.Group();
    g.position.set(x - 2.5, 0, z + 2.5);
    g.rotation.y = (3 * Math.PI) / 4;
    const stoneMat = mat(0xb9bdc9);
    g.add(box(9, 4.4, 6.5, stoneMat, 0, 2.2, 0), roof(9.8, 3, 7.2, mat(0x4b5d8f), 4.4));
    g.add(box(3, 8.5, 3, stoneMat, 4.4, 4.25, -1.6), at(roof(3.6, 2.6, 3.6, mat(0x4b5d8f), 8.5), 4.4, -1.6));
    g.add(box(2, 2.8, 0.25, mat(0x5b3d2a), 0, 1.4, 3.3), box(5, 0.35, 1.6, stoneMat, 0, 0.17, 4));
    for (const dx of [-3, 3]) g.add(box(1.1, 1.7, 0.15, this.windowMat(), dx, 2.7, 3.3));
    // A banner that stirs in the wind.
    const pole = box(0.12, 4, 0.12, mat(0x4a3b33), -4.9, 6.2, 3);
    this.banner = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4, 6, 1), new THREE.MeshStandardMaterial({ color: 0x836ef9, side: THREE.DoubleSide, roughness: 0.9 }));
    this.banner.position.set(-4.05, 6.8, 3);
    g.add(pole, this.banner, box(1.6, 1.8, 0.1, mat(0xf3e2c0), -2.2, 1.3, 3.36));
    this.scene.add(g);
  }

  private buildLake(rnd: () => number) {
    const [x, z] = PLACE_AT.lake;
    const cx = x + 3;
    const cz = z + 3;
    const shore = new THREE.Mesh(new THREE.CircleGeometry(8.4, 32), mat(0xe8d9a8, { flatShading: false }));
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(cx, 0.03, cz);
    this.lake = new THREE.Mesh(new THREE.CircleGeometry(7.4, 32), new THREE.MeshStandardMaterial({ color: 0x4fb3ff, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.92 }));
    this.lake.rotation.x = -Math.PI / 2;
    this.lake.position.set(cx, 0.07, cz);
    this.scene.add(shore, this.lake);
    const dock = new THREE.Group();
    dock.position.set(cx - 5.4, 0, cz - 5.4);
    dock.rotation.y = Math.PI / 4;
    dock.add(box(1.6, 0.18, 6, mat(0xa8774a), 0, 0.45, 2));
    for (const dz of [0, 2.4, 4.6]) for (const dx of [-0.7, 0.7]) dock.add(box(0.16, 1, 0.16, mat(0x7a4b2e), dx, 0.2, dz));
    this.scene.add(dock);
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      const reed = new THREE.Mesh(new THREE.ConeGeometry(0.09, 1.2 + rnd(), 4), mat(0x5aa05a));
      reed.position.set(cx + Math.cos(a) * 7.6, 0.6, cz + Math.sin(a) * 7.6);
      this.scene.add(reed);
      if (i % 3 === 0) {
        const pad = new THREE.Mesh(new THREE.CircleGeometry(0.5, 8), mat(0x3f9a4c));
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(cx + Math.cos(a) * rnd() * 5.5, 0.09, cz + Math.sin(a) * rnd() * 5.5);
        this.scene.add(pad);
      }
    }
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), mat(0x9a9aa6));
    rock.position.set(cx + 6.8, 0.5, cz - 4.5);
    rock.castShadow = true;
    this.scene.add(rock);
  }

  // ---------------------------------------------------------------- residents

  private makeBody(a: SceneAgent): Body {
    const sp = speciesById(a.kind) ?? SPECIES[0];
    const has = (extra: (typeof sp.extras)[number]) => sp.extras.includes(extra);
    const base = new THREE.Color(sp.body);
    const deep = new THREE.Color(sp.deep);
    const skin = new THREE.MeshStandardMaterial({ color: base, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: deep, roughness: 0.6 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 16), skin);
    body.scale.set(1, 1.05, 0.95);
    body.position.y = 0.86;
    body.castShadow = true;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 10), new THREE.MeshStandardMaterial({ color: has("bib") || has("muzzle") ? new THREE.Color(0xffffff) : base.clone().lerp(new THREE.Color(0xffffff), 0.45), roughness: 0.7 }));
    belly.position.set(0, 0.68, 0.36);
    belly.scale.set(has("bib") ? 1.25 : 1, has("bib") ? 1.15 : 0.8, 0.6);
    g.add(body, belly);
    for (const sx of [-1, 1]) {
      // Ears, by species.
      if (sp.ears === "round") {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), dark);
        ear.position.set(sx * 0.46, 1.52, 0);
        g.add(ear);
      } else if (sp.ears === "pointed") {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 4), dark);
        ear.position.set(sx * 0.42, 1.66, 0);
        ear.rotation.z = -sx * 0.25;
        g.add(ear);
      } else if (sp.ears === "long") {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), dark);
        ear.scale.set(0.6, 2.5, 0.45);
        ear.position.set(sx * 0.26, 1.95, 0);
        ear.rotation.z = -sx * 0.14;
        g.add(ear);
      } else if (sp.ears === "big") {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 8), dark);
        ear.scale.z = 0.5;
        ear.position.set(sx * 0.62, 1.46, 0);
        g.add(ear);
      } else if (sp.ears === "floppy") {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), dark);
        ear.scale.set(0.6, 1.5, 0.7);
        ear.position.set(sx * 0.74, 1.12, 0);
        ear.rotation.z = sx * 0.45;
        g.add(ear);
      }
      if (has("horns")) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0xfff1c2, roughness: 0.5 }));
        horn.position.set(sx * 0.3, 1.7, 0.08);
        horn.rotation.z = -sx * 0.3;
        g.add(horn);
      }
      if (has("antennae")) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 5), new THREE.MeshStandardMaterial({ color: 0x2b2350 }));
        stalk.position.set(sx * 0.24, 1.78, 0.05);
        stalk.rotation.z = -sx * 0.3;
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: sp.deep === "#2B2350" ? 0xffc800 : deep }));
        tip.position.set(sx * 0.31, 2.02, 0.05);
        g.add(stalk, tip);
      }
      if (has("gills")) {
        for (const dy of [-0.16, 0.04, 0.24]) {
          const gill = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 5), new THREE.MeshStandardMaterial({ color: sp.cheeks ?? "#FF6FA5" }));
          gill.position.set(sx * 0.86, 1.02 + dy, 0);
          gill.rotation.z = -sx * (Math.PI / 2 - dy);
          g.add(gill);
        }
      }
      if (has("bolts")) {
        const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.26), dark);
        bolt.position.set(sx * 0.76, 0.98, 0);
        g.add(bolt);
      }
      if (has("patches")) {
        const patch = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshStandardMaterial({ color: 0x2b2350, roughness: 0.6 }));
        patch.scale.z = 0.35;
        patch.position.set(sx * 0.27, 1.02, 0.55);
        g.add(patch);
      }
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), dark);
      foot.scale.set(1, 0.55, 1.2);
      foot.position.set(sx * 0.3, 0.12, 0.08);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
      eye.position.set(sx * 0.27, 1.02, 0.6);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2b2350, roughness: 0.3 }));
      pupil.position.set(sx * 0.27, 1.01, 0.74);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff9ec4 }));
      cheek.position.set(sx * 0.5, 0.82, 0.5);
      cheek.scale.z = 0.4;
      g.add(foot, eye, pupil, cheek);
    }
    // Wings, for the two that have them. They beat in the frame loop.
    const wings: Body["wings"] = [];
    if (sp.wings !== "none") {
      for (const sx of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(sx * 0.42, 1.25, -0.28);
        const wing =
          sp.wings === "bee"
            ? new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, roughness: 0.3 }))
            : new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 3), dark);
        wing.scale.set(1.5, sp.wings === "bee" ? 0.12 : 1, sp.wings === "bee" ? 0.8 : 0.16);
        wing.position.x = sx * 0.46;
        if (sp.wings === "bat") wing.rotation.z = -sx * 1.1;
        pivot.add(wing);
        g.add(pivot);
        wings.push({ mesh: pivot, side: sx, fast: sp.wings === "bee" });
      }
    }
    // A tail, where the species has an obvious one.
    if (sp.tail === "bushy" || sp.tail === "curl" || sp.tail === "spike" || sp.tail === "fin" || sp.tail === "rainbow") {
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), sp.tail === "rainbow" ? new THREE.MeshStandardMaterial({ color: 0xff9ec4 }) : dark);
      tail.scale.set(0.7, 0.7, 1.9);
      tail.position.set(0.1, 0.62, -0.82);
      tail.rotation.x = -0.6;
      g.add(tail);
      if (sp.tail === "bushy") {
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        tip.position.set(0.1, 0.92, -1.2);
        g.add(tip);
      }
    } else if (sp.tail === "pom" || sp.tail === "nub") {
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), sp.tail === "pom" ? new THREE.MeshStandardMaterial({ color: 0xffffff }) : dark);
      pom.position.set(0, 0.5, -0.72);
      g.add(pom);
    } else if (sp.tail === "stinger") {
      const sting = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.36, 5), new THREE.MeshStandardMaterial({ color: 0x2b2350 }));
      sting.rotation.x = -Math.PI / 2;
      sting.position.set(0, 0.6, -0.86);
      g.add(sting);
    }
    // One-offs on top of the head and on the face.
    if (has("horn")) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.4 }));
      horn.position.set(0, 1.86, 0.22);
      horn.rotation.x = 0.25;
      g.add(horn);
    }
    if (has("antenna")) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 5), new THREE.MeshStandardMaterial({ color: 0x2b2350 }));
      stalk.position.set(0, 1.8, 0);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff4b4b, emissive: 0xff4b4b, emissiveIntensity: 0.4 }));
      tip.position.set(0, 2.04, 0);
      g.add(stalk, tip);
    }
    if (has("spikes") || has("tuft")) {
      for (const [dz, h] of [[0.18, 0.3], [-0.04, 0.38], [-0.26, 0.28]] as const) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, h, 5), sp.id === "unicorn" ? new THREE.MeshStandardMaterial({ color: 0xff9ec4 }) : dark);
        spike.position.set(0, 1.62 + h / 2 - Math.abs(dz) * 0.3, dz);
        g.add(spike);
      }
    }
    if (has("beak")) {
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 6), new THREE.MeshStandardMaterial({ color: 0xff9a3a, roughness: 0.5 }));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.86, 0.76);
      g.add(beak);
    }
    if (has("snout")) {
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: sp.id === "koala" ? 0x2b2350 : 0xffd9e0, roughness: 0.6 }));
      snout.scale.set(1.2, 0.8, 0.7);
      snout.position.set(0, 0.82, 0.66);
      g.add(snout);
    }
    if (has("bands")) {
      for (const [y, r] of [[0.56, 0.66], [1.16, 0.65]] as const) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 20), new THREE.MeshStandardMaterial({ color: 0x2b2350, roughness: 0.6 }));
        band.rotation.x = Math.PI / 2;
        band.scale.y = 0.95;
        band.position.y = y;
        g.add(band);
      }
    }
    g.userData.agent = a.id;
    g.traverse((o) => (o.userData.agent = a.id));

    let marker: THREE.Object3D | null = null;
    if (a.mine) {
      marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: 0xffc800 }));
      marker.position.y = 2.5;
      g.add(marker);
    }

    const tag = document.createElement("div");
    tag.textContent = a.name;
    tag.style.cssText = `font:800 11px var(--font-nunito),system-ui;padding:1px 7px;border-radius:999px;background:${a.mine ? "#836ef9" : a.owned ? "#e6e0ff" : "rgba(255,255,255,.88)"};color:${a.mine ? "#fff" : a.owned ? "#4b3fae" : "#3c3c3c"};${a.owned && !a.mine ? "border:1.5px solid #836ef9;" : ""}white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,.18)`;
    const label = new CSS2DObject(tag);
    label.position.set(0, sp.ears === "long" || has("antennae") || has("antenna") || has("horn") ? 2.3 : 1.95, 0);
    label.center.set(0.5, 1);

    const bubbleEl = document.createElement("div");
    bubbleEl.style.cssText = "font:700 12px/1.25 var(--font-nunito),system-ui;max-width:190px;padding:6px 10px;border-radius:14px 14px 14px 4px;background:#fff;color:#3c3c3c;border:2px solid #e5e5e5;box-shadow:0 3px 8px rgba(0,0,0,.18);opacity:0;transition:opacity .3s";
    const bubble = new CSS2DObject(bubbleEl);
    bubble.position.set(0, 2.5, 0);
    bubble.center.set(0.5, 1);

    const emoteEl = document.createElement("div");
    emoteEl.style.cssText = "font-size:20px;opacity:0;transition:opacity .3s,transform .9s;transform:translateY(0)";
    const emote = new CSS2DObject(emoteEl);
    emote.position.set(0.6, 2.2, 0);

    g.add(label, bubble, emote);
    // Bigger than life, so residents read clearly against the buildings.
    g.scale.setScalar(1.7);
    this.scene.add(g);
    return { group: g, body, marker, label, bubble, bubbleEl, emote, emoteEl, path: [], place: "", slot: 0, phase: Math.random() * 6.28, lookAt: null, bubbleUntil: 0, emoteUntil: 0, scale: 1, gait: sp.gait, wings };
  }

  /** Where the nth resident at a place stands: a loose arc on the plaza side of it. */
  private spot(place: string, n: number) {
    const [x, z] = PLACE_AT[place] ?? PLAZA;
    const toward = Math.atan2(-z, -x);
    const ring = Math.floor(n / 6);
    const a = toward + ((n % 6) - 2.5) * 0.5;
    const r = 5.6 + ring * 2.8;
    return new THREE.Vector3(x + Math.cos(a) * r, 0, z + Math.sin(a) * r);
  }

  /** The newest state from the server. Called every poll, and whenever the selection changes. */
  update(next: SceneState) {
    const prev = this.state;
    this.state = next;
    const seen = new Set<number>();
    const counts: Record<string, number> = {};
    for (const a of [...next.agents].sort((x, y) => x.id - y.id)) {
      if (a.paused) continue;
      seen.add(a.id);
      let b = this.bodies.get(a.id);
      const slot = (counts[a.place] = (counts[a.place] ?? 0) + 1) - 1;
      const target = this.spot(a.place, slot);
      if (!b) {
        b = this.makeBody(a);
        b.group.position.copy(target);
        b.group.rotation.y = Math.random() * 6.28;
        this.bodies.set(a.id, b);
      } else if (b.place !== a.place) {
        // Walk the paths: back to the plaza, then out to the new place.
        const here = b.group.position.clone();
        const via = new THREE.Vector3((Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5);
        b.path = here.length() < 7 ? [target] : [via, target];
      } else if (b.slot !== slot && b.path.length === 0) {
        b.path = [target];
      }
      b.place = a.place;
      b.slot = slot;
      // The first time your own pet appears, the camera comes down to it.
      if (a.mine && !this.greeted) {
        this.greeted = true;
        this.follow = a.id;
        this.flyTo(target.clone().add(new THREE.Vector3(10, 11, 17)));
      }
    }
    for (const [id, b] of this.bodies) {
      if (seen.has(id)) continue;
      this.scene.remove(b.group);
      b.label.element.remove();
      b.bubble.element.remove();
      b.emote.element.remove();
      this.bodies.delete(id);
    }

    // A new line of talk: the two turn to each other, a bubble appears, and how it went shows.
    const t = next.talk;
    if (t && t.id !== this.lastTalk) {
      this.lastTalk = t.id;
      const now = performance.now();
      const a = this.bodies.get(t.aId);
      const b = t.bId !== null ? this.bodies.get(t.bId) : undefined;
      if (a && b) {
        a.lookAt = b.group.position;
        b.lookAt = a.group.position;
        const emoji = t.delta >= 6 ? "💛" : t.delta > 0 ? "✨" : t.delta < 0 ? "💢" : "💬";
        for (const who of [a, b]) {
          who.emoteEl.textContent = emoji;
          who.emoteEl.style.opacity = "1";
          who.emoteEl.style.transform = "translateY(-14px)";
          who.emoteUntil = now + 3200;
        }
      }
      const speaker = t.speaker !== null ? this.bodies.get(t.speaker) : undefined;
      if (speaker && t.line) {
        speaker.bubbleEl.textContent = t.line.length > 90 ? `${t.line.slice(0, 88)}…` : t.line;
        speaker.bubbleEl.style.opacity = "1";
        speaker.bubbleUntil = now + 5200;
      }
    }
    if (next.selected !== prev.selected && next.selected !== null) {
      this.follow = next.selected;
      this.userMoved = false;
    }
  }

  /** Bring the camera back to a resident, or pull out to see the whole town. */
  focus(id: number | null) {
    this.userMoved = false;
    this.follow = id;
    if (id === null) {
      this.wantTarget.set(0, 1, 0);
      this.flyTo(new THREE.Vector3(0, 52, 72));
    } else {
      const b = this.bodies.get(id);
      if (b) this.flyTo(b.group.position.clone().add(new THREE.Vector3(10, 11, 17)));
    }
  }

  private flight: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  private flyTo(to: THREE.Vector3) {
    this.flight = { from: this.camera.position.clone(), to, t: this.reduced ? 1 : 0 };
  }

  // -------------------------------------------------------------------- frame

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.elapsedTime;
    const now = performance.now();
    // The hour keeps moving between ticks, so dusk arrives smoothly and never in steps.
    const hour = this.state.hour + Math.min(1, ((now - this.state.hourAt) / 1000) * this.state.hourRate);
    const sky = skyAt(hour);

    // Weather rolls in and out over a couple of seconds and never snaps.
    const kind = this.state.weather?.kind ?? null;
    const ease = Math.min(1, dt * 1.6);
    this.storm += ((kind === "storm" ? 1 : 0) - this.storm) * ease;
    this.moonlit += ((kind === "moon" ? 1 : 0) - this.moonlit) * ease;
    if (this.storm > 0.01) {
      // A thunderstorm: slate sky, half the light, lamps lit in the middle of the day.
      const slate = new THREE.Color(0x39414f);
      sky.top.lerp(slate, 0.8 * this.storm);
      sky.low.lerp(new THREE.Color(0x5b6573), 0.8 * this.storm);
      sky.fog.lerp(new THREE.Color(0x4a5360), 0.8 * this.storm);
      sky.sun.lerp(new THREE.Color(0xaab6c8), 0.7 * this.storm);
      sky.light *= 1 - 0.62 * this.storm;
      sky.night = Math.max(sky.night, 0.75 * this.storm);
    }
    if (this.moonlit > 0.01) {
      // A giant moon: the town goes to a clear blue night whatever the hour.
      sky.top.lerp(new THREE.Color(0x0b1030), 0.85 * this.moonlit);
      sky.low.lerp(new THREE.Color(0x2a3a7a), 0.85 * this.moonlit);
      sky.fog.lerp(new THREE.Color(0x1f2a5c), 0.85 * this.moonlit);
      sky.sun.lerp(new THREE.Color(0xbfd0ff), this.moonlit);
      sky.light += (0.42 - sky.light) * this.moonlit;
      sky.night = Math.max(sky.night, this.moonlit);
    }
    // Lightning: a short spike of light every few seconds. Not under reduced motion.
    if (this.storm > 0.6 && !this.reduced && time > this.nextFlash) {
      this.flash = 1;
      this.nextFlash = time + 4 + Math.random() * 5;
    }
    this.flash = Math.max(0, this.flash - dt / 0.12);

    // Sky, sun or moon, light and fog all follow the hour.
    const pos = this.sky.geometry.attributes.position;
    const col = this.sky.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const c = sky.low.clone().lerp(sky.top, Math.pow(Math.max(0, pos.getY(i) / 220), 0.6));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    const dayAngle = ((hour - 6) / 24) * Math.PI * 2;
    const up = Math.sin(dayAngle);
    const dir = new THREE.Vector3(Math.cos(dayAngle) * 0.9, Math.abs(up) * 0.95 + 0.12, 0.45).normalize();
    this.sunDisc.position.copy(dir).multiplyScalar(190);
    (this.sunDisc.material as THREE.MeshBasicMaterial).color.copy(up >= 0 ? sky.sun : new THREE.Color(0xdfe6ff));
    this.sunDisc.scale.setScalar(up >= 0 ? 1 : 0.7);
    if (this.moonlit > 0.5) {
      // The giant moon hangs over the lake's side of the island, twice its usual size.
      this.sunDisc.position.set(0.42, 0.62, 0.5).normalize().multiplyScalar(190);
      (this.sunDisc.material as THREE.MeshBasicMaterial).color.set(0xf4f6ff);
      this.sunDisc.scale.setScalar(0.7 + 1.3 * this.moonlit);
    }
    this.sun.position.copy(dir).multiplyScalar(90);
    this.sun.color.copy(sky.sun);
    // Bright, soft daylight; nights stay readable under a blue moon instead of going black.
    this.sun.intensity = 0.15 + sky.light * 2.3;
    this.hemi.intensity = 0.42 + sky.light * 1.15 + this.flash * 3.5;
    this.hemi.color.copy(sky.top).lerp(new THREE.Color(0xffffff), 0.6);
    this.hemi.groundColor.set(sky.night > 0.5 ? 0x33406b : 0x86a86a);
    (this.scene.fog as THREE.Fog).color.copy(sky.fog);
    (this.stars.material as THREE.PointsMaterial).opacity = sky.night * 0.9;
    this.renderer.toneMappingExposure = 1.05 + sky.light * 0.25;

    // Lanterns and windows come on at dusk; a busy place burns brighter.
    for (const g of this.glows) {
      const busy = g.place ? Math.min(1, (this.state.buzz[g.place] ?? 0) / 8) : 0.6;
      (g.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = sky.night * (0.8 + busy * 2.2) * (0.92 + 0.08 * Math.sin(time * 5 + g.mesh.position.x));
    }
    for (const w of this.windows) w.emissiveIntensity = sky.night * 1.6;
    for (const [place, light] of Object.entries(this.placeLights)) {
      // The place the weather fills is lit up even at midday, and burns brighter than the rest.
      const here = this.state.weather?.place === place;
      light.intensity = (here ? Math.max(sky.night, 0.55) * 1.6 : sky.night) * (6 + Math.min(1, (this.state.buzz[place] ?? 0) / 8) * 22);
    }

    // Rain falls only in a storm, and not for someone who asked for less motion.
    const raining = this.storm > 0.05 && !this.reduced;
    this.rain.visible = raining;
    if (raining) {
      const rp = this.rain.geometry.attributes.position;
      for (let i = 0; i < rp.count; i++) {
        const y = rp.getY(i) - dt * 34;
        rp.setY(i, y < 0 ? y + 36 : y);
      }
      rp.needsUpdate = true;
      (this.rain.material as THREE.PointsMaterial).opacity = 0.75 * this.storm;
    }

    // Wind in the trees and the banner, drifting clouds, a breathing sea.
    for (const c of this.canopies) {
      c.mesh.rotation.z = Math.sin(time * 0.9 + c.phase) * 0.035;
      c.mesh.rotation.x = Math.cos(time * 0.7 + c.phase) * 0.03;
    }
    const bp = this.banner.geometry.attributes.position;
    for (let i = 0; i < bp.count; i++) bp.setZ(i, Math.sin(time * (kind === "tournament" ? 8 : 3) + bp.getX(i) * 2.4) * (kind === "tournament" ? 0.26 : 0.16) * (bp.getX(i) + 0.8));
    bp.needsUpdate = true;
    for (const c of this.clouds) {
      c.position.x += dt * 0.9;
      if (c.position.x > 110) c.position.x = -110;
      c.children.forEach((p) => ((p as THREE.Mesh).material as THREE.MeshStandardMaterial).color.copy(new THREE.Color(0xffffff).lerp(sky.low, 0.35 + sky.night * 0.3)));
    }
    this.water.position.y = -0.9 + Math.sin(time * 0.6) * 0.05;
    (this.water.material as THREE.MeshStandardMaterial).color.copy(new THREE.Color(0x3f8fd8).lerp(sky.top, 0.35));
    (this.lake.material as THREE.MeshStandardMaterial).color.copy(new THREE.Color(0x4fb3ff).lerp(sky.top, 0.3 + sky.night * 0.3));
    const [tx, tz] = PLACE_AT.tavern;
    const tavernBusy = Math.min(1, (this.state.buzz.tavern ?? 0) / 8);
    for (const p of this.smoke) {
      p.t = (p.t + dt * (0.1 + tavernBusy * 0.12)) % 1;
      p.mesh.position.set(tx - 1.2 + Math.sin(p.t * 5) * 0.5 + p.t * 1.5, 7 + p.t * 6, tz - 5 + p.t);
      p.mesh.scale.setScalar(0.6 + p.t * 1.6);
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = (1 - p.t) * (0.25 + tavernBusy * 0.5);
    }
    const mp = this.motes.geometry.attributes.position;
    for (let i = 0; i < mp.count; i++) {
      mp.setY(i, 0.6 + ((mp.getY(i) - 0.6 + dt * (sky.night > 0.5 ? 0.25 : -0.45) + 7) % 7));
      mp.setX(i, mp.getX(i) + Math.sin(time * 0.6 + i) * dt * 0.5);
    }
    mp.needsUpdate = true;
    const mm = this.motes.material as THREE.PointsMaterial;
    if (kind === "festival" && !this.reduced) mm.color.setHSL((time * 0.35) % 1, 0.9, 0.62);
    else mm.color.set(sky.night > 0.5 ? 0xeaff8a : 0xffd1e0);
    mm.size = kind === "festival" ? 0.36 : sky.night > 0.5 ? 0.3 : 0.2;
    mm.opacity = sky.night > 0.5 ? 0.6 + 0.4 * Math.sin(time * 2) : 0.75;

    this.stirCountryside(dt, time, sky.night);

    // Residents: walk the path if there is one, otherwise idle where they are.
    for (const b of this.bodies.values()) {
      const p = b.group.position;
      if (b.path.length) {
        const to = b.path[0];
        const d = new THREE.Vector3().subVectors(to, p).setY(0);
        const dist = d.length();
        const step = 5.2 * dt;
        if (dist <= step) {
          p.set(to.x, 0, to.z);
          b.path.shift();
        } else {
          d.normalize();
          p.addScaledVector(d, step);
          b.group.rotation.y = lerpAngle(b.group.rotation.y, Math.atan2(d.x, d.z), 1 - Math.pow(0.001, dt));
        }
        // On the move, each species goes its own way: a hop, a leap, a hover, a waddle.
        const stride = Math.abs(Math.sin(time * 11 + b.phase));
        p.y =
          b.gait === "hop"
            ? Math.abs(Math.sin(time * 7 + b.phase)) * 0.6
            : b.gait === "leap"
              ? Math.abs(Math.sin(time * 5 + b.phase)) * 0.95
              : b.gait === "hover"
                ? 0.55 + Math.sin(time * 2.6 + b.phase) * 0.12
                : b.gait === "roll"
                  ? 0
                  : stride * (b.gait === "waddle" ? 0.1 : 0.2);
        b.group.rotation.z = b.gait === "waddle" ? Math.sin(time * 11 + b.phase) * 0.2 : b.gait === "sway" ? Math.sin(time * 5.5 + b.phase) * 0.1 : 0;
        b.lookAt = null;
      } else {
        // Standing about: the frog still jumps now and then, the bee still hovers.
        const beat = Math.max(0, Math.sin(time * (b.gait === "leap" ? 1.3 : 2) + b.phase));
        p.y =
          this.reduced && b.gait !== "hover"
            ? 0
            : b.gait === "hover"
              ? 0.5 + (this.reduced ? 0 : Math.sin(time * 2.4 + b.phase) * 0.12)
              : b.gait === "hop"
                ? Math.pow(beat, 8) * 0.45
                : b.gait === "leap"
                  ? Math.pow(beat, 12) * 1.1
                  : 0;
        b.group.rotation.z = this.reduced ? 0 : b.gait === "waddle" ? Math.sin(time * 2.6 + b.phase) * 0.07 : b.gait === "sway" ? Math.sin(time * 1.4 + b.phase) * 0.08 : 0;
        const facing = b.lookAt ?? new THREE.Vector3(0, 0, 0);
        const want = Math.atan2(facing.x - p.x, facing.z - p.z) + (b.lookAt ? 0 : Math.sin(time * 0.35 + b.phase) * 0.9);
        b.group.rotation.y = lerpAngle(b.group.rotation.y, want, 1 - Math.pow(0.02, dt));
      }
      if (!this.reduced) for (const w of b.wings) w.mesh.rotation.z = w.side * (w.fast ? Math.sin(time * 46 + b.phase) * 0.55 : 0.25 + Math.sin(time * 7 + b.phase) * 0.45);
      const breathe = 1 + Math.sin(time * 2.2 + b.phase) * 0.03;
      b.body.scale.set(1 / breathe, 1.05 * breathe, 0.95 / breathe);
      if (b.marker) {
        b.marker.position.y = 2.5 + Math.sin(time * 3) * 0.12;
        b.marker.rotation.y = time * 2;
      }
      if (b.bubbleUntil && now > b.bubbleUntil) {
        b.bubbleEl.style.opacity = "0";
        b.bubbleUntil = 0;
      }
      if (b.emoteUntil && now > b.emoteUntil) {
        b.emoteEl.style.opacity = "0";
        b.emoteEl.style.transform = "translateY(0)";
        b.emoteUntil = 0;
        b.lookAt = null;
      }
    }

    // The rings under your own pet and under whoever is selected.
    const mine = this.state.agents.find((a) => a.mine);
    const mineBody = mine ? this.bodies.get(mine.id) : undefined;
    this.ring.visible = Boolean(mineBody);
    if (mineBody) {
      this.ring.position.set(mineBody.group.position.x, 0.06, mineBody.group.position.z);
      this.ring.scale.setScalar(1 + Math.sin(time * 3) * 0.08);
    }
    const sel = this.state.selected !== null ? this.bodies.get(this.state.selected) : undefined;
    this.selectRing.visible = Boolean(sel) && sel !== mineBody;
    if (sel) this.selectRing.position.set(sel.group.position.x, 0.07, sel.group.position.z);

    // The camera drifts after whoever it is following until the viewer takes over.
    const followed = this.follow !== null ? this.bodies.get(this.follow) : undefined;
    if (followed && !this.userMoved) this.wantTarget.set(followed.group.position.x, 1.2, followed.group.position.z);
    if (!this.userMoved) this.controls.target.lerp(this.wantTarget, 1 - Math.pow(0.05, dt));
    if (this.flight) {
      this.flight.t = Math.min(1, this.flight.t + dt / 1.1);
      const e = 1 - Math.pow(1 - this.flight.t, 3);
      this.camera.position.lerpVectors(this.flight.from, this.flight.to, e);
      if (this.flight.t >= 1 || this.userMoved) this.flight = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  };

  // ---------------------------------------------------------------- plumbing

  private resize = () => {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    // A narrow screen needs a wider view to keep the whole plaza in frame.
    this.camera.fov = w / h < 0.9 ? 56 : 42;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
  };

  private onVisible = () => {
    if (document.visibilityState === "visible") {
      this.clock.getDelta();
      if (!this.raf) this.loop();
    } else {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  };

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };

  /** A tap (not a drag) on a resident selects them; a tap on the ground clears the selection. */
  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    const hits = ray.intersectObjects([...this.bodies.values()].map((b) => b.group), true);
    const id = hits[0]?.object.userData.agent as number | undefined;
    this.onPick(id ?? null);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVisible);
    this.renderer.domElement.removeEventListener("pointerdown", this.onDown);
    this.renderer.domElement.removeEventListener("pointerup", this.onUp);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const material = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((x) => x.dispose());
      else material?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}

/** Moves a mesh sideways without disturbing its height or rotation. */
function at<T extends THREE.Object3D>(o: T, x: number, z: number) {
  o.position.x = x;
  o.position.z = z;
  return o;
}

function lerpAngle(a: number, b: number, t: number) {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}
