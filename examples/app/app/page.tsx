import { ThemeToggle } from './components/ThemeToggle';
import { SocialLinks } from './components/SocialLinks';
import WeatherClient from './components/WeatherClient';

export default function Home() {
  return (
    <div className="page-container">
      <div className="social-links-container">
        <SocialLinks />
      </div>
      <div className="theme-toggle-container">
        <ThemeToggle />
      </div>

      <main className="main-content">
        <div className="hero">
          <h1 className="title">CHAINLINK x402 DEMO</h1>
          <p className="subtitle">
            Pay-per-request APIs with <strong>USDC micropayments</strong> on
            Base Sepolia via <strong>Chainlink CRE</strong>.
          </p>
          <div className="protocol-badge">
            <span className="badge-item">EIP-712</span>
            <span className="badge-separator">×</span>
            <span className="badge-item">HTTP 402</span>
            <span className="badge-separator">×</span>
            <span className="badge-item">CRE Settlement</span>
          </div>
        </div>

        <WeatherClient />

        {!process.env.NEXT_PUBLIC_SENDER_PRIVATE_KEY && (
          <div className="env-warning">
            <span>⚠ MISSING NEXT_PUBLIC_SENDER_PRIVATE_KEY</span>
            <p>Copy .env.local.example to .env.local and add your testnet private key.</p>
          </div>
        )}
      </main>
    </div>
  );
}
