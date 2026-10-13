import type { ReactNode } from 'react';
import { SETUP_FIELDS, SETUP_RANGE } from '../simulation/Setup';
import type { CarSetup } from '../simulation/Setup';
import m from './Management.module.css';

const SHORT: Record<keyof CarSetup, string> = { wing: 'Carga', stiffness: 'Rigidez', gearing: 'Cambio' };

/**
 * Varios setups, uno por fila y un ajuste por columna, cada valor como una escala con su casilla marcada (la más alta
 * es la referencia). Lo que cambia de una fila a otra va resaltado: es lo único que queda por decidir.
 */
export function SetupCompare({ caption, head, rows }: {
  /** Nombre de la tabla para lectores de pantalla. */
  caption: string;
  /** Rótulo de la primera columna («Opción», «Piloto»). */
  head: string;
  rows: { id: string; name: ReactNode; setup: CarSetup }[];
}) {
  const differs = (key: keyof CarSetup) => rows.some(row => row.setup[key] !== rows[0].setup[key]);
  return (
    <table className={m.setupTable} aria-label={caption}>
      <thead>
        <tr>
          <th scope="col">{head}</th>
          {SETUP_FIELDS.map(field => <th key={field.key} scope="col" title={field.label}>{SHORT[field.key]}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.id}>
            <th scope="row">{row.name}</th>
            {SETUP_FIELDS.map(field => {
              const { min, max } = SETUP_RANGE[field.key], value = row.setup[field.key];
              return (
                <td key={field.key} data-differs={differs(field.key) ? 'true' : undefined} title={`${field.label}: ${field.valueLabel(value)}. ${field.effect(value)}`}>
                  <span className={m.setupCell}>
                    <span className={m.setupPips} aria-hidden="true">
                      {Array.from({ length: max - min + 1 }, (_, step) => <i key={step} data-on={min + step === value ? 'true' : undefined} data-ref={min + step === 0 ? 'true' : undefined} />)}
                    </span>
                    <span className={m.setupValue}>{field.valueLabel(value)}</span>
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
