import type { View } from '../types';

interface FooterProps {
  onNavigate: (view: View) => void;
}

const COLUMNS: { heading: string; links: { label: string; view?: View }[] }[] = [
  {
    heading: 'Order',
    links: [
      { label: 'Full menu', view: 'menu' },
      { label: 'Track an order', view: 'tracker' },
      { label: 'Dine in or takeaway', view: 'menu' }
    ]
  },
  {
    heading: 'Visit',
    links: [{ label: 'Opening hours' }, { label: 'Billiards tables' }, { label: 'Find us' }]
  },
  {
    heading: 'About',
    links: [{ label: 'Our story' }, { label: 'The baristas' }, { label: 'Contact' }]
  }
];

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__grid">
        <div>
          <div className="brand" style={{ cursor: 'default' }}>
            <img className="brand__mark" src="/break_and_brews.png" alt="" />
            <span className="brand__name">BREAK &amp; BREWS</span>
          </div>
          <p className="site-footer__blurb">
            Coffee, plates and billiards under one roof. Order from your table, watch it come together, and
            take the break you came for.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.heading}>
            <h2 className="site-footer__heading">{column.heading}</h2>
            <div className="site-footer__links">
              {column.links.map((link) =>
                link.view ? (
                  <button
                    key={link.label}
                    className="site-footer__link"
                    onClick={() => onNavigate(link.view as View)}
                  >
                    {link.label}
                  </button>
                ) : (
                  <span key={link.label} className="site-footer__link">
                    {link.label}
                  </span>
                )
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="shell site-footer__bottom">
        © {new Date().getFullYear()} Break &amp; Brews. All rights reserved.
      </div>
    </footer>
  );
}
