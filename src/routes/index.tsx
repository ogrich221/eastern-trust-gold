import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, CreditCard, Landmark, LockKeyhole, PiggyBank, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/eastern-trust-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Eastern Trust Bank | Banking Built on Trust" },
    { name: "description", content: "Explore personal and business banking, lending, savings, and competitive rates at Eastern Trust Bank." },
    { property: "og:title", content: "Eastern Trust Bank | Banking Built on Trust" },
    { property: "og:description", content: "A stronger financial future starts with a bank that puts trust first." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: Index,
});

function Index() {
  const services: { icon: LucideIcon; title: string; copy: string; to: "/business" | "/products" }[] = [
    { icon: PiggyBank, title: "Personal banking", copy: "Everyday accounts and savings shaped around your goals.", to: "/products" },
    { icon: Building2, title: "Business banking", copy: "Practical support for cash flow, growth, and opportunity.", to: "/business" },
    { icon: CreditCard, title: "Cards & lending", copy: "Flexible credit with clear terms and responsible guidance.", to: "/products" },
    { icon: Landmark, title: "Wealth planning", copy: "Long-term perspective for the legacy you want to create.", to: "/products" },
  ];
  return (
    <main>
      <section className="relative min-h-[calc(100vh-5rem)] overflow-hidden border-b border-border">
        <img src={heroImage} alt="Eastern Trust Bank headquarters entrance" width={1600} height={1000} className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="hero-scrim absolute inset-0" />
        <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center px-5 py-20 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase text-primary"><span className="h-px w-10 bg-primary" />Established on trust</div>
            <h1 className="text-5xl font-semibold leading-[0.96] text-foreground sm:text-7xl lg:text-8xl">Prosperity,<br/><span className="text-primary">preserved.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-foreground/80 sm:text-lg">Thoughtful banking for the life you are building. Personal guidance, modern access, and a relationship designed to last.</p>
            <div className="mt-9 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/signup">Open an account <ArrowRight /></Link></Button><Button asChild size="lg" variant="outline"><Link to="/personal">Explore personal banking</Link></Button></div>
            <div className="mt-12 flex items-center gap-3 text-xs text-foreground/70"><ShieldCheck className="size-4 text-primary" /> Protected access and industry-standard encryption</div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div><p className="text-xs font-semibold uppercase text-primary">Banking, considered</p><h2 className="mt-4 text-4xl leading-tight sm:text-5xl">Every ambition deserves a sound foundation.</h2></div>
            <div className="grid gap-px bg-border sm:grid-cols-2">
              {services.map(({icon: Icon,title,copy,to}) => <Link key={title} to={to} className="group bg-background p-7 transition-colors hover:bg-card"><Icon className="size-7 text-primary"/><h3 className="mt-8 text-2xl">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p><ArrowRight className="mt-6 size-4 text-primary transition-transform group-hover:translate-x-1"/></Link>)}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-card py-16"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 lg:flex-row lg:items-center lg:px-8"><div className="flex gap-5"><LockKeyhole className="mt-2 size-8 shrink-0 text-primary"/><div><h2 className="text-3xl">Your security is never an afterthought.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">We use layered safeguards and vigilant monitoring to help protect every interaction.</p></div></div><Button asChild variant="outline"><Link to="/help">Security center <ArrowRight /></Link></Button></div></section>
    </main>
  );
}
