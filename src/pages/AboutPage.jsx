export default function AboutPage() {
  return (
    <main>
      <section className="legal-page">
        <p className="legal-eyebrow">ABOUT BOOMERS</p>
        <h1 className="legal-title">How It Works</h1>

        <p className="legal-intro">
          BOOMERS is a marketplace for eight fictional, satirical titles.
          Each title has exactly one holder at a time. Anyone can outbid the
          current holder for a small amount more than the current price,
          instantly taking their place.
        </p>

        <div className="legal-steps">
          <div className="legal-step">
            <span className="legal-step-number">01</span>
            <h3>Pick a title</h3>
            <p>
              Browse the eight active titles and choose the one you want.
              Each shows the current holder, their country, and the current
              price.
            </p>
          </div>

          <div className="legal-step">
            <span className="legal-step-number">02</span>
            <h3>Outbid the holder</h3>
            <p>
              Sign in with Google, fill in a short public profile (display
              name, country, address, and a favourite quote), and pay to
              outbid the current holder.
            </p>
          </div>

          <div className="legal-step">
            <span className="legal-step-number">03</span>
            <h3>Take their identity</h3>
            <p>
              Upload a photo of yourself. We'll automatically try to remove
              the background so your character appears on the title's
              page. You instantly become the new public holder of the
              title.
            </p>
          </div>
        </div>

        <h2 className="legal-subheading">What is "W Aura"?</h2>
        <p className="legal-body">
          W Aura is a reaction counter that other visitors can add to while
          you hold a title. It's a lighthearted way for the community to
          show approval of the current holder — it has no monetary value
          and cannot be bought.
        </p>

        <h2 className="legal-subheading">Is this a real payment?</h2>
        <p className="legal-body">
          Outbidding a title involves a real, non-refundable payment
          processed through our payment provider. There is no prize pool,
          no redistribution, and no guarantee of any return — the payment
          is simply the cost of taking the title from its current holder.
          See our{" "}
          <a href="/terms">Terms &amp; Conditions</a> for full details.
        </p>

        <h2 className="legal-subheading">Questions?</h2>
        <p className="legal-body">
          Reach out any time via our <a href="/contact">Contact page</a>.
        </p>
      </section>
    </main>
  );
}