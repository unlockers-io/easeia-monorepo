import { Api } from "@/components/sections/api";
import { Capabilities } from "@/components/sections/capabilities";
import { FinalCta } from "@/components/sections/final-cta";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Pricing } from "@/components/sections/pricing";
import { Problem } from "@/components/sections/problem";
import { Screenshot } from "@/components/sections/screenshot";

const Page = () => {
  return (
    <>
      <Hero />
      <Problem />
      <Capabilities />
      <HowItWorks />
      <Screenshot />
      <Api />
      <Pricing />
      <FinalCta />
    </>
  );
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default Page;
