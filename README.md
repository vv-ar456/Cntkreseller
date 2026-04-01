# Conitek — Reselling Ecommerce Platform

A complete, single-file reselling ecommerce site ready for GitHub Pages deployment.

---

## 🚀 Quick Deploy to GitHub Pages

1. Create a new GitHub repository (e.g., `conitek-store`)
2. Upload `index.html` to the root of the repository
3. Go to **Settings → Pages → Source → main branch / root**
4. Your site will be live at `https://yourusername.github.io/conitek-store`

---

## 🔧 Configuration (Edit in index.html)

At the top of the `<script>` section, replace these placeholders:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';         // From Supabase project settings
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // From Supabase API settings
const RAZORPAY_KEY = 'YOUR_RAZORPAY_KEY_ID';       // From Razorpay dashboard
const TWOFACTOR_API = 'YOUR_2FACTOR_API_KEY';      // From 2factor.in dashboard
const ADMIN_PASSWORD = 'Conitek@Admin2024';        // Change to your secure password
```

---

## 🗃️ Supabase Setup

Create these tables in your Supabase project:

### `products`
```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  sub_category text,
  mrp numeric not null,
  cost numeric,
  stock integer default 0,
  emoji text default '📦',
  special boolean default false,
  active boolean default true,
  description text,
  sku text,
  image_url text,
  created_at timestamptz default now()
);
```

### `categories`
```sql
create table categories (
  id text primary key,
  name text not null,
  emoji text,
  description text
);
```

### `sub_categories`
```sql
create table sub_categories (
  id text primary key,
  name text not null,
  parent_id text references categories(id)
);
```

### `orders`
```sql
create table orders (
  id text primary key,
  user_id uuid references auth.users(id),
  customer_name text,
  items jsonb,
  mrp numeric,
  margin numeric,
  total numeric,
  status text default 'Processing',
  tracking text,
  payment_id text,
  address jsonb,
  created_at timestamptz default now()
);
```

### `users_profile`
```sql
create table users_profile (
  id uuid primary key references auth.users(id),
  fname text,
  lname text,
  phone text,
  referral_code text unique,
  bank_account jsonb,
  created_at timestamptz default now()
);
```

### `settlements`
```sql
create table settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  amount numeric,
  status text default 'Pending',
  utr text,
  settled_at timestamptz,
  created_at timestamptz default now()
);
```

---

## 💳 Razorpay Setup
1. Create account at razorpay.com
2. Get your **Key ID** from Dashboard → Settings → API Keys
3. Paste into `RAZORPAY_KEY` in the config

---

## 📱 2Factor OTP Setup
1. Register at 2factor.in
2. Get API key from dashboard
3. Paste into `TWOFACTOR_API` in the config
4. In the `doRegister()` function, replace the timeout simulation with:

```js
fetch(`https://2factor.in/API/V1/${TWOFACTOR_API}/SMS/${phone}/AUTOGEN`)
  .then(r => r.json())
  .then(data => {
    appState._otpSession = data.Details; // Store session for verification
    // Show OTP input screen...
  });
```

---

## 🔐 Admin Access
- **URL**: Add `#admin` or press `Ctrl+Alt+A` anywhere on the site
- **Default username**: `admin`
- **Default password**: `Conitek@Admin2024` (change in config!)

---

## 📋 Features Included

### Customer Features
- ✅ Login / Register with OTP verification (2Factor)
- ✅ Product browsing with category & sub-category filters
- ✅ Product detail with custom margin setter
- ✅ Cart with quantity management
- ✅ Checkout with address selection
- ✅ Razorpay payment integration
- ✅ Order tracking with progress steps
- ✅ Liked/saved products
- ✅ Search with live dropdown
- ✅ Notifications
- ✅ Account profile editing
- ✅ Multiple addresses management
- ✅ Bank account with OTP-protected editing
- ✅ Payments & settlement tracking
- ✅ Personal analytics dashboard

### Admin Features (Password Protected)
- ✅ Dashboard with key metrics
- ✅ Add / Edit / Delete products
- ✅ Product image upload preview
- ✅ Create / manage categories & sub-categories
- ✅ Mark products as Hot/Special/Featured
- ✅ Order management with status updates
- ✅ RTO marking and tracking ID entry
- ✅ Settlement management per reseller
- ✅ Run settlements manually
- ✅ User management
- ✅ Website-wide analytics with charts

---

## 🎨 Customization
- Colors: Edit CSS variables in `:root` at the top of `<style>`
- Logo: Replace "Conitek" text or add `<img>` tag with the uploaded logo
- Admin password: Change `ADMIN_PASSWORD` constant
