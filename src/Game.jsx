import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useGame, TOWNS, PITCH, SPONSORS, MATCH_SECONDS } from './store'

const L = 20, W = 12, GW = 2.8
const FORM = [[-4, 0], [-8, -5], [-8, 5], [-18, 0]] // user, 2 AI, keeper (home, attacking +x)
const keys = {}
const sim = { p: [], ball: { x: 0, z: 0, vx: 0, vz: 0 }, pause: 0, clock: 0 }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function reset() {
  sim.p = []
  for (let t = 0; t < 2; t++)
    for (let i = 0; i < 4; i++) {
      const d = t ? -1 : 1
      sim.p.push({ team: t, i, x: FORM[i][0] * d, z: FORM[i][1], vx: 0, vz: 0, ry: d * Math.PI / 2, cd: 0 })
    }
  Object.assign(sim.ball, { x: 0, z: 0, vx: 0, vz: 0 })
  useGame.setState({ banner: null })
}
reset()

function move(p, tx, tz, sp) {
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz)
  if (d > 0.35) { p.vx = (dx / d) * sp; p.vz = (dz / d) * sp } else p.vx = p.vz = 0
}

function step(dt) {
  const g = useGame.getState()
  if (g.phase !== 'playing') return
  if (sim.pause > 0) { sim.pause -= dt; if (sim.pause <= 0) reset(); return }
  sim.clock += dt
  const left = Math.max(0, MATCH_SECONDS - Math.floor(sim.clock))
  if (left !== g.time) useGame.setState({ time: left })
  if (sim.clock >= MATCH_SECONDS) return g.end()

  const b = sim.ball, boost = Date.now() < g.boostUntil
  const chaser = [0, 1].map((t) => {
    let best = -1, bd = 1e9
    for (const p of sim.p) if (p.team === t && p.i < 3 && !(t === 0 && p.i === 0)) {
      const d = Math.hypot(p.x - b.x, p.z - b.z)
      if (d < bd) { bd = d; best = p.i }
    }
    return best
  })

  for (const p of sim.p) {
    const d = p.team ? -1 : 1, user = p.team === 0 && p.i === 0
    if (user) {
      const tx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0)
      const tz = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0)
      const m = Math.hypot(tx, tz) || 1, sp = boost ? 9 : 7
      p.vx = (tx / m) * sp; p.vz = (tz / m) * sp
    } else if (p.i === 3) move(p, FORM[3][0] * d, clamp(b.z, -2.2, 2.2), 5)
    else if (chaser[p.team] === p.i) move(p, b.x, b.z, 4.8)
    else move(p, FORM[p.i][0] * d + b.x * 0.35, FORM[p.i][1] + b.z * 0.3, 3.4)

    p.x = clamp(p.x + p.vx * dt, -L + 0.6, L - 0.6)
    p.z = clamp(p.z + p.vz * dt, -W + 0.6, W - 0.6)
    if (Math.hypot(p.vx, p.vz) > 0.1) p.ry = Math.atan2(p.vx, p.vz)
    p.cd -= dt

    if (Math.hypot(p.x - b.x, p.z - b.z) < 0.95) {
      if (user) {
        if (keys[' '] && p.cd <= 0) { b.vx = Math.sin(p.ry) * 17; b.vz = Math.cos(p.ry) * 17; p.cd = 0.35 }
        else if ((p.vx || p.vz) && Math.hypot(b.vx, b.vz) < 9) { b.vx = p.vx * 1.3; b.vz = p.vz * 1.3 }
      } else if (p.cd <= 0) {
        const dx = d * L - p.x, dz = (Math.random() - 0.5) * 3.6 - p.z, m = Math.hypot(dx, dz)
        const pw = 12 + Math.random() * 3
        b.vx = (dx / m) * pw; b.vz = (dz / m) * pw; p.cd = 0.5
      }
    }
  }

  const fr = PITCH[g.pitch].fr
  b.x += b.vx * dt; b.z += b.vz * dt
  const k = Math.exp(-fr * dt * 0.8); b.vx *= k; b.vz *= k
  if (Math.abs(b.z) > W) { b.z = Math.sign(b.z) * W; b.vz *= -0.6 }
  if (Math.abs(b.x) > L) {
    if (Math.abs(b.z) < GW) {
      const s = [...g.score]; s[b.x > 0 ? 0 : 1]++
      useGame.setState({ score: s, banner: b.x > 0 ? 'GOAL! Well played' : 'Conceded! Regroup' })
      sim.pause = 1.8; b.vx = b.vz = 0
    } else { b.x = Math.sign(b.x) * L; b.vx *= -0.5 }
  }
}

function jerseyTex(main, trim, pattern) {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const x = c.getContext('2d')
  x.fillStyle = main; x.fillRect(0, 0, 64, 64); x.fillStyle = trim
  if (pattern === 'stripes') for (let i = 0; i < 64; i += 16) x.fillRect(i, 0, 8, 64)
  if (pattern === 'hoops') for (let i = 0; i < 64; i += 16) x.fillRect(0, i, 64, 8)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Face({ url }) {
  const t = useTexture(url); t.colorSpace = THREE.SRGBColorSpace
  return (
    <mesh position={[0, 1.85, 0.29]}>
      <circleGeometry args={[0.27, 24]} />
      <meshBasicMaterial map={t} />
    </mesh>
  )
}

function Player({ id }) {
  const ref = useRef()
  const team = id >> 2, user = id === 0
  const { jersey, faceUrl } = useGame()
  const tex = useMemo(
    () => (team ? jerseyTex('#ffffff', '#111111', 'hoops') : jerseyTex(jersey.main, jersey.trim, jersey.pattern)),
    [team, jersey.main, jersey.trim, jersey.pattern]
  )
  useFrame(({ clock }) => {
    const p = sim.p[id]; if (!p) return
    const run = Math.hypot(p.vx, p.vz) > 0.1
    ref.current.position.set(p.x, run ? Math.abs(Math.sin(clock.elapsedTime * 12)) * 0.12 : 0, p.z)
    ref.current.rotation.y = p.ry
  })
  return (
    <group ref={ref}>
      <mesh position={[0, 1.1, 0]} castShadow><cylinderGeometry args={[0.4, 0.4, 1, 14]} /><meshStandardMaterial map={tex} /></mesh>
      <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[0.7, 0.6, 0.4]} /><meshStandardMaterial color={team ? '#111' : jersey.trim} /></mesh>
      <mesh position={[0, 1.85, 0]} castShadow><sphereGeometry args={[0.3, 16, 16]} /><meshStandardMaterial color="#7a4a2e" /></mesh>
      {user && faceUrl && <Suspense fallback={null}><Face url={faceUrl} /></Suspense>}
      {user && <mesh rotation-x={-Math.PI / 2} position-y={0.05}><ringGeometry args={[0.7, 0.85, 24]} /><meshBasicMaterial color="#f2b705" /></mesh>}
    </group>
  )
}

function Ball() {
  const ref = useRef()
  useFrame(() => ref.current.position.set(sim.ball.x, 0.3, sim.ball.z))
  return <mesh ref={ref} castShadow><sphereGeometry args={[0.3, 16, 16]} /><meshStandardMaterial color="#fff" /></mesh>
}

function Crowd() {
  const ref = useRef()
  useLayoutEffect(() => {
    const o = new THREE.Object3D(), c = new THREE.Color()
    const pal = ['#CE1126', '#FCD116', '#006B3F', '#ffffff', '#2a7fba', '#222']
    for (let i = 0; i < 80; i++) {
      const r = (n) => { const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v) }
      const zone = i % 3
      const x = zone === 0 ? (r(1) - 0.5) * 2 * (L + 4) : (zone === 1 ? -1 : 1) * (L + 2 + r(3) * 3)
      const z = zone === 0 ? W + 2 + r(2) * 3 : (r(2) - 0.5) * 2 * W
      o.position.set(x, 0.7, z); o.updateMatrix()
      ref.current.setMatrixAt(i, o.matrix); ref.current.setColorAt(i, c.set(pal[(i * 7) % 6]))
    }
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={ref} args={[null, null, 80]}>
      <capsuleGeometry args={[0.28, 0.8, 4, 8]} /><meshStandardMaterial />
    </instancedMesh>
  )
}

function World() {
  const town = TOWNS.find((t) => t.id === useGame((s) => s.town))
  const pitch = PITCH[useGame((s) => s.pitch)]
  const sp = SPONSORS.find((s) => s.id === useGame((s) => s.sponsor))
  const lines = [[0, 0, 0.12, 2 * W], [0, W, 2 * L, 0.12], [0, -W, 2 * L, 0.12], [L, 0, 0.12, 2 * W], [-L, 0, 0.12, 2 * W]]
  return (
    <>
      <color attach="background" args={[town.sky]} />
      <fog attach="fog" args={[town.sky, 45, 110]} />
      <hemisphereLight args={['#fff2cf', '#8a5a3c', 0.9]} />
      <directionalLight position={[15, 25, 10]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={25} shadow-camera-bottom={-25} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[250, 250]} /><meshStandardMaterial color={town.dirt} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow><planeGeometry args={[2 * L + 2, 2 * W + 2]} /><meshStandardMaterial color={pitch.color} /></mesh>
      {lines.map(([x, z, w, d], i) => <mesh key={i} position={[x, 0.04, z]}><boxGeometry args={[w, 0.02, d]} /><meshBasicMaterial color="#fff" /></mesh>)}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * L, 0, 0]}>
          {[-GW, GW].map((z) => <mesh key={z} position={[0, 1.1, z]} castShadow><boxGeometry args={[0.15, 2.2, 0.15]} /><meshStandardMaterial color="#fff" /></mesh>)}
          <mesh position={[0, 2.2, 0]}><boxGeometry args={[0.15, 0.15, 2 * GW]} /><meshStandardMaterial color="#fff" /></mesh>
        </group>
      ))}
      <mesh position={[0, 3, -W - 9]} castShadow receiveShadow><boxGeometry args={[70, 6, 4]} /><meshStandardMaterial color={town.wall} /></mesh>
      {[-24, -8, 8, 24].map((x) => (
        <group key={x} position={[x, 0.5, -W - 1.2]}>
          <mesh castShadow><boxGeometry args={[10, 1, 0.2]} /><meshStandardMaterial color="#1b1b1b" /></mesh>
          <Text position={[0, 0, 0.12]} fontSize={0.55} color="#f2b705">{sp.name}</Text>
        </group>
      ))}
      {[-12, 0, 12].map((x) => (
        <group key={x} position={[x, 0, -W - 4.5]}>
          <mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[2.4, 1.2, 1.2]} /><meshStandardMaterial color="#6b4226" /></mesh>
          <mesh position={[0, 2.2, 0]} castShadow><coneGeometry args={[1.8, 0.8, 8]} /><meshStandardMaterial color="#c8301f" /></mesh>
          <Text position={[0, 1.5, 0.7]} fontSize={0.3} color="#fff">Sobolo ₵20</Text>
        </group>
      ))}
      <Crowd />
    </>
  )
}

const camV = new THREE.Vector3()
function Rig() {
  useFrame(({ camera, clock }) => {
    if (useGame.getState().phase === 'menu') {
      const a = clock.elapsedTime * 0.12
      camera.position.set(Math.sin(a) * 40, 17, Math.cos(a) * 40); camera.lookAt(0, 0, 0)
    } else {
      const tx = sim.ball.x * 0.55
      camera.position.lerp(camV.set(tx, 16, 21), 0.06); camera.lookAt(tx, 0, 0)
    }
  })
  return null
}

function Sim() {
  const phase = useGame((s) => s.phase)
  useEffect(() => {
    if (phase === 'playing') { sim.clock = 0; sim.pause = 0; reset() }
    if (phase === 'menu') reset()
  }, [phase])
  useEffect(() => {
    const dn = (e) => {
      const k = e.key.toLowerCase(); keys[k] = true
      if (k === 'e') useGame.getState().buyDrink()
      if ([' ', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault()
    }
    const up = (e) => (keys[e.key.toLowerCase()] = false)
    addEventListener('keydown', dn); addEventListener('keyup', up)
    return () => { removeEventListener('keydown', dn); removeEventListener('keyup', up) }
  }, [])
  useFrame((_, dt) => step(Math.min(dt, 0.05)))
  return null
}

export function Game() {
  return (
    <Canvas shadows camera={{ fov: 45, position: [0, 17, 40], near: 0.1, far: 250 }} className="stage">
      <World /><Sim /><Rig /><Ball />
      {Array.from({ length: 8 }, (_, i) => <Player key={i} id={i} />)}
    </Canvas>
  )
}
