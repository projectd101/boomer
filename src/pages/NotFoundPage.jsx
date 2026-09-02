import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow hero-eyebrow">404</p>
        <h1>This title doesn't exist.</h1>
        <p className="hero-description">
          The page you're looking for isn't one of the eight titles.
        </p>
        <Link to="/" className="sign-in-button get-started-button">
          BACK TO BOOMERS
          <span>→</span>
        </Link>
      </section>
    </main>
  );
}
