export default function PrivacyPage() {
  return (
    <main>
      <section className="legal-page">
        <p className="legal-eyebrow">LEGAL</p>
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Last updated: September 2026</p>

        <p className="legal-intro">
          This Privacy Policy explains what information BOOMERS collects,
          why, and how it's used. Because taking a title publicly displays
          certain information about you, please read this carefully before
          signing in.
        </p>

        <h2 className="legal-subheading">1. Information we collect</h2>
        <p className="legal-body">
          <strong>Account information:</strong> when you sign in with
          Google, we receive your email address and, if available, an
          avatar image, from Google's authentication service.
        </p>
        <p className="legal-body">
          <strong>Profile information:</strong> display name, country,
          address, and a favourite quote that you submit when completing
          your profile.
        </p>
        <p className="legal-body">
          <strong>Uploaded images:</strong> the photo you upload when
          taking a title, and the background-removed version we generate
          from it.
        </p>
        <p className="legal-body">
          <strong>Social handles:</strong> Instagram and TikTok handles you
          optionally add while holding a title.
        </p>
        <p className="legal-body">
          <strong>Bid history:</strong> a record of the amount, timestamp,
          and profile information associated with each bid you place.
        </p>

        <h2 className="legal-subheading">2. What is shown publicly</h2>
        <p className="legal-body">
          While you hold a title, your display name, country, address,
          favourite quote, uploaded image, and any linked social handles
          are shown publicly on that title's page to every visitor of the
          Service. Do not submit information you don't want to be public.
        </p>

        <h2 className="legal-subheading">3. How we use your information</h2>
        <p className="legal-body">
          We use the information above to operate the Service: to display
          the current holder of each title, process bids and payments, and
          provide account access. We do not sell your personal
          information to third parties.
        </p>

        <h2 className="legal-subheading">4. Payment processing</h2>
        <p className="legal-body">
          Payments are handled by a third-party payment processor. We do
          not store your full payment card details on our own servers.
        </p>

        <h2 className="legal-subheading">5. Data storage</h2>
        <p className="legal-body">
          Account and profile data is stored using Supabase, our database
          and authentication provider. Uploaded images are stored in
          Supabase's file storage.
        </p>

        <h2 className="legal-subheading">6. Your choices</h2>
        <p className="legal-body">
          You can update your profile information, social handles, and
          uploaded image at any time while you hold a title. To request
          deletion of your account data, contact us at{" "}
          <a href="mailto:contact.kirkversary@gmail.com">contact.kirkversary@gmail.com</a>.
          Note that information already shown publicly on a title page
          while you were the holder may have been cached, screenshotted,
          or archived by others outside our control.
        </p>

        <h2 className="legal-subheading">7. Changes to this policy</h2>
        <p className="legal-body">
          We may update this Privacy Policy from time to time. We'll post
          the updated version here with a new "last updated" date.
        </p>

        <h2 className="legal-subheading">8. Contact</h2>
        <p className="legal-body">
          Questions about this policy can be sent to{" "}
          <a href="mailto:contact.kirkversary@gmail.com">contact.kirkversary@gmail.com</a>.
        </p>
      </section>
    </main>
  );
}