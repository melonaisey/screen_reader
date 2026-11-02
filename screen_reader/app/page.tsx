import Image from "next/image";
import { Sprout } from "lucide-react";
import NewVideoForm from "./components/NewVideoForm";
import RecipeCount from "./components/RecipeCount";
import Sidebar, { SectionLabel } from "./components/layout/Sidebar";
import SiteFooter from "./components/layout/SiteFooter";

const steps = [
  {
    title: "Find your inspiration",
    description: "Paste the link to a cooking video you want to try.",
  },
  {
    title: "Let us do the note-taking",
    description: "We read subtitles and gather every ingredient and step.",
  },
  {
    title: "Make it. Keep it. Cook again.",
    description: "Save your recipe and organise it into groups you love.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col gap-[30px] px-4 pt-8 sm:px-10">
        <header className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold tracking-[1.8px] text-rose uppercase">
            Your personal cookbook
          </p>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h1 className="font-display text-[34px] leading-tight sm:text-[40px]">
              A fresh page in your kitchen.
            </h1>
            <p className="pb-2 text-xs text-muted">
              <RecipeCount />
            </p>
          </div>
          <p className="text-[13px] text-muted">
            The best recipes often start with a video you can’t stop watching.
          </p>
        </header>

        <section className="grid overflow-hidden rounded-[18px] border border-line bg-white md:grid-cols-[minmax(0,690fr)_430fr]">
          <div className="flex flex-col gap-[22px] p-6 sm:p-9">
            <p className="flex items-center gap-[7px] text-[10px] font-semibold tracking-[1.6px] text-rose uppercase">
              <Sprout size={18} strokeWidth={1.7} aria-hidden />
              Something delicious starts here
            </p>
            <h2 className="font-display text-[32px] leading-[1.12] sm:text-[39px]">
              Let’s get started by watching a new cooking video
            </h2>
            <p className="text-[13px] leading-[1.8] text-muted">
              Bring a video you love. We’ll turn the subtitles into a transcript, a dish
              summary, ingredients and a step-by-step recipe. All in one place.
            </p>
            <NewVideoForm />
          </div>

          <div className="relative min-h-[420px] md:min-h-[550px]">
            <Image
              src="/images/kitchen-inspiration.jpg"
              alt="A home-cooked meal on a kitchen table"
              fill
              sizes="(min-width: 768px) 430px, 100vw"
              className="object-cover"
              loading="eager"
            />
            <div className="absolute inset-x-6 bottom-6 flex flex-col gap-1.5 rounded-lg bg-paper p-[19px]">
              <p className="font-display text-[23px] leading-tight text-rose">
                Less scrolling. More cooking.
              </p>
              <p className="text-[11px] leading-[1.6] text-muted">
                A home for all those “I should make this” moments.
              </p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="flex scroll-mt-28 flex-col gap-[22px]">
          <SectionLabel>From video to dinner, in three little steps</SectionLabel>
          <ol className="grid gap-7 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-3.5">
                <span className="font-display text-2xl leading-none text-rose">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-2">
                  <p className="text-[13px] font-semibold">{step.title}</p>
                  <p className="text-xs leading-[1.7] text-muted">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <SiteFooter />
      </main>
    </div>
  );
}
