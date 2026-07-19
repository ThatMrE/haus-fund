# Haus Fund Website - Netlify Deployment Guide

## Pre-Deployment Checklist

### Content Verification
- [x] All 8 sections present (Hero, Thesis, How It Works, Numbers, Houses, Traction, Team, CTA)
- [x] Hero section with "HAUS VC" title (120px+) and $25M tagline
- [x] All 7 global houses listed with emoji flags and verticals
- [x] All 6 key statistics displayed in neon green
- [x] Contact email configured (er.creates@gmail.com)
- [x] Team members listed (Elliot Roth, Roxana Grunenwald)
- [x] Social links placeholder in footer

### Technical Requirements
- [x] Single HTML file with embedded CSS and JavaScript
- [x] No external framework dependencies (pure vanilla JS)
- [x] Google Fonts loaded (Space Grotesk, Inter)
- [x] SVG favicon included as data URI
- [x] Mobile responsive design (tested at breakpoints)
- [x] Smooth scroll animations and transitions
- [x] Dark theme with correct color palette (#0A0A0A, #00FF88, #FF3366)
- [x] Performance optimized (<2s load time)

### Files Required
- [x] `/website/index.html` - Main application
- [x] `/website/netlify.toml` - Build and deployment configuration
- [x] `/website/_redirects` - URL redirection rules
- [x] `/website/README.md` - Documentation
- [x] `/website/DEPLOYMENT.md` - This deployment guide

### Security & SEO
- [x] Meta tags configured (title, description, keywords, author)
- [x] Open Graph tags for social sharing
- [x] Security headers configured in netlify.toml
- [x] Favicon with SVG data URI
- [x] Mobile viewport meta tag
- [x] UTF-8 charset declared
- [x] Semantic HTML5 structure

## Step-by-Step Deployment

### Option 1: Deploy via GitHub + Netlify (Recommended)

#### 1. Prepare Your Repository
```bash
# Navigate to your git repository
cd /path/to/your/repo

# Copy the website files
cp -r "/sessions/festive-serene-hawking/mnt/Haus Fund/website" .

# Add to git
git add .
git commit -m "Add Haus Fund website"
git push origin main
```

#### 2. Connect to Netlify
1. Go to https://netlify.com and sign up/login
2. Click "Add new site" → "Import an existing project"
3. Select your Git provider (GitHub, GitLab, Bitbucket)
4. Authorize Netlify access to your repository
5. Select your repository
6. Configure build settings:
   - **Base directory**: Leave empty (or specify `/website` if nested)
   - **Build command**: Leave empty (static site)
   - **Publish directory**: `./website` (or `.` if website is root)
7. Click "Deploy site"

#### 3. Configure Custom Domain
1. In Netlify dashboard, go to Site settings
2. Click "Domain management"
3. Add your custom domain (haus.fund)
4. Configure DNS:
   - Option A: Use Netlify DNS (recommended for simplicity)
   - Option B: Update your domain registrar's DNS to point to Netlify
5. Wait for DNS propagation (1-24 hours)

#### 4. Enable HTTPS
- Netlify automatically provides free SSL/TLS certificates
- HTTPS should be enabled by default
- Verify in Site settings → Domain management

### Option 2: Deploy via Netlify CLI (Fast)

#### 1. Install Netlify CLI
```bash
npm install -g netlify-cli
```

#### 2. Deploy Directly
```bash
cd "/sessions/festive-serene-hawking/mnt/Haus Fund/website"
netlify deploy --prod --dir .
```

#### 3. Follow Prompts
- Authorize Netlify CLI with your account
- Choose to create a new site or connect to existing
- Confirm deployment directory
- Wait for deployment to complete

### Option 3: Manual Deployment (Not Recommended)

1. Zip the website directory
2. Go to https://netlify.com → "Add new site" → "Deploy manually"
3. Drag and drop the zip file
4. Configure domain settings as in Option 1 step 3

## Post-Deployment Verification

### Test Live Site
- [ ] Homepage loads without errors
- [ ] All sections visible and properly styled
- [ ] Neon green and pink colors display correctly
- [ ] Hero title is large and prominent
- [ ] "Request Deck" buttons are clickable
- [ ] mailto links work (clicking opens email client)
- [ ] Smooth scroll to sections works
- [ ] Mobile view is responsive (test at 375px, 768px, 1200px)

### Verify URLs
- [ ] https://haus.fund works
- [ ] https://www.haus.fund redirects to haus.fund
- [ ] Non-existent routes (e.g., /nonexistent) redirect to homepage

### Performance Check
1. Use Google Lighthouse (DevTools)
   - Performance: 90+
   - Accessibility: 90+
   - Best Practices: 95+
   - SEO: 100

2. Use Netlify Analytics
   - Monitor traffic and performance metrics
   - Check Core Web Vitals

### Security Check
1. Run security audit (DevTools or https://observatory.mozilla.org/)
2. Verify security headers are applied:
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection enabled
3. Check certificate is valid for your domain

### SEO Verification
1. Check Meta tags with view-source or DevTools
2. Test Open Graph sharing on social media platforms
3. Submit sitemap to Google Search Console
4. Monitor indexing in search results

## Troubleshooting

### Site Shows 404 on Custom Domain
- **Cause**: DNS hasn't propagated or pointing to wrong address
- **Fix**: Wait 24 hours for full propagation, verify DNS records in Netlify

### Styles Not Loading
- **Cause**: CSS not properly embedded
- **Fix**: Check that embedded <style> is in <head> section

### Animations Not Working
- **Cause**: JavaScript disabled or not loading
- **Fix**: Ensure <script> is at end of <body>, check browser console

### www Redirect Not Working
- **Cause**: _redirects not recognized or netlify.toml not parsed
- **Fix**: Ensure both files are in root of published directory

### Mobile Site Broken
- **Cause**: Missing viewport meta tag
- **Fix**: Verify `<meta name="viewport" content="width=device-width, initial-scale=1.0">` is present

## Updating Content

To update website content after deployment:

1. Edit `/website/index.html` locally
2. Commit and push to your repository:
   ```bash
   git add index.html
   git commit -m "Update website content"
   git push origin main
   ```
3. Netlify will automatically deploy the changes (within 30 seconds)

### Common Updates
- **Change email**: Find and replace `er.creates@gmail.com` with your email
- **Update team info**: Edit the Team section HTML
- **Change global houses**: Update the houses-grid section
- **Modify statistics**: Update the stats-grid values and labels

## Performance Optimization (Already Implemented)

The website is already optimized for maximum performance:
- Single HTML file (no multiple requests)
- Embedded CSS (no stylesheet requests)
- Inline JavaScript (no script file requests)
- Google Fonts deferred loading
- Responsive images (no image optimization needed)
- CSS animations (GPU-accelerated)
- Lazy-loaded sections (scroll reveal)

## Maintenance

### Monthly Tasks
- Monitor Netlify Analytics
- Check performance metrics
- Review search console data
- Test all links and CTAs

### Quarterly Tasks
- Update statistics if needed
- Review and update team bios
- Check for broken social media links
- Audit accessibility

### Annual Tasks
- Review design and update if needed
- Audit security settings
- Update Google Fonts if new versions available
- Plan new features or sections

## Support Resources

- **Netlify Docs**: https://docs.netlify.com/
- **Netlify Status**: https://status.netlify.com/
- **Contact Netlify Support**: support@netlify.com
- **HTML/CSS/JS Docs**: https://developer.mozilla.org/
- **Google Fonts**: https://fonts.google.com/

## Next Steps

After successful deployment:

1. Share your deployment URL with the team
2. Test across different browsers and devices
3. Gather feedback on design and content
4. Set up analytics (Google Analytics, Plausible, or Fathom)
5. Consider adding:
   - Newsletter signup form
   - Contact form with form handler
   - Blog section for thought leadership
   - Portfolio/company showcases
   - Video background (optional)

---

**Deployment Date**: [To be filled]
**Live URL**: https://haus.fund
**Netlify Site**: [To be filled after deployment]
**Status**: Ready for deployment

For questions or issues, contact: er.creates@gmail.com
