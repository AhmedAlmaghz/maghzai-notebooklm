import LandingNavbar from "@/components/landing/landing-navbar";
import LandingHero from "@/components/landing/landing-hero";
import LandingFeatures from "@/components/landing/landing-features";
import LandingHowItWorks from "@/components/landing/landing-how-it-works";
import LandingTestimonials from "@/components/landing/landing-testimonials";
import LandingPricing from "@/components/landing/landing-pricing";
import LandingFaq from "@/components/landing/landing-faq";
import LandingCta from "@/components/landing/landing-cta";
import LandingFooter from "@/components/landing/landing-footer";

/**
 * Marketing landing page (anonymous visitors only).
 * Static composition of section components; interactivity lives in the
 * individual client components (navbar, FAQ accordion, scroll reveal).
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingTestimonials />
        <LandingPricing />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
