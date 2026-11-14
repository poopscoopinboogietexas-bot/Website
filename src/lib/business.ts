// Business details shown on the public website. Edit these and push to main; the site redeploys itself.
export const BUSINESS = {
  name: "Poop Scoopin' Boogie",
  city: 'Tyler, TX',
  serviceArea: 'Tyler and nearby (Whitehouse, Bullard, Flint, Lindale). Not sure? Sign up and ask.',
  tagline: 'We do your dirty work so you don’t have to.',
  // Leave blank to hide. Google Voice number that rings both phones.
  phone: '(903) 347-2494',
  // Leave blank to hide. Example: 'poopscoopinboogie@gmail.com'
  email: 'poopscoopinboogietexas@gmail.com',
}

/** tel: / sms: link for the business phone, e.g. tel:+19033472494 */
export const phoneLink = (kind: 'tel' | 'sms' = 'tel') => `${kind}:+1${BUSINESS.phone.replace(/\D/g, '').slice(-10)}`

/**
 * Text messages the staff app prefills. Edit the wording here.
 * {first} = customer's first name, {day} = weekday name.
 */
export const TEXTS = {
  reminder: 'Hi {first}! Poop Scoopin’ Boogie is coming tomorrow ({day}) to scoop your yard. Please leave the gate unlocked, keep shy pups inside, and make sure we can reach your trash bin. Thanks!',
  reminderTakeAway: 'Hi {first}! Poop Scoopin’ Boogie is coming tomorrow ({day}) to scoop your yard. Please leave the gate unlocked and keep shy pups inside. Thanks!',
  done: 'Hi {first}! Your yard is all scooped and the gate is latched. Photos are in your email. Thanks! – Poop Scoopin’ Boogie',
}

/**
 * One-time initial cleanup fee, by how long since the yard was last cleaned.
 * Flat for 1–2 dogs; each dog after 2 adds EXTRA_DOG_CENTS (only when there is a fee).
 * Edit amounts here; the sign-up page, FAQ and staff app all read from this.
 */
export const CLEANUP_FEES = [
  { value: 'under_2_weeks', label: 'Within the last 2 weeks', cents: 0 },
  { value: '2_4_weeks', label: '2–4 weeks ago', cents: 1500 },
  { value: '1_2_months', label: '1–2 months ago', cents: 3000 },
  { value: 'over_2_months', label: 'Over 2 months ago (or never)', cents: 5000 },
] as const
export const CLEANUP_EXTRA_DOG_CENTS = 1000

export type LastCleaned = (typeof CLEANUP_FEES)[number]['value']

export function cleanupFeeCents(lastCleaned: LastCleaned | '' | null | undefined, dogCount: number): number {
  const base = CLEANUP_FEES.find((f) => f.value === lastCleaned)?.cents ?? 0
  if (base === 0) return 0
  return base + Math.max(0, dogCount - 2) * CLEANUP_EXTRA_DOG_CENTS
}

export const PLANS = [
  {
    value: 'weekly',
    name: 'Weekly',
    price: '$60',
    per: '/month',
    detail: 'Once a week, 1 dog. +$10/month for each extra dog.',
    popular: true,
  },
  {
    value: 'biweekly',
    name: 'Every other week',
    price: '$40',
    per: '/month',
    detail: 'Every two weeks, 1 dog. +$10/month for each extra dog.',
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
    a: 'Friendly dogs can stay out, and we’ll probably make friends. If your dog is nervous around strangers, keep them inside on your service day. We never go in a yard with a loose dog we haven’t met.',
  },
  {
    q: 'What do you do with the poop?',
    a: 'We double-bag it and put it in your outdoor trash bin. If you’d rather we take it with us, just tell us when you sign up.',
  },
  {
    q: 'Can you spread germs between yards?',
    a: 'We disinfect our tools and shoe soles after every single yard, and we scoop any yard with a sick dog last. Diseases like parvo and giardia spread through poop, so we take this seriously.',
  },
  {
    q: 'How much does it cost?',
    a: 'Weekly service is $60 a month for 1 dog, and every other week is $40 a month. Each extra dog adds $10 a month. If your yard hasn’t been cleaned in a while, there’s a one-time cleanup fee on your first bill: free if it’s been under 2 weeks, $15 for 2–4 weeks, $30 for 1–2 months, and $50 for over 2 months (plus $10 for each dog after 2). If it’s much worse than expected, we’ll text you a photo and the new price before we start.',
  },
  {
    q: 'What if my grass is long?',
    a: 'Please keep your grass mowed to about 6 inches or shorter on your service day. In tall grass we can’t promise we found everything, so we’ll scoop what we can, text you a photo, and finish up on the next visit after it’s mowed.',
  },
  {
    q: 'Is there a contract?',
    a: 'No contract. Cancel anytime before your next month starts.',
  },
  {
    q: 'How do I pay?',
    a: 'You pay monthly at the start of the month by card, with automatic payments so you don’t have to think about it. You can update your card or see your visits anytime from your account page.',
  },
  {
    q: 'What if it rains?',
    a: 'Light rain doesn’t stop us. If there’s a storm, lightning, or ice, we’ll come the next good day and text you.',
  },
  {
    q: 'Where do you work?',
    a: 'Tyler and nearby towns like Whitehouse, Bullard, Flint, and Lindale. If you’re not sure we come to you, sign up and we’ll let you know.',
  },
  {
    q: 'Who are you?',
    a: 'We’re a mom-and-kid team from Tyler. We started Poop Scoopin’ Boogie so you can enjoy your yard instead of cleaning it.',
  },
]
