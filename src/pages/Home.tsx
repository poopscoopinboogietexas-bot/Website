import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PublicLayout from '../components/PublicLayout'
import { useAuth } from '../lib/auth'
import { BUSINESS, phoneLink, FAQS, PLANS } from '../lib/business'

const STEPS = [
  { title: 'Sign up', body: 'Pick a plan and tell us about your yard and dogs. Takes two minutes.' },
  { title: 'We scoop', body: 'Same day every week. You don’t need to be home.' },
  { title: 'You get proof', body: 'A photo of your clean yard and latched gate lands in your email after every visit.' },
]

export default function Home() {
  const { session, role } = useAuth()
  const navigate = useNavigate()

  // Someone who just tapped an email link (confirm account or reset password) lands here; send them on.
  useEffect(() => {
    if (!session || !role) return
    let fromLink: string | null = null
    try {
      fromLink = sessionStorage.getItem('fromLoginLink')
      sessionStorage.removeItem('fromLoginLink')
    } catch {
      /* storage blocked */
    }
    if (fromLink === 'recovery') navigate('/reset-password', { replace: true })
    else if (fromLink) navigate(role === 'staff' ? '/app' : '/account', { replace: true })
  }, [session, role, navigate])

  return (
    <PublicLayout>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Dog poop pickup · {BUSINESS.city}</p>
            <h1 className="hero-title">{BUSINESS.tagline}</h1>
            <p className="hero-sub">
              Weekly yard cleanup from a family-operated local business. Photo proof after every visit, no contracts, and germ-safe tools.
            </p>
            <div className="row">
              <Link to="/signup" className="btn primary big-inline">
                Sign up for scoopin’
              </Link>
              <a href="#pricing" className="btn" onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }) }}>
                See prices
              </a>
            </div>
            {BUSINESS.phone && (
              <p className="hero-call">
                Questions? Call or text <a href={phoneLink()}>{BUSINESS.phone}</a>
              </p>
            )}
          </div>
          <img className="hero-logo" src="./logo.png" alt="Poop Scoopin' Boogie: a basset hound next to a scooper in pink cowboy boots" />
        </section>

        <section className="band" id="pricing">
          <div className="band-inner">
            <h2 className="section-title">Simple prices</h2>
            <div className="plans">
              {PLANS.map((p) => (
                <article key={p.value} className={`plan ${p.popular ? 'popular' : ''}`}>
                  {p.popular && <span className="pill dog">Most popular</span>}
                  <h3>{p.name}</h3>
                  <div className="price">
                    {p.price}
                    <span>{p.per}</span>
                  </div>
                  <p className="muted">{p.detail}</p>
                  <Link to={`/signup?plan=${p.value}`} className={`btn ${p.popular ? 'primary' : ''}`}>
                    Choose {p.name.toLowerCase()}
                  </Link>
                </article>
              ))}
            </div>
            <p className="muted center-text">No contracts. Cancel anytime. Yard not cleaned lately? A one-time cleanup fee is added to your first bill: $15 (2–4 weeks), $30 (1–2 months) or $50 (over 2 months).</p>
          </div>
        </section>

        <section className="band alt">
          <div className="band-inner">
            <h2 className="section-title">How it works</h2>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="step-num">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="band">
          <div className="band-inner">
            <h2 className="section-title">Why folks pick us</h2>
            <ul className="perks">
              <li>
                <strong>Photo proof.</strong> A clean-yard photo and a latched-gate photo after every visit.
              </li>
              <li>
                <strong>Germ-safe.</strong> Tools and boots disinfected between every yard, sick yards scooped last.
              </li>
              <li>
                <strong>Gate checked twice.</strong> We latch it, check it, and photograph it so your pups stay put.
              </li>
              <li>
                <strong>Local.</strong> We live in Tyler. You can call or text a real person at <a href={phoneLink()}>{BUSINESS.phone}</a>.
              </li>
            </ul>
          </div>
        </section>

        <section className="band alt">
          <div className="band-inner">
            <h2 className="section-title">Questions</h2>
            <div className="faq">
              {FAQS.slice(0, 4).map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
            <Link to="/faq" className="btn">
              All questions
            </Link>
          </div>
        </section>

        <section className="band cta">
          <div className="band-inner center-text">
            <h2 className="section-title">Ready to get your yard back?</h2>
            <p>Sign up in two minutes. We’ll pick your day and text you before your first visit.</p>
            <Link to="/signup" className="btn primary big-inline">
              Sign up for scoopin’
            </Link>
          </div>
        </section>
      </main>
    </PublicLayout>
  )
}
