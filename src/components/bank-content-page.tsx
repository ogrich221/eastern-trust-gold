import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BankContentPage({ eyebrow, title, description, items }: { eyebrow: string; title: string; description: string; items: { title: string; copy: string }[] }) {
  return <main><section className="border-b border-border py-20 sm:py-28"><div className="mx-auto max-w-7xl px-5 lg:px-8"><p className="text-xs font-semibold uppercase text-primary">{eyebrow}</p><h1 className="mt-5 max-w-4xl text-5xl leading-none sm:text-7xl">{title}</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">{description}</p><Button asChild size="lg" className="mt-9"><Link to="/signup">Open an account <ArrowRight /></Link></Button></div></section><section className="py-16"><div className="mx-auto grid max-w-7xl gap-px bg-border px-5 sm:grid-cols-2 lg:px-8">{items.map(item => <article key={item.title} className="bg-background p-8"><CheckCircle2 className="size-6 text-primary"/><h2 className="mt-8 text-3xl">{item.title}</h2><p className="mt-3 leading-7 text-muted-foreground">{item.copy}</p></article>)}</div></section></main>;
}