import Image from "next/image";

const TIKTOK_SHOP_URL = "https://www.tiktok.com/@vyratec"; // <-- replace with your TikTok Shop / profile link

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute top-40 right-[-120px] h-[420px] w-[420px] rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[-120px] h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#" className="flex items-center gap-3">
            {/* Put your logo at: /public/brand/vyratec-h.png */}
            <Image
  src="/brand/vyratec-h.svg"
  alt="Vyratec"
  width={180}
  height={40}
  priority
/>


          </a>

          <nav className="hidden items-center gap-6 text-sm text-slate-200 md:flex">
            <a className="hover:text-white" href="#categories">
              Categories
            </a>
            <a className="hover:text-white" href="#picks">
              Weekly picks
            </a>
            <a className="hover:text-white" href="#why">
              Why Vyratec
            </a>
            <a
              className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-950 hover:bg-slate-200"
              href={TIKTOK_SHOP_URL}
              target="_blank"
              rel="noreferrer"
            >
              Shop TikTok
            </a>
          </nav>

          <a
            className="md:hidden rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
            href={TIKTOK_SHOP_URL}
            target="_blank"
            rel="noreferrer"
          >
            Shop
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-10 pt-14 md:pt-20">
        <div className="grid gap-10 md:grid-cols-12 md:items-start">
          <div className="md:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Asian tech & trends - curated for the UK
            </p>

            <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-6xl">
              Viral finds,{" "}
              <span className="text-slate-300">actually worth buying.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
              We curate the best tech and trend products from across Asia-then
              highlight the ones that fit UK buyers: practical, giftable,
              and genuinely useful. New drops weekly via TikTok Shop.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={TIKTOK_SHOP_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-white px-6 py-3 font-semibold text-slate-950 hover:bg-slate-200"
              >
                Shop TikTok
              </a>

              <a
                href="#picks"
                className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 font-semibold text-slate-100 hover:border-white/25"
              >
                See this week’s picks
              </a>
            </div>

            <div className="mt-7 flex flex-wrap gap-2 text-xs text-slate-300">
              <Chip>UK-focused curation</Chip>
              <Chip>Weekly drops</Chip>
              <Chip>Secure checkout on TikTok Shop</Chip>
              <Chip>Trend scouting (KR / JP / CN)</Chip>
            </div>
          </div>

          {/* Right card */}
          <div className="md:col-span-5">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="text-sm font-semibold text-slate-100">
                What you’ll find
              </div>

              <div className="mt-4 grid gap-3">
                <MiniCard title="Smart gadgets" desc="Useful tech that improves daily life." />
                <MiniCard title="Home + lifestyle" desc="Trendy, aesthetic, and practical." />
                <MiniCard title="TikTok gear" desc="Products that make your quality improve greatly." />
                <MiniCard title="Giftable finds" desc="Best sellers that people actually keep." />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
                Want us to curate a category? DM us on TikTok and our team will scout it.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold">Categories</h2>
            <p className="mt-2 text-slate-300">
              Browse by vibe - we keep it tight and curated.
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-4">
          <Category title="Gadgets" subtitle="Small tech, big upgrade" />
          <Category title="Home" subtitle="Make it nicer + easier" />
          <Category title="Lifestyle" subtitle="Trends that stick" />
          <Category title="Phone videos" subtitle="Enhance quality, with ease" />
        </div>
      </section>

      {/* Weekly picks */}
      <section id="picks" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="text-2xl font-semibold">This week’s picks</h2>
          <p className="mt-2 text-slate-300">
            Replace these placeholders with real products later (we can connect a feed).
          </p>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            <ProductCard
              title="Pocket translator / smart tag"
              note="Compact, travel-friendly"
              badge="Trending"
            />
            <ProductCard
              title="Mini desk vacuum / cleaner"
              note="Perfect for keyboards"
              badge="Best seller"
            />
            <ProductCard
              title="LED ambient light bar"
              note="Clean setup aesthetic"
              badge="New"
            />
          </div>

          <div className="mt-8">
            <a
              href={TIKTOK_SHOP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-2xl bg-white px-6 py-3 font-semibold text-slate-950 hover:bg-slate-200"
            >
              Shop on TikTok →
            </a>
          </div>
        </div>
      </section>

      {/* Why */}
      <section id="why" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="text-2xl font-semibold">Why Vyratec</h2>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            <InfoCard
              title="Curated, not cluttered"
              desc="We don’t list everything-only products that pass our “worth it” filter."
            />
            <InfoCard
              title="UK market lens"
              desc="We prioritise products that fit UK usage, gifting, and expectations."
            />
            <InfoCard
              title="Trends with utility"
              desc="If it’s viral but useless, it doesn’t make the cut."
            />
          </div>
        </div>
      </section>

      {/* Simple contact / socials */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
            <h2 className="text-2xl font-semibold">Work with us</h2>
            <p className="mt-2 max-w-2xl text-slate-300">
              Brand collabs, affiliate partnerships, product submissions, and category requests.
              Reach out on TikTok.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={TIKTOK_SHOP_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-white px-6 py-3 font-semibold text-slate-950 hover:bg-slate-200"
              >
                TikTok / Shop
              </a>
              <a
                href="mailto:shop@vyratec.com"
                className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 font-semibold text-slate-100 hover:border-white/25"
              >
                Email: shop@vyratec.com
              </a>
            </div>

            <p className="mt-5 text-xs text-slate-400">
              Tip: Once you confirm your preferred email, we’ll wire a proper contact form + spam protection.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-slate-400">
          © {new Date().getFullYear()} Vyratec - Asian tech & trends curated for the UK.
        </div>
      </footer>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
      {children}
    </span>
  );
}

function MiniCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      <div className="mt-1 text-sm text-slate-300">{desc}</div>
    </div>
  );
}

function Category({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20">
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-2 text-sm text-slate-300">{subtitle}</div>
      <div className="mt-5 h-20 rounded-2xl border border-white/10 bg-slate-950/30" />
      <div className="mt-4 text-xs text-slate-400 group-hover:text-slate-300">
        Explore →
      </div>
    </div>
  );
}

function ProductCard({
  title,
  note,
  badge,
}: {
  title: string;
  note: string;
  badge: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
          {badge}
        </span>
        <span className="text-xs text-slate-400">UK curated</span>
      </div>

      <div className="mt-4 h-40 rounded-2xl border border-white/10 bg-slate-950/30" />

      <div className="mt-4 text-lg font-semibold">{title}</div>
      <div className="mt-1 text-sm text-slate-300">{note}</div>

      <div className="mt-5 text-sm text-slate-300">
        Available via TikTok Shop
      </div>
    </div>
  );
}

function InfoCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="text-lg font-semibold">{title}</div>
      <p className="mt-2 text-slate-300">{desc}</p>
    </div>
  );
}
