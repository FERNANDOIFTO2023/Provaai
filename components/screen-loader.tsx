/*
 * Interface / carregamento de tela
 * Oferece uma indicação visual de transição enquanto a área do professor está carregando. O estado
 * ativo é controlado por quem conhece o andamento da navegação.
 */
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
