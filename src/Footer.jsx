import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <div className="brand-mark">B</div>
          <div className="brand-name">BOOMERS</div>
        </div>

        <nav className="footer-links">
          <Link to="/about">About / How It Works</Link>
          <Link to="/contact">Contact / Support</Link>
          <Link to="/terms">Terms &amp; Conditions</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </nav>

        <p className="footer-copyright">
          © {new Date().getFullYear()} BOOMERS. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
