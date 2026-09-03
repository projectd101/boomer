export default function ContactPage() {
  return (
    <main>
      <section className="legal-page">
        <p className="eyebrow hero-eyebrow">GET IN TOUCH</p>
        <h1 className="legal-title">Contact &amp; Support</h1>

        <p className="legal-intro">
          Have a question about a title, a payment, your account, or
          something that looks broken? Reach out and we'll get back to
          you as soon as we can.
        </p>

        <div className="contact-grid">
          <div className="contact-card">
            <h3>General support</h3>
            <p>
              Account issues, payment questions, bugs, or anything else
              about using BOOMERS.
            </p>
            <a className="contact-link" href="mailto:contact.kirkversary@gmail.com">
              contact.kirkversary@gmail.com
            </a>
          </div>

          <div className="contact-card">
            <h3>Trust &amp; safety</h3>
            <p>
              Report impersonation, abusive content on a title page, or a
              violation of our Terms &amp; Conditions.
            </p>
            <a className="contact-link" href="mailto:contact.kirkversary@gmail.com">
              contact.kirkversary@gmail.com
            </a>
          </div>

          <div className="contact-card">
            <h3>Privacy requests</h3>
            <p>
              Ask about the data we hold on you, or request that your
              account information be deleted.
            </p>
            <a className="contact-link" href="mailto:contact.kirkversary@gmail.com">
              contact.kirkversary@gmail.com
            </a>
          </div>
        </div>

        <h2 className="legal-subheading">Response time</h2>
        <p className="legal-body">
          We aim to respond to all support requests within 2–3 business
          days. Trust &amp; safety reports involving active abuse are
          prioritized.
        </p>
      </section>
    </main>
  );
}
