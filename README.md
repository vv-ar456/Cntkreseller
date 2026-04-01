# Conitek - Reselling E-commerce Platform

## Setup Instructions

### 1. Database Setup
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the content from `supabase-schema.sql`
4. Run the SQL to create all tables, indexes, and policies

### 2. Supabase Configuration
- Enable Email/Password auth in Authentication settings
- Make sure RLS is enabled on all tables
- Storage buckets 'products', 'categories', 'avatars' will be auto-created

### 3. Deploy to GitHub Pages
1. Create a new repository
2. Push all files to the repository
3. Go to Settings > Pages
4. Select "Deploy from a branch" - main branch, root directory
5. Your site will be live at `https://username.github.io/repo-name/`

### 4. Admin Access
- Navigate to `/admin/`
- Default password: `admin123`
- Change password in Supabase admin_config table

### Features
- **Reseller Margin System**: Users add their own margin to MRP
- **OTP Login**: Phone-based login via 2Factor API
- **Payment Gateway**: Razorpay Live integration
- **Settlement Tracking**: Auto-settlement on delivery
- **Admin Panel**: Complete management dashboard
- **Analytics**: Per-user and website-wide analytics
- **Responsive Design**: Mobile-first approach

### Tech Stack
- Frontend: Vanilla HTML, CSS, JavaScript
- Backend: Supabase (PostgreSQL, Auth, Storage, Realtime)
- Payments: Razorpay
- OTP: 2Factor.in
- Hosting: GitHub Pages

### Currency: INR (₹)
