# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: plant and home-decor enthusiasts browsing and buying online in India — people building a "propagation station" or considered small-object collection at home, price-sensitive enough that ₹500–2100 is a real decision but design-conscious enough to care about finish, material, and provenance over generic mass-market decor. Secondary: gift buyers picking up a planter or the clock for someone else. Social content also targets "ShopSmallIndia" and work-from-home desk-setup audiences (people who'd put a propagation station next to a laptop, not just on a windowsill).

## Product Purpose

YZ Labs is a solo/small-studio 3D-printing operation based in Bengaluru, India, designing and printing small-batch home decor objects — currently propagation planters and a wall clock — and selling them direct-to-consumer through this website. Success is a completed order (UPI/card/netbanking checkout via Razorpay) from someone who came to trust that what they're buying was actually made, in small batches, by a real studio, not resold from a mass import catalog.

## Positioning

Real small-batch production transparency: batch numbers on every product, per-part print profiles (not one generic setting for everything), a documented process (design → slice → print → finish → ship), and literal watch-it-get-made content (real print footage, CAD-vs-real-object comparisons, size-in-hand shots). The company's own content repeatedly draws this exact contrast on its own terms: "most 3D printed home decor brands only show you the finished shot... the process is half the reason people care about small batch, made-to-order design." Customization (color, ±20% scale, engraved initials) is a supporting proof point of the same claim, not a separate pitch — a mass reseller can't truthfully offer either.

## Operating Context

- Browse the catalog (a curated orbit gallery on the homepage teaser, a full filterable grid at `/catalog` once the count outgrows the teaser), open a product's spec sheet (material, dimensions, weight, price, batch number, color), add to cart, check out via Razorpay (UPI, cards, netbanking, wallets — live keys configured and verified end to end).
- Contact happens through an in-page popup (name/email/phone/message) that sends real email via Gmail SMTP, not a bare mailto link.
- Legal/policy pages exist (Terms, Privacy, Refund & Cancellation, Shipping) with real business details: Bengaluru, India; +91 8660 828944; yzlabs.store@gmail.com.
- Social content (Instagram, @yzlabs.store) runs a weekly content calendar mixing real print/process footage with generated content built from real reference photos — always inside the same black/blue brand system so the grid reads as one account. Recurring formats: real print timelapses, CAD-vs-finished-object "spot the real one" comparisons, size-in-hand and on-a-real-desk context shots, and price/CTA pieces pairing two products.
- Products are shipped from Bengaluru; India-only for now.

## Capabilities and Constraints

- Stack: React + Vite SPA (React Router for `/`, `/catalog`, legal pages, `/contact`), Express backend, Razorpay Node SDK, Gmail SMTP via nodemailer for the contact form.
- Product images are folder-driven: `GET /api/product-images` scans `public/products/<folder>/` on every request — dropping or removing a file shows up immediately, no code change. A file named `hero.*` is the catalog/hero shot; every other image in the folder is the gallery, sorted by filename.
- Material is PLA only, no qualifier (no "satin/matte," no "sourced from EU/US" claim — deliberately removed).
- Named colorways: Black, Peach, Ivory, Walnut, Metallic Blue. Only three are actually assigned to live products right now (Black/Walnut on the Round Planter, Peach/Walnut on the Step Planter, Peach on the Corner Planter, Walnut on the clock) — Ivory and Metallic Blue are on the palette but not yet used by any real product. This is a known, not-yet-resolved inconsistency between the Materials & Fit section's claim and the actual catalog.
- Current catalog (4 products, all "In stock"): Round Propagation Planter (₹1070, B-009, holds 3 cuttings, three-hole disc), Step Propagation Planter / "Stair-Step Propagation Station" in social content (₹2100, B-021, 3 cuttings), Corner Wall Planter (₹1500, B-026, hex-textured shell, honeycomb/waffle infill, mounts into a wall corner), Ridge Wall Clock (₹500, B-032) — called "Slat Clock" in social content; the site's own naming and the social-content naming for the clock haven't been reconciled.
- Minimum orderable price ₹500 (a fail-safe default — a real product missing a price falls back to this rather than ever reaching Razorpay at ₹0, which previously caused a real rejection).
- No database yet — cart is client-side (localStorage), orders tracked in an in-memory server map that resets on restart.
- Products are designed in CAD (SolidWorks) before being printed — the company's own content explicitly compares CAD renders to the finished object as a trust-building device.

## Brand Commitments

- Name: YZ Labs. Wordmark set in Major Mono Display. Tagline variants in use: "Small Objects, Precisely Printed," "Printed, Not Mass-Produced."
- Visual system ("black/blue brand system," the company's own term for it): pitch-black ground throughout, off-white foreground text, a single accent blue (`#3d6bff`), Sora for display headlines, JetBrains Mono for technical/spec labels (batch numbers, dimensions, coordinates), Inter for body copy. Thin hairline borders and faint grid-overlay textures recur as a "lab/spec-sheet" motif (a persistent visual metaphor, not a one-off).
- Voice: first-person plural ("we"), casual but technical, leads with real process detail over polish, frequently poses a direct question to the audience, explicitly contrasts itself against generic/mass 3D-printed decor sellers.
- Contact: yzlabs.store@gmail.com · +91 8660 828944 · Instagram @yzlabs.store · Bengaluru, India.

## Evidence on Hand

- Real product photography: `public/products/<folder>/hero.png` + gallery images for all 4 current products, shot on pure black.
- Real process photography/video at `D:\3DPrint\process\`: actual SPARKX 3D printer mid-print (several angles), a round-planter print in progress, a corner-planter print showing waffle infill mid-print and the finished hex shell.
- A Gemini/Veo-generated turntable video of the Round Planter (`D:\3DPrint\website\`), anchored to the real product photo — used as a scroll-scrubbed hero treatment in design exploration. Carries a small AI-tool watermark in one corner that needs masking or cropping wherever it's used.
- A week-2 social content calendar/script (`D:\3DPrint\process\yzlabs_week2_content.md`) documenting real reference assets (`clock-cad-hands`, `clock-photo-hand`, a real desk/laptop photo of the step planter, real round-planter print clips) and the exact voice/format the brand already runs on Instagram — useful ground truth for copy voice, not to be treated as web-page copy verbatim.
- No customer testimonials, press, or case studies exist yet — future work must not invent any.

## Product Principles

1. Never claim more than the catalog actually has — price, stock status, and available colorways must always match real, live product data, not aspiration (this already slipped once with the colorway palette; don't let it slip further).
2. Process transparency is the product's actual differentiator, not a decorative section — batch numbers, spec sheets, and real print/CAD imagery should read as evidence, not styling.
3. Small-batch and made-to-order are operational facts, not a slogan — design and copy should keep leaving room for genuine batch/stock variation rather than implying warehouse-style always-in-stock availability.
4. Design for a slowly, deliberately growing catalog (a solo studio adding pieces over time), not a rapid-scale storefront — new-product workflows should stay as low-friction as the current folder-driven image system, not add ceremony.
5. The black/blue spec-sheet visual system is durable brand identity, not a placeholder look — extensions should deepen it (more of the lab/documentation motif) rather than replace it.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established yet.
