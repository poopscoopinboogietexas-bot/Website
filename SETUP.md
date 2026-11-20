# Setting up Poop Scoopin' Boogie

## Database updates to run

New features sometimes need a database change. They pile up here so you can run them all in one sitting:
paste everything from [`supabase/pending-updates.sql`](supabase/pending-updates.sql) into **Supabase → SQL Editor** and click **Run**.
It's safe to run more than once. Until then the site still works; the new on/off settings just won't save.

Still to run:

- [ ] `0003_texts.sql`: text message on/off settings (reminder and "service done")
- [ ] `0004_initial_cleanup.sql`: initial cleanup fee (sign-up question, first-bill fee)
- [ ] `0005_bag_backup.sql`: where to leave bags if the trash bin can't be reached
- [ ] `0006_blocked_days.sql`: days that don't work for a customer (asked at sign-up)
- [ ] `0007_signup_self_read.sql`: new customers can see their own sign-up on their account page
- [ ] `0008_auto_day.sql`: books the service day automatically at sign-up (Monday and Wednesday first, 16 yards a day)
- [ ] `0009_area_billing_cancel.sql`: north Tyler on Monday / south on Wednesday, autopay (Stripe), the Cancel button, and the 7-day pause
- [ ] `0010_my_dogs.sql`: customers add and remove their own dogs (you get a note on their client page)

Already run: `0001_init.sql`, `0002_customers.sql`.

About 30 minutes, one time. Everything here is free.

## 1. Make the database (Supabase)

1. Go to [supabase.com](https://supabase.com), sign up with GitHub, and click **New project**. Name it `poop-scoopin-boogie`, pick a strong database password (save it somewhere), region **Central US**.
2. When it's ready, open **SQL Editor**, click **New query**, paste everything from [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and click **Run**. You should see "Success". Then do the same with [`supabase/migrations/0002_customers.sql`](supabase/migrations/0002_customers.sql) and [`supabase/migrations/0003_texts.sql`](supabase/migrations/0003_texts.sql).
3. Go to **Authentication → Sign In / Providers** and leave "Allow new users to sign up" **on**, and under **Email** leave **Confirm email** on. Customers make their own email + password login on the sign-up page. It's safe: a new login only sees the client record with the same email, and only people in the staff list see the route app.
4. Go to **Authentication → Users → Add user → Create new user**. Add yourself and your mom with email and password. Tick "Auto confirm user".
5. Back in **SQL Editor**, run this once, with your real emails and names:

   ```sql
   insert into public.staff (user_id, name)
   select id, 'Riley' from auth.users where email = 'YOUR_EMAIL';
   insert into public.staff (user_id, name)
   select id, 'Mom' from auth.users where email = 'MOMS_EMAIL';
   ```

6. Go to **Project Settings → API**. Keep this tab open: you need the **Project URL** and the **anon public** key next.

## 2. Turn on the website (GitHub Pages)

1. In this GitHub repo, go to **Settings → Secrets and variables → Actions → Variables** and add two repository variables:
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_ANON_KEY` = the anon public key (this one is safe to be public; the database rules protect your data)
2. Go to **Settings → Pages** and set **Source** to **GitHub Actions**. Under **Custom domain**, type `poopscoopinboogie.org` and click **Save**.
3. In Namecheap, go to **Domain List → Manage** next to `poopscoopinboogie.org` → **Advanced DNS**. Delete the parking records Namecheap added (the `www` CNAME to parkingpage and the `@` URL Redirect), then add:
   - Four **A Records**, Host `@`, values `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - One **CNAME Record**, Host `www`, value `poopscoopinboogietexas-bot.github.io.`
4. Go to **Actions → Deploy app → Run workflow**. When it turns green and the domain check in **Settings → Pages** passes (can take up to a day), tick **Enforce HTTPS**. Your site is at `https://poopscoopinboogie.org/`.
5. In Supabase, go to **Authentication → URL Configuration**. Set **Site URL** to `https://poopscoopinboogie.org/` and add it under **Redirect URLs** too. This is where customer login links send people.

The public website is the app address itself (home page, `#/faq`, `#/signup`). Customers sign up at `https://poopscoopinboogie.org/#/signup`. You and your mom use `https://poopscoopinboogie.org/#/app`. Put the sign-up link on your flyers and Google profile. New sign-ups show up at the top of the Clients tab.

## 3. Turn on customer emails (Gmail)

1. Use the business Gmail, `poopscoopinboogietexas@gmail.com`.
2. In that Google account, turn on **2-Step Verification**, then go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) and create an app password named "Scoopin app". Copy the 16 letters.
3. In Supabase, go to **Edge Functions → Secrets** and add:
   - `GMAIL_USER` = the business Gmail address
   - `GMAIL_APP_PASSWORD` = the 16-letter app password
4. In Supabase, go to **Edge Functions → Deploy a new function → Via Editor**. Name it exactly `complete-visit`, paste everything from [`supabase/functions/complete-visit/index.ts`](supabase/functions/complete-visit/index.ts), and click **Deploy**.

### Send account emails from the business Gmail too

Out of the box, "confirm your email" and "reset your password" emails come from Supabase. To send them from `poopscoopinboogietexas@gmail.com` instead:

1. In Supabase, go to **Authentication → Emails → SMTP Settings** and turn on **Enable custom SMTP**:
   - Sender email: `poopscoopinboogietexas@gmail.com`
   - Sender name: `Poop Scoopin' Boogie`
   - Host: `smtp.gmail.com`, Port: `465`
   - Username: `poopscoopinboogietexas@gmail.com`
   - Password: the same 16-letter app password
2. In **Authentication → Emails → Templates**:
   - **Confirm signup**: subject `Confirm your Poop Scoopin' Boogie account`, body from [`supabase/email-templates/confirm-signup.html`](supabase/email-templates/confirm-signup.html)
   - **Reset password**: subject `Set a new password for Poop Scoopin' Boogie`, body from [`supabase/email-templates/reset-password.html`](supabase/email-templates/reset-password.html)
3. In **Authentication → Rate Limits**, raise **emails per hour** to `100`.

## 4. Turn on online payments (Stripe)

How it works: after signing up, customers tap **Set up autopay** and pay by card on Stripe's page. Their plan renews on that same day every month. The one-time cleanup fee is on the first payment only. On their account page they can update their card, see receipts, or cancel (billing stops at the end of the month they paid for). If a card fails, they show as **Payment issue**; after 7 days they're paused and land on your **Call list**. When they pay, they go back to **Active** on their own.

Never paste a Stripe key into a chat, an email, or this website's code. Keys only go in **Supabase → Edge Functions → Secrets**.

Start in **test mode** (fake cards, no real money), then switch to live at the end.

1. **Make the account.** Sign up free at [stripe.com](https://stripe.com) with the business email. Fill in the business details: business type (sole proprietor is fine), your name and address, SSN or EIN, the bank account where payouts go, website `https://poopscoopinboogie.org`, and a description like "Residential dog waste removal, monthly service." For **statement descriptor** (what shows on card statements) use `POOP SCOOPIN BOOGIE`.
2. **Turn on test mode.** Flip the **Test mode** switch (top right), or open a **Sandbox**. Do steps 3 to 8 there.
3. **Customer portal.** Go to **Settings → Billing → Customer portal** and click **Activate**. Turn on:
   - Payment methods: customers can update them
   - Invoice history: show it
   - Cancel subscriptions: on, **at end of billing period**, and no cancellation fee
   - Leave "Customers can switch plans" **off**.
   Save.
4. **Failed payments.** Go to **Settings → Billing → Subscriptions and emails**. Under **Manage failed payments**, turn on **Smart Retries** and the email that tells customers their card failed. For "If all retries for a payment fail", pick **mark the subscription as unpaid** (not cancel). Under **Settings → Business → Customer emails**, turn on **Successful payments** so they get receipts.
5. **Secret key.** Go to **Developers → API keys** and copy the **Secret key** (starts with `sk_test_`). In Supabase go to **Edge Functions → Secrets → Add new secret**: name `STRIPE_SECRET_KEY`, paste the key, save.
6. **Two functions.** In Supabase go to **Edge Functions → Deploy a new function → Via Editor**:
   - Name `billing`, paste everything from [`supabase/functions/billing/index.ts`](supabase/functions/billing/index.ts), click **Deploy**.
   - Name `stripe-webhook`, paste everything from [`supabase/functions/stripe-webhook/index.ts`](supabase/functions/stripe-webhook/index.ts), click **Deploy**. Then open its **Details** (or settings) and turn **off** "Verify JWT" / "Enforce JWT verification", and save. Stripe calls this one, not a logged-in person.
7. **Webhook.** In Stripe go to **Developers → Webhooks → Add endpoint** (it may say **Add destination**, then **Webhook endpoint**).
   - URL: `https://nyyjzuruohumoscrtksm.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Save, then copy its **Signing secret** (starts with `whsec_`). In Supabase **Edge Functions → Secrets**, add `STRIPE_WEBHOOK_SECRET` with it.
8. **Test it.** Run the database updates at the top of this page if you haven't yet. Sign up on the website with an email you can check, tap **Set up autopay**, and pay with card `4242 4242 4242 4242`, any future date, any 3 digits. In the staff app, **Clients → New sign-ups** should show "Autopay on". Log in as that customer and try **Manage payments** and **Cancel my service**.
9. **Go live.** Turn test mode off and repeat steps 3, 4, 5 and 7 in live mode (Stripe keeps test and live settings separate). In Supabase, replace the two secrets with the live ones (`sk_live_…` and the live `whsec_…`). Then delete the test customer from the staff app.

If you change someone's price in the staff app (more dogs, say), change it in Stripe too: **Customers → their name → subscription → Update**. One-time cleanups aren't on autopay; send those a **Payment link** from Stripe.

## 5. Put it on your phones

Open the app link on each phone.

- **iPhone (Safari):** tap Share, then **Add to Home Screen**.
- **Android (Chrome):** tap the ⋮ menu, then **Add to Home screen** or **Install app**.

Log in with the email and password from step 1.4.
