import { formatMoney } from '../simulation/Finance';
import { goalText, SPONSOR_SLOTS } from '../simulation/Sponsors';
import type { SponsorDeal, TeamSponsors } from '../simulation/Sponsors';
import m from './Management.module.css';

/** Lo que paga un contrato, en una línea: «0,5 M por ronda» y, si tiene objetivo, su prima. */
function Terms({ deal }: { deal: SponsorDeal }) {
  return (
    <span className={m.muted}>
      {formatMoney(deal.perRound)} por ronda
      {deal.goal && <> · prima de <span className={m.pos}>{formatMoney(deal.bonus, true)}</span> por {goalText(deal.goal)}</>}
      {' '}· hasta la temporada {deal.untilSeason}
    </span>
  );
}

/**
 * [T4.9] Patrocinio del equipo: los contratos firmados (tres huecos, los rótulos del coche) y las ofertas para el
 * hueco libre, cada una con su pago fijo por ronda y, si lo tiene, su objetivo y su prima.
 */
export function SponsorsPanel({ sponsors, onSign }: { sponsors: TeamSponsors; onSign: (offerId: string) => void }) {
  const free = sponsors.deals.length < SPONSOR_SLOTS;
  return (
    <section className={`${m.card} ${m.stack}`} aria-label="Patrocinio">
      <span className={m.label}>Patrocinio · {sponsors.deals.length} de {SPONSOR_SLOTS} huecos</span>
      <div className={m.lines}>
        {sponsors.deals.map(deal => <div key={deal.name}><b>{deal.name}</b><Terms deal={deal} /></div>)}
      </div>
      {free && sponsors.offers.length > 0 && (
        <>
          <span className={m.label}>Ofertas para el hueco libre</span>
          {sponsors.offers.map(offer => (
            <div key={offer.id} className={m.facility}>
              <b>{offer.name}</b>
              <button type="button" className={m.button} onClick={() => onSign(offer.id)}>Firmar</button>
              <Terms deal={offer} />
            </div>
          ))}
        </>
      )}
      {free && sponsors.offers.length === 0 && <span className={m.dim}>Sin ofertas hasta la temporada siguiente.</span>}
    </section>
  );
}
