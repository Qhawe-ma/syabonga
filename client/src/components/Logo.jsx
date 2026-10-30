export default function Logo({ tone = 'on-dark' }) {
  return (
    <span className={'logo-lockup ' + tone}>
      <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect className="tile" width="32" height="32" rx="8" />
        <path className="ink" d="M10.4 13.2h11.2l-.95 9.3a1.5 1.5 0 0 1-1.5 1.35h-6.3a1.5 1.5 0 0 1-1.5-1.35l-.95-9.3z" />
        <path className="ink" d="M13 13.2v-1.7a3 3 0 0 1 6 0v1.7" />
      </svg>
      <span className="word">
        <span className="w1">Siyabonga</span>
        <span className="w2">Powertrade</span>
      </span>
    </span>
  );
}
