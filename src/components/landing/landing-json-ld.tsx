import ar from "@/i18n/dictionaries/ar";

/**
 * JSON-LD structured data for SEO (SoftwareApplication + FAQPage).
 * Server component — rendered only on the anonymous landing page.
 * Uses the default locale (ar) dictionary for the schema markup content.
 */
export default function LandingJsonLd() {
    const dict = ar;

    const softwareJsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: dict.common.appName,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        url: process.env.NEXT_PUBLIC_APP_URL || "https://maghzai-notebooklm.vercel.app",
        offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
        },
        description: dict.landing.meta.description,
        inLanguage: ["ar", "en"],
    };

    const faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: Object.values(dict.landing.faq.items).map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
            },
        })),
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
        </>
    );
}
