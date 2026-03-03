'use client';

export function SocialLinks() {
  return (
    <div className="social-links">
      <a
        href="https://github.com/startup-dreamer/x402-chainlink"
        target="_blank"
        rel="noopener noreferrer"
        className="social-link"
        title="GitHub Repository"
      >
        GITHUB
      </a>
      <a
        href="https://startup-dreamer.github.io/x402-chainlink/"
        target="_blank"
        rel="noopener noreferrer"
        className="social-link"
        title="Chainlink CRE Docs"
      >
        DOCS
      </a>
      <a
        href="https://sepolia.basescan.org"
        target="_blank"
        rel="noopener noreferrer"
        className="social-link"
        title="Base Sepolia Explorer"
      >
        EXPLORER
      </a>
    </div>
  );
}
