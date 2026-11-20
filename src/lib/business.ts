// Business details shown on the public website. Edit these and push to main; the site redeploys itself.
export const BUSINESS = {
  name: "Poop Scoopin' Boogie",
  city: 'Tyler, TX',
  serviceArea: 'Tyler and nearby (Whitehouse, Bullard, Flint, Lindale). Not sure? Call or text us.',
  tagline: 'We do your dirty work so you don’t have to.',
  // Leave blank to hide. Google Voice number that rings both phones.
  phone: '(903) 347-2494',
  // Leave blank to hide. Example: 'poopscoopinboogie@gmail.com'
  email: 'poopscoopinboogietexas@gmail.com',
}

/**
 * Where we go: within this many miles (straight line) of downtown Tyler.
 * Lindale, Bullard, Flint and Whitehouse are all inside 20 miles.
 * North of northSouthLat books Monday first; south books Wednesday first
 * (keep in step with supabase/migrations/0009_area_billing_cancel.sql).
 */
export const SERVICE_AREA = {
  center: { lat: 32.3513, lng: -95.3011 },
  miles: 20,
  northSouthLat: 32.3513,
}

/** tel: / sms: link for the business phone, e.g. tel:+19033472494 */
export const phoneLink = (kind: 'tel' | 'sms' = 'tel') => `${kind}:+1${BUSINESS.phone.replace(/\D/g, '').slice(-10)}`

/**
 * Text messages the staff app prefills. Edit the wording here.
 * {first} = customer's first name, {day} = weekday name.
 */
export const TEXTS = {
  reminder: 'Hi {first}! Poop Scoopin’ Boogie is coming tomorrow ({day}) to scoop your yard. Please bring your dogs inside (a dog run is OK), leave the gate unlocked, and make sure we can reach your trash bin. Thanks!',
  welcome: 'Hi {first}! Welcome to Poop Scoopin’ Boogie! Your service day is {day}. The night before, we’ll text you a reminder. Please bring your dogs inside (a dog run is OK) and make sure we can reach your trash bin. After each visit we email you photos of your clean yard and latched gate. Questions? Call or text (903) 347-2494.',
  mow: 'Hi {first}! Poop Scoopin’ Boogie stopped by, but your grass is too tall for us to find everything safely, so we had to skip today. Please mow it before your next visit and we’ll get you all cleaned up. Thanks!',
  done: 'Hi {first}! Your yard is all scooped and the gate is latched. Photos are in your email. Thanks! – Poop Scoopin’ Boogie',
}

/**
 * One-time initial cleanup fee, by how long since the yard was last cleaned.
 * Flat, no matter how many dogs (extra dogs only change the monthly price).
 * Edit amounts here; the sign-up page, FAQ and staff app all read from this.
 */
export const CLEANUP_FEES = [
  { value: 'under_2_weeks', label: 'Within the last 2 weeks', cents: 0 },
  { value: '2_4_weeks', label: '2–4 weeks ago', cents: 1500 },
  { value: '1_2_months', label: '1–2 months ago', cents: 3000 },
  { value: 'over_2_months', label: 'Over 2 months ago (or never)', cents: 5000 },
] as const

export type LastCleaned = (typeof CLEANUP_FEES)[number]['value']

export function cleanupFeeCents(lastCleaned: LastCleaned | '' | null | undefined): number {
  return CLEANUP_FEES.find((f) => f.value === lastCleaned)?.cents ?? 0
}

/** Work day used to plan routes and arrival times. Times are minutes after midnight. */
export const WORK_DAY = {
  days: [1, 2, 3, 4, 5], // Monday to Friday
  start: 9 * 60, // 9:00 AM
  end: 17 * 60, // 5:00 PM
  minutesPerYard: 15,
  minutesFirstCleanup: 45,
  // Automatic booking at sign-up (the database does the booking; keep these in step with
  // supabase/migrations/0009_area_billing_cancel.sql): north Tyler gets Monday first, south
  // Tyler Wednesday first, then the rest. One yard every half hour from 9 to 5 = 16 yards a day.
  fillFirst: [1, 3],
  fillNext: [2, 4, 5],
  yardsPerDay: 16,
  mph: 25, // average town driving speed
  roadFactor: 1.3, // roads are longer than a straight line
}

/** Plan prices cover this many dogs; each dog past it adds EXTRA_DOG_CENTS a month. */
export const DOGS_INCLUDED = 3
export const EXTRA_DOG_CENTS = 1000
/** The price stops going up here: 8 or more dogs pays the 8-dog price. */
export const DOGS_MAX_PRICED = 8
export const PLAN_BASE_CENTS = { weekly: 6000, biweekly: 4000 } as const

/** Keep in step with supabase/functions/billing/index.ts, which charges this. */
export function monthlyPriceCents(plan: 'weekly' | 'biweekly', dogCount: number): number {
  return PLAN_BASE_CENTS[plan] + Math.max(0, Math.min(dogCount, DOGS_MAX_PRICED) - DOGS_INCLUDED) * EXTRA_DOG_CENTS
}

export const PLANS = [
  {
    value: 'weekly',
    name: 'Weekly',
    price: '$60',
    per: '/month',
    detail: 'Once a week, 1–3 dogs. +$10/month for each dog after 3, up to $110.',
    popular: true,
  },
  {
    value: 'biweekly',
    name: 'Every other week',
    price: '$40',
    per: '/month',
    detail: 'Every two weeks, 1–3 dogs. +$10/month for each dog after 3, up to $90.',
    popular: false,
  },
  {
    value: 'one_time',
    name: 'One-time cleanup',
    price: '$60',
    per: '+',
    detail: 'Party coming up, moving out, or just catching up. Priced by yard size and how long it’s been.',
    popular: false,
  },
] as const

export const FAQS: { q: string; a: string }[] = [
  {
    q: 'Do I need to be home?',
    a: 'No. Just leave the gate unlocked or give us the code. After every visit we send you a photo of your clean yard and your latched gate.',
  },
  {
    q: 'What about my dogs?',
    a: 'Please bring your dogs inside on your service day. Friendly dogs can stay out if they’re on a dog run, but we don’t go in a yard with a loose dog. We don’t want to be the reason your pup gets out.',
  },
  {
    q: 'What do you do with the poop?',
    a: 'We double-bag it and put it in your outdoor trash bin. If we can’t get to your bin, we leave the bags where you told us to when you signed up.',
  },
  {
    q: 'Can you spread germs between yards?',
    a: 'We disinfect our tools and shoe soles after every single yard, and we scoop any yard with a sick dog last. Diseases like parvo and giardia spread through poop, so we take this seriously.',
  },
  {
    q: 'How much does it cost?',
    a: 'Weekly service is $60 a month and every other week is $40 a month, for 1–3 dogs. Each dog after 3 adds $10 a month (so 4 dogs is $70 or $50), and it tops out at 8 dogs: $110 or $90. If your yard hasn’t been cleaned in a while, there’s a one-time cleanup fee on your first bill: free if it’s been under 2 weeks, $15 for 2–4 weeks, $30 for 1–2 months, and $50 for over 2 months. If it’s much worse than expected, we’ll text you a photo and the new price before we start.',
  },
  {
    q: 'What if my grass is long?',
    a: 'Please keep your grass mowed. Over about 6 inches, we can’t promise we’ll find every pile. Over 12 inches, we have to skip that visit and we’ll text you to mow. There’s no extra fee, and we’ll be back on your next service day.',
  },
  {
    q: 'Is there a contract?',
    a: 'No contract. Cancel anytime from your account page, or call or text us. We keep scooping through the month you’ve paid for, and you won’t be charged again.',
  },
  {
    q: 'How do I pay?',
    a: 'By card, with autopay. Your first payment is the day you sign up, and your plan renews on that same day each month. If there’s a one-time cleanup fee, it’s on the first payment only. Update your card, see receipts, or cancel anytime from your account page. Payments go through Stripe, so we never see your card number.',
  },
  {
    q: 'Can I pick my service day?',
    a: 'We book your day for you when you sign up, and we skip any days you tell us don’t work (like trash day). We keep neighbors on the same day so we spend our time scooping, not driving: north Tyler is usually Monday and south Tyler is usually Wednesday. Your day shows on the sign-up confirmation and your account page. We scoop Monday through Friday, 9 to 5.',
  },
  {
    q: 'Will you text me?',
    a: 'Yes, from (903) 347-2494: a reminder the night before each visit, and a quick “all done” text when we leave. Your photos come by email. You can turn either text off anytime on your account page.',
  },
  {
    q: 'What if it rains?',
    a: 'Light rain doesn’t stop us. If there’s a storm, lightning, or ice, we’ll come the next good day and email you to let you know.',
  },
  {
    q: 'Where do you work?',
    a: 'Tyler and nearby towns like Whitehouse, Bullard, Flint, and Lindale, about 20 miles around downtown Tyler. The sign-up checks your address for you. If it says you’re outside our area, call or text us and we’ll see what we can do.',
  },
  {
    q: 'Who are you?',
    a: 'We’re a mom and son local business from Tyler, family operated from day one. We started Poop Scoopin’ Boogie so you can enjoy your yard instead of cleaning it.',
  },
]
