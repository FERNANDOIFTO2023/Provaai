export default function ScreenLoader({ active = true }: { active?: boolean }) {
  return (
    <div className="screen-loader" data-active={active} aria-hidden={!active}>
      <div className="loader-character" aria-hidden="true">
        <img
          src="/bloub/static/bloub-sonolento.svg"
          width="152"
          height="152"
          alt=""
        />
        <span className="loader-shadow" />
      </div>
      <span role="status" className="loader-label">
        {active ? 'Carregando sua Provaai…' : ''}
      </span>
    </div>
  );
}
