export default function Logo({ compact = false }) {
  if (compact) {
    return (
      <span className="logo-plate is-mark">
        <img src="/shared/img/mark.png" alt="Siyabonga Powertrade" />
      </span>
    );
  }
  return (
    <span className="logo-plate">
      <img className="logo-full" src="/shared/img/logo-clean.png" alt="Siyabonga Powertrade" />
      <img className="logo-mark" src="/shared/img/mark.png" alt="" />
    </span>
  );
}
