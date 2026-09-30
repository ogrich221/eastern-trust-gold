import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { submitHomepageInquiry } from "@/lib/admin.functions";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Landmark,
  LockKeyhole,
  PiggyBank,
  ShieldCheck,
  PhoneCall,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  Bitcoin,
  Globe,
  ExternalLink
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import heroImage from "@/assets/eastern-trust-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Eastern Trust Bank | Banking Built on Trust" },
    { name: "description", content: "Explore personal and business banking, lending, Bitcoin custody, and competitive rates at Eastern Trust Bank." },
    { property: "og:title", content: "Eastern Trust Bank | Banking Built on Trust" },
    { property: "og:description", content: "A stronger financial future starts with a bank that puts trust first." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: Index,
});

function Index() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", department: "general", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const sendInquiry = useServerFn(submitHomepageInquiry);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSending(true);
    try {
      await sendInquiry({ data: form });
      setSent(true);
      toast.success("Inquiry received! A dedicated Eastern Trust advisor will contact you within 2 hours.");
      setForm({ name: "", email: "", phone: "", department: "general", message: "" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit inquiry. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const services: { icon: LucideIcon; title: string; copy: string; to: "/business" | "/products" | "/cards" | "/loans" }[] = [
    { icon: Landmark, title: "Personal banking", copy: "Everyday checking with zero hidden fees and automated cash flow management.", to: "/products" },
    { icon: Building2, title: "Business banking", copy: "Practical treasury support, commercial credit, and cash flow operations.", to: "/business" },
    { icon: CreditCard, title: "Cards & lending", copy: "Gold Rewards with 3% cash back on travel/dining and zero foreign exchange fees.", to: "/cards" },
    { icon: Bitcoin, title: "Bitcoin vault custody", copy: "Institutional cold-storage crypto accumulation backed by SOC 2 certification.", to: "/products" },
  ];

  return (
    <main>
      {/* HERO SECTION */}
      <section className="relative min-h-[calc(100vh-5rem)] overflow-hidden border-b border-border">
        <img src={heroImage} alt="Eastern Trust Bank headquarters entrance" width={1600} height={1000} className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="hero-scrim absolute inset-0" />
        <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center px-5 py-20 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase text-primary">
              <span className="h-px w-10 bg-primary" />Established on trust • Member FDIC
            </div>
            <h1 className="text-5xl font-semibold leading-[0.96] text-foreground sm:text-7xl lg:text-8xl">
              Prosperity,<br/><span className="text-primary">preserved.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-foreground/80 sm:text-lg">
              Thoughtful banking for the life you are building. Personal guidance, modern digital access, institutional Bitcoin custody, and relationships designed to last.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/signup">Open an account <ArrowRight className="ml-1.5 size-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/personal">Explore personal banking</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="border border-border/80">
                <a href="#contact">Contact a banker</a>
              </Button>
            </div>
            <div className="mt-12 flex items-center gap-3 text-xs text-foreground/70">
              <ShieldCheck className="size-4 text-primary" /> Protected access, 256-bit encryption, and FDIC insurance up to $250,000
            </div>
          </div>
        </div>
      </section>

      {/* CORE SERVICES GRID */}
      <section className="border-b border-border bg-background py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Banking, considered</p>
              <h2 className="mt-4 text-4xl leading-tight sm:text-5xl font-bold tracking-tight">
                Every ambition deserves a sound foundation.
              </h2>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                Experience high-touch institutional banking tailored to private individuals, growing businesses, and modern asset preservation.
              </p>
            </div>
            <div className="grid gap-px bg-border sm:grid-cols-2">
              {services.map(({ icon: Icon, title, copy, to }) => (
                <Link key={title} to={to} className="group bg-background p-7 transition-colors hover:bg-card">
                  <Icon className="size-7 text-primary" />
                  <h3 className="mt-8 text-2xl font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
                  <span className="mt-6 inline-flex items-center text-xs font-semibold text-primary transition-transform group-hover:translate-x-1">
                    Learn more <ArrowRight className="ml-1.5 size-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY BANNER */}
      <section className="border-b border-border bg-card py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 lg:flex-row lg:items-center lg:px-8">
          <div className="flex gap-5">
            <LockKeyhole className="mt-2 size-8 shrink-0 text-primary"/>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold">Your security is never an afterthought.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                We deploy hardware security modules (HSM), multi-layered biometric controls, and proactive transaction auditing to protect every dollar and satoshi.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to="/help">Security center <ArrowRight className="ml-1.5 size-4" /></Link>
          </Button>
        </div>
      </section>

      {/* BANK CONTACT DETAILS & INQUIRIES SECTION */}
      <section id="contact" className="border-b border-border bg-background py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs uppercase tracking-widest py-1">
              Direct Contact & Support
            </Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              We’re here for you, around the clock.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground">
              Have questions regarding account opening, wire transfers, loan applications, or private wealth services? Connect directly with our bankers.
            </p>
          </div>

          {/* 4 Official Contact Channels */}
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Phone */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-md">
              <div>
                <span className="grid size-12 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <PhoneCall className="size-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-foreground">Phone Assistance</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  24/7 Dedicated Client Hotline with direct banker routing and zero automated phone trees.
                </p>
                <div className="mt-4 space-y-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Primary Hotline (24/7):</p>
                    <p className="text-sm font-semibold text-primary font-mono">+1 800 582 EWB</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Priority Line:</p>
                    <p className="text-sm font-semibold text-foreground font-mono">+ 1 900 682 EWB</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <Button asChild size="sm" variant="outline" className="w-full text-xs">
                  <a href="tel:+1800582EWB">Call Primary Hotline</a>
                </Button>
                <Button asChild size="sm" variant="ghost" className="w-full text-xs border border-border">
                  <a href="tel:+1900682EWB">Call Priority Line</a>
                </Button>
              </div>
            </div>

            {/* Email */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-md">
              <div>
                <span className="grid size-12 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <Mail className="size-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-foreground">Official Email</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Written support for account documentation, wire confirmations, and formal corporate banking.
                </p>
                <div className="mt-4 space-y-1">
                  <p className="text-sm font-semibold text-foreground font-mono truncate">support@easterntrustbank.co</p>
                  <p className="text-xs text-muted-foreground">Response within 2 business hours</p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="mt-6 w-full text-xs">
                <a href="mailto:support@easterntrustbank.co">Email Support</a>
              </Button>
            </div>

            {/* Headquarters Location */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-md">
              <div>
                <span className="grid size-12 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <MapPin className="size-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-foreground">Banking Headquarters</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Executive offices, advisory suites, and safe deposit vault services in Midtown Manhattan.
                </p>
                <div className="mt-4 space-y-1">
                  <p className="text-xs font-semibold text-foreground">Eastern Trust Tower</p>
                  <p className="text-xs text-muted-foreground">452 5th Avenue, New York, NY 10018</p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="mt-6 w-full text-xs">
                <a href="https://maps.google.com/?q=452+5th+Ave+New+York+NY+10018" target="_blank" rel="noopener noreferrer">
                  Directions & Maps <ExternalLink className="ml-1 size-3" />
                </a>
              </Button>
            </div>

            {/* Operating Hours & Routing */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-md">
              <div>
                <span className="grid size-12 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <Clock className="size-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-foreground">Hours & Routing</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  ABA routing number for domestic direct deposit, payroll ACH, and wire transfers.
                </p>
                <div className="mt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ABA Routing:</span>
                    <strong className="font-mono text-primary">021000089</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SWIFT / BIC:</span>
                    <strong className="font-mono text-foreground">ETBNUS33XXX</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mon–Fri:</span>
                    <span className="text-foreground">8:30 AM – 5:00 PM EST</span>
                  </div>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="mt-6 w-full text-xs" onClick={() => {
                navigator.clipboard?.writeText("021000089");
                toast.success("Routing number copied to clipboard: 021000089");
              }}>
                <button type="button">Copy Routing Number</button>
              </Button>
            </div>
          </div>

          {/* Interactive Direct Message Card */}
          <div className="mt-14 rounded-2xl border border-border bg-card p-8 md:p-12 shadow-sm">
            <div className="grid gap-10 lg:grid-cols-5 items-center">
              <div className="lg:col-span-2 space-y-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Online Inquiries</span>
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Leave a message for an account executive.
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Looking for tailored solutions, corporate loan rates, or specialized escrow assistance? Send our team a note and an executive banker will respond promptly.
                </p>
                <div className="pt-4 space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Direct priority escalation to senior branch officers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Confidential, end-to-end encrypted inquiry transmission</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Zero spam guarantee — exclusively banking correspondence</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleContactSubmit} className="lg:col-span-3 space-y-4 rounded-xl border border-border/80 bg-background/50 p-6 md:p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-medium">Your Name *</Label>
                    <Input
                      required
                      placeholder="Jane Doe"
                      className="mt-1.5 text-xs h-10"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Email Address *</Label>
                    <Input
                      required
                      type="email"
                      placeholder="jane@example.com"
                      className="mt-1.5 text-xs h-10"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-medium">Phone Number (Optional)</Label>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      className="mt-1.5 text-xs h-10"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Department</Label>
                    <select
                      className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                    >
                      <option value="general">General Client Care</option>
                      <option value="checking">Everyday Checking & Cards</option>
                      <option value="business">Commercial Lending & Treasury</option>
                      <option value="bitcoin">Bitcoin Custody & Digital Assets</option>
                      <option value="tax">IRS & Tax Documentation</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium">How can we assist you? *</Label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Provide brief details about your inquiry..."
                    className="mt-1.5 w-full rounded-md border border-input bg-background p-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                  />
                </div>

                <Button type="submit" disabled={sending} className="w-full sm:w-auto font-semibold">
                  {sending ? (
                    "Sending Message…"
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="size-4" /> Send Direct Inquiry
                    </span>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* INSTITUTIONAL BANK FOOTER */}
      <footer className="border-t border-border bg-card py-16 text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
            {/* Col 1: Brand & Headquarters */}
            <div className="lg:col-span-2 space-y-4">
              <Link to="/" className="flex items-center gap-3">
                <span className="grid size-9 place-items-center border border-primary text-base font-bold text-primary">ET</span>
                <span className="font-display text-lg font-semibold text-foreground">Eastern Trust <span className="text-primary">Bank</span></span>
              </Link>
              <p className="max-w-sm leading-relaxed">
                Eastern Trust Bank NA provides premiere personal, commercial, and digital asset banking solutions founded on generational integrity, strict security, and relationship service.
              </p>
              <div className="space-y-1 pt-2 font-mono text-[11px]">
                <p>ABA Routing: <strong className="text-foreground">021000089</strong></p>
                <p>SWIFT/BIC: <strong className="text-foreground">ETBNUS33XXX</strong></p>
                <p>Headquarters: 452 5th Avenue, New York, NY 10018</p>
              </div>
            </div>

            {/* Col 2: Banking Services */}
            <div>
              <p className="font-semibold text-foreground uppercase tracking-wider text-[11px] mb-3">Banking Services</p>
              <ul className="space-y-2">
                <li><Link to="/personal" className="hover:text-primary transition-colors">Everyday Checking</Link></li>
                <li><Link to="/cards" className="hover:text-primary transition-colors">Gold Rewards Card</Link></li>
                <li><Link to="/business" className="hover:text-primary transition-colors">Commercial Treasury</Link></li>
                <li><Link to="/loans" className="hover:text-primary transition-colors">Home & Business Loans</Link></li>
                <li><Link to="/grants" className="hover:text-primary transition-colors">Federal & Small Biz Grants</Link></li>
                <li><Link to="/irs" className="hover:text-primary transition-colors">IRS & Tax Direct Filing</Link></li>
              </ul>
            </div>

            {/* Col 3: Resources & Support */}
            <div>
              <p className="font-semibold text-foreground uppercase tracking-wider text-[11px] mb-3">Customer Support</p>
              <ul className="space-y-2">
                <li><Link to="/help" className="hover:text-primary transition-colors">Help & Support Center</Link></li>
                <li><a href="tel:+1800582EWB" className="hover:text-primary transition-colors">+1 800 582 EWB (24/7)</a></li>
                <li><a href="tel:+1900682EWB" className="hover:text-primary transition-colors">+ 1 900 682 EWB (Priority)</a></li>
                <li><a href="mailto:support@easterntrustbank.co" className="hover:text-primary transition-colors">support@easterntrustbank.co</a></li>
                <li><Link to="/rates" className="hover:text-primary transition-colors">Rates & APR Schedule</Link></li>
                <li><Link to="/auth" className="hover:text-primary transition-colors">Customer Online Portal</Link></li>
              </ul>
            </div>

            {/* Col 4: Regulatory & Security */}
            <div>
              <p className="font-semibold text-foreground uppercase tracking-wider text-[11px] mb-3">Compliance & Security</p>
              <ul className="space-y-2">
                <li><span className="text-foreground">Member FDIC</span></li>
                <li><span className="text-foreground">Equal Housing Lender</span></li>
                <li><span>SOC 2 Type II Certified</span></li>
                <li><span>Insured Cold Storage</span></li>
                <li><span>Privacy Policy</span></li>
                <li><span>Terms of Agreement</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-14 border-t border-border/60 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-[11px]">
            <p>© 2026 Eastern Trust Bank NA. All rights reserved. Member FDIC. Equal Housing Lender.</p>
            <p className="text-muted-foreground/80">
              Deposit accounts insured up to $250,000 per depositor through the FDIC. Bitcoin and digital assets held in segregated offline cold-storage.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
