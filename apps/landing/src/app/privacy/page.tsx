import type { Metadata } from "next";

import { LegalArticle } from "@/components/legal-article";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  title: "Privacy policy",
};

const Page = () => {
  return (
    <LegalArticle title="Privacy policy" updated="September 8, 2026">
      <p>
        This policy covers easeia.com and the Easeia Cloud waitlist. Contact{" "}
        <a href="mailto:hello@easeia.com">hello@easeia.com</a> with privacy requests.
      </p>
      <h2>Waitlist email</h2>
      <p>
        When you join, we store your email address, signup source, and signup time to send Cloud
        launch updates. We do not sell the list. We keep it until Cloud launches or you ask us to
        delete your entry; any later product emails require a separate choice.
      </p>
      <h2>Website analytics and requests</h2>
      <p>
        The hosted marketing site may use Vercel Web Analytics for aggregate page usage. It does not
        use advertising cookies. Our hosting providers also process request information to serve the
        site. The waitlist API uses IP addresses temporarily for rate limiting; it does not store
        them in your signup record.
      </p>
      <h2>Self-hosted installations</h2>
      <p>
        The Easeia application does not send your sites, posts, or account data to Easeia.
        Integrations you enable send the data needed to your selected providers, such as OpenAI,
        DataForSEO, Google, Resend, or R2. The optional landing analytics are disabled by default.
        Your server and database remain under your control.
      </p>
      <h2>Your choices</h2>
      <p>
        Email us to access, correct, or delete your waitlist entry, or to stop launch updates.
        Self-hosted operators manage their own data and retention.
      </p>
    </LegalArticle>
  );
};

export default Page;
