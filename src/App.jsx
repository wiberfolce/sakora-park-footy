import { Game } from './Game'
import { useGame, TOWNS, SPONSORS, PITCH, PITCH_COST } from './store'

function Menu() {
  const g = useGame()
  const set = useGame.setState
  const photo = (e) => { const f = e.target.files[0]; if (f) set({ faceUrl: URL.createObjectURL(f) }) }
  const next = PITCH[g.pitch + 1]
  return (
    <aside className="panel">
      <h1>Sakora Park</h1>
      <p className="tag">Street football on the school park. Your town, your jersey, your face.</p>

      <h2>Pick your town</h2>
      <div className="grid">
        {TOWNS.map((t) => <button key={t.id} className={g.town === t.id ? 'on' : ''} onClick={() => set({ town: t.id })}>{t.name}</button>)}
      </div>

      <h2>Design your team</h2>
      <input value={g.team} maxLength={22} onChange={(e) => set({ team: e.target.value })} aria-label="Team name" />
      <div className="row">
        <label>Shirt <input type="color" value={g.jersey.main} onChange={(e) => set({ jersey: { ...g.jersey, main: e.target.value } })} /></label>
        <label>Trim <input type="color" value={g.jersey.trim} onChange={(e) => set({ jersey: { ...g.jersey, trim: e.target.value } })} /></label>
        <select value={g.jersey.pattern} onChange={(e) => set({ jersey: { ...g.jersey, pattern: e.target.value } })} aria-label="Pattern">
          <option value="solid">Solid</option><option value="stripes">Stripes</option><option value="hoops">Hoops</option>
        </select>
      </div>

      <h2>Put your face on the pitch</h2>
      <label className="file">{g.faceUrl ? 'Photo added. Choose another' : 'Upload a photo'}
        <input type="file" accept="image/*" onChange={photo} />
      </label>

      <h2>Team HQ <span className="coins">₵{g.coins}</span></h2>
      <button className="wide" disabled={!next || g.coins < PITCH_COST[g.pitch + 1]} onClick={g.upgrade}>
        {next ? `Upgrade pitch to ${next.name} (₵${PITCH_COST[g.pitch + 1]})` : 'Pitch fully upgraded'}
      </button>
      <div className="grid">
        {SPONSORS.map((s) => (
          <button key={s.id} className={g.sponsor === s.id ? 'on' : ''} onClick={() => g.signSponsor(s.id)}
            disabled={!g.signed.includes(s.id) && g.coins < s.cost}>
            {s.name}<small>{g.signed.includes(s.id) ? `₵${s.pay} per match` : `Sign for ₵${s.cost}`}</small>
          </button>
        ))}
      </div>
      <button className="go" onClick={g.start}>Kick off</button>
    </aside>
  )
}

function Hud() {
  const g = useGame()
  const m = Math.floor(g.time / 60), s = String(g.time % 60).padStart(2, '0')
  return (
    <div className="hud">
      <div className="score"><span>{g.team}</span><b>{g.score[0]} – {g.score[1]}</b><span>Visitors</span><i>{m}:{s}</i></div>
      <button className="drink" onClick={g.buyDrink}>Buy sobolo for ₵20 (E)</button>
      <p className="hint">Move with WASD or arrows. Shoot with Space. Purse: ₵{g.coins}</p>
      {g.banner && <div className="banner">{g.banner}</div>}
    </div>
  )
}

function Result() {
  const { last, team } = useGame()
  const set = useGame.setState
  const word = last.h > last.a ? 'You won' : last.h === last.a ? 'Honours even' : 'Tough loss'
  return (
    <div className="result">
      <h1>{word}</h1>
      <p>{team} {last.h} – {last.a} Visitors</p>
      <p>Earned ₵{last.total}, including ₵{last.pay} from your sponsor.</p>
      <button className="go" onClick={() => set({ phase: 'menu' })}>Back to Team HQ</button>
    </div>
  )
}

export default function App() {
  const phase = useGame((s) => s.phase)
  return (
    <>
      <Game />
      {phase === 'menu' && <Menu />}
      {phase === 'playing' && <Hud />}
      {phase === 'ended' && <Result />}
    </>
  )
}
