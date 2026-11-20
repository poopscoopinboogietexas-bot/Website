import { Link } from 'react-router-dom'
import PublicLayout from '../components/PublicLayout'
import { BUSINESS, phoneLink } from '../lib/business'

const UPDATED = 'November 20, 2026'

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: 'Your service',
    items: [
      'We scoop Monday through Friday, between 9 AM and 5 PM, on the same day every week (or every other week, depending on your plan).',
      'We book your service day when you sign up and skip any days you tell us don’t work. If we ever need to move your day, we’ll text you first.',
      'We serve Tyler and towns within about 20 miles of downtown Tyler, like Whitehouse, Bullard, Flint and Lindale.',
      'We double-bag all poop and put it in your outdoor trash bin. If we can’t get to your bin, we leave the bags where you told us at sign-up. We don’t take poop with us.',
      'After every visit, we email you a photo of your clean yard and your latched gate.',
    ],
  },
  {
    title: 'Dogs and getting in',
    items: [
      'Please bring your dogs inside on your service day. Friendly dogs can stay out on a dog run, but we don’t go into a yard with a loose dog.',
      'Leave the gate unlocked or give us the code. We latch the gate when we leave and photograph it so your pups stay put.',
      'We clean and disinfect our tools and boots between every yard. Tell us if a dog is sick and we’ll scoop your yard last.',
    ],
  },
  {
    title: 'Skipped or moved visits',
    items: [
      'Grass over about 6 inches: we’ll do our best, but we can’t promise we’ll find every pile.',
      'Grass over 12 inches: we skip that visit and text you to mow. There’s no extra fee, and we’ll be back on your next service day.',
      'Storms, lightning or ice: we come the next good day and email you to let you know. Light rain doesn’t stop us.',
    ],
  },
  {
    title: 'Prices and payment',
    items: [
      'Weekly service is $60 a month and every other week is $40 a month, for 1 to 3 dogs. Each dog after 3 adds $10 a month, up to 8 dogs ($110 weekly or $90 every other week). One-time cleanups start at $60.',
      'If your yard hasn’t been cleaned in a while, there’s a one-time cleanup fee on your first payment only: free under 2 weeks, $15 for 2 to 4 weeks, $30 for 1 to 2 months, $50 for over 2 months. If the yard needs a lot more than that, we text you a photo and the price before we start.',
      'You pay by card with autopay. Your first payment is the day you sign up, and your plan renews on that same day each month.',
      'Payments are handled by Stripe. We never see or store your card number.',
      'If a payment doesn’t go through, we’ll let you know. You have 7 days to update your card, then service pauses until the payment goes through.',
    ],
  },
  {
    title: 'Cancelling',
    items: [
      'No contracts. Cancel anytime from your account page, or call or text us.',
      'We keep scooping through the month you’ve already paid for, then stop. You won’t be charged again.',
      'We don’t refund part of a month you’ve already paid for.',
    ],
  },
  {
    title: 'Texts and emails',
    items: [
      `We text you from ${BUSINESS.phone} the night before each visit and when we’re done. You can turn either text off anytime on your account page.`,
      'We email your visit photos and important account updates, like a skipped visit or a payment problem.',
      'We don’t send ads, and we never give your number or email to anyone else.',
    ],
  },
  {
    title: 'Your information',
    items: [
      'We keep what we need to do the job: your name, phone, email, address, gate details, notes about your dogs, and the photos we take of your yard and gate.',
      'Only our team can see it. Payment details go straight to Stripe.',
      'We never sell or share your information. Ask us anytime and we’ll delete it once your service has ended.',
    ],
  },
]

export default function Policies() {
  return (
    <PublicLayout>
      <main className="band">
        <div className="band-inner">
          <h1 className="section-title">Our policies</h1>
          <p className="muted center-text">The short version: we show up, scoop, latch your gate, and you can leave anytime. Updated {UPDATED}.</p>
          <div className="stack">
            {SECTIONS.map((s) => (
              <section key={s.title} className="card flat">
                <h2>{s.title}</h2>
                <ul className="stack" style={{ gap: 6, margin: 0, paddingLeft: 20 }}>
                  {s.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
            <section className="card flat">
              <h2>Questions</h2>
              <p>
                {BUSINESS.name} is a family-operated local business from Tyler, Texas. Call or text <a href={phoneLink()}>{BUSINESS.phone}</a> or email{' '}
                <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
              </p>
              <Link to="/signup" className="btn primary">
                Sign up
              </Link>
            </section>
          </div>
        </div>
      </main>
    </PublicLayout>
  )
}
