// [N10] Codificación para Firebase. Realtime Database no guarda null ni listas u objetos vacíos (los borra) y devuelve
// las listas con huecos como objetos o sin sus posiciones vacías. Lo que la aplicación guarda ahí y necesita tal cual
// (las fotos del respaldo, la vista de equipo, la lista de salida, la clasificación) se marca al escribir y se recupera
// al leer, para que llegue idéntico. Sin esto, la foto lenta llegaba sin `bestSectors` y la aplicación del invitado caía.
//   null → '~n'      []  → ['~a']      {} → { '~o': true }      un texto que empieza por '~' → '~' + texto
const MARK = '~';
const NULL = '~n';
const EMPTY_LIST = '~a';
const EMPTY_OBJECT = '~o';

export function toDb(value: unknown): unknown {
  if (value === null || value === undefined) return NULL;
  if (typeof value === 'string') return value.startsWith(MARK) ? MARK + value : value;
  if (Array.isArray(value)) return value.length ? value.map(toDb) : [EMPTY_LIST];
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    return entries.length ? Object.fromEntries(entries.map(([k, v]) => [k, toDb(v)])) : { [EMPTY_OBJECT]: true };
  }
  return value;
}

export function fromDb(value: unknown): unknown {
  if (value === null || value === undefined || value === NULL) return null;
  if (typeof value === 'string') return value.startsWith(MARK + MARK) ? value.slice(1) : value;
  if (Array.isArray(value)) return value.length === 1 && value[0] === EMPTY_LIST ? [] : value.map(fromDb);
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 1 && entries[0][0] === EMPTY_OBJECT) return {};
    return Object.fromEntries(entries.map(([k, v]) => [k, fromDb(v)]));
  }
  return value;
}
