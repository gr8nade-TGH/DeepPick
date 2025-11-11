# Sharp Siege Email Templates

Custom email templates for Supabase authentication with Sharp Siege branding.

## 📧 Templates

### 1. **confirm-signup.html** - Email Verification
- **Subject:** "Verify Your Email - Sharp Siege"
- **Purpose:** Sent when a new user signs up
- **Color Scheme:** Cyan/Blue gradient
- **Expiration:** 24 hours

### 2. **recovery.html** - Password Reset
- **Subject:** "Reset Your Password - Sharp Siege"
- **Purpose:** Sent when a user requests a password reset
- **Color Scheme:** Orange/Red gradient
- **Expiration:** 1 hour

### 3. **magic-link.html** - Magic Link Sign In
- **Subject:** "Sign In to Sharp Siege"
- **Purpose:** Sent when a user requests a magic link to sign in
- **Color Scheme:** Green gradient
- **Expiration:** 1 hour

### 4. **email-change.html** - Email Change Confirmation
- **Subject:** "Confirm Your Email Change - Sharp Siege"
- **Purpose:** Sent when a user changes their email address
- **Color Scheme:** Purple/Indigo gradient
- **Expiration:** 24 hours

---

## 🎨 Design Features

All templates include:
- ✅ **Sharp Siege branding** with ⚔️ logo
- ✅ **Responsive design** - works on mobile and desktop
- ✅ **Modern gradient backgrounds** - dark theme with vibrant accents
- ✅ **Security notes** - clear expiration times and security warnings
- ✅ **Accessible buttons** - large, easy-to-click CTAs
- ✅ **Alternative links** - plain text URLs for email clients that don't support buttons
- ✅ **Footer links** - website, support, privacy policy
- ✅ **Professional typography** - system fonts for fast loading

---

## 🔧 Configuration

These templates are configured in `supabase/config.toml`:

```toml
[auth.email.template.confirmation]
subject = "Verify Your Email - Sharp Siege"
content_path = "./supabase/templates/confirm-signup.html"

[auth.email.template.recovery]
subject = "Reset Your Password - Sharp Siege"
content_path = "./supabase/templates/recovery.html"

[auth.email.template.magic_link]
subject = "Sign In to Sharp Siege"
content_path = "./supabase/templates/magic-link.html"

[auth.email.template.email_change]
subject = "Confirm Your Email Change - Sharp Siege"
content_path = "./supabase/templates/email-change.html"
```

---

## 📝 Template Variables

Supabase provides these variables for use in templates:

- `{{ .ConfirmationURL }}` - The confirmation/action URL
- `{{ .Email }}` - The user's email address
- `{{ .SiteURL }}` - Your site URL (from config)
- `{{ .Token }}` - The confirmation token (if needed)
- `{{ .TokenHash }}` - The hashed token (if needed)

---

## 🧪 Testing

### Local Development

When running Supabase locally, emails are captured by Inbucket:

1. Start Supabase: `npx supabase start`
2. Open Inbucket: http://localhost:54324
3. Trigger an email (signup, password reset, etc.)
4. View the email in Inbucket

### Production

For production, configure your SMTP settings in the Supabase dashboard:

1. Go to **Authentication** → **Email Templates**
2. Upload custom templates
3. Configure SMTP settings in **Project Settings** → **Auth**

---

## 🎯 Brand Colors

Sharp Siege color palette used in templates:

- **Primary Gradient:** `#06b6d4` (cyan) → `#3b82f6` (blue)
- **Success:** `#10b981` (green)
- **Warning:** `#f59e0b` (amber) → `#ef4444` (red)
- **Info:** `#8b5cf6` (purple) → `#6366f1` (indigo)
- **Background:** `#0f172a` (slate-950) → `#1e293b` (slate-800)
- **Text:** `#e2e8f0` (slate-200)

---

## 📱 Mobile Optimization

All templates are mobile-responsive:
- Max width: 600px
- Padding adjusts for small screens
- Buttons are touch-friendly (min 44px height)
- Text is readable on all devices

---

## 🔒 Security Features

- ✅ Clear expiration times displayed
- ✅ Warning messages for unauthorized requests
- ✅ Recipient email shown in footer
- ✅ Links expire automatically (handled by Supabase)
- ✅ No sensitive information in email body

---

## 🚀 Deployment

### Local Development
Templates are automatically loaded from `./supabase/templates/` when running locally.

### Production
Upload templates to Supabase dashboard or use the CLI:

```bash
# Deploy all templates
npx supabase db push

# Or manually upload in dashboard:
# Authentication → Email Templates → Upload Custom Template
```

---

## 📞 Support

If users have issues with emails:
- Check spam/junk folders
- Verify email address is correct
- Use "Resend Email" button in app
- Contact support at support@sharpsiege.com

---

**© 2025 Sharp Siege. All rights reserved.**

